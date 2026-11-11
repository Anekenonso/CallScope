import * as parser from '@solidity-parser/parser';
import {
  type Address,
  type Hex,
  type PublicClient,
  getAddress,
  keccak256,
  stringToBytes,
} from 'viem';
import type { SupportedNetwork, RoleCapability, RecipientProfile } from '../../src/types/analysis';

export const KNOWN_ROLE_NAMES = [
  'DEFAULT_ADMIN_ROLE',
  'PROPOSER_ROLE',
  'EXECUTOR_ROLE',
  'CANCELLER_ROLE',
  'TIMELOCK_ADMIN_ROLE',
  'MINTER_ROLE',
  'PAUSER_ROLE',
  'UPGRADER_ROLE',
] as const;

/**
 * Compute 32-byte role hash using keccak256
 */
export function computeRoleHash(name: string): Hex {
  if (name === 'DEFAULT_ADMIN_ROLE') {
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }
  return keccak256(stringToBytes(name));
}

export interface FunctionGate {
  fn: string;
  gatedBy: string; // Role name or identifier
}

export interface ParseRoleCapabilitiesResult {
  roleMap: Map<string, string>; // identifier -> standard role name
  gates: FunctionGate[];
  method: 'ast_parser' | 'pattern_inspection';
}

/**
 * Parse role constant declarations and function access gates from Solidity source code.
 * Uses @solidity-parser/parser for true AST traversal with graceful pattern-inspection fallback.
 */
export function parseSolidityRoleCapabilities(sourceCode: string): ParseRoleCapabilitiesResult {
  const roleMap = new Map<string, string>();

  // Pre-seed with standard role names
  for (const name of KNOWN_ROLE_NAMES) {
    roleMap.set(name, name);
    roleMap.set(computeRoleHash(name).toLowerCase(), name);
  }

  // 1. Attempt true AST parsing via @solidity-parser/parser
  try {
    const ast = parser.parse(sourceCode, { tolerant: true, loc: false, range: false });
    const gates: FunctionGate[] = [];

    // Pass 1: Extract state variable role definitions
    parser.visit(ast, {
      StateVariableDeclaration(node: any) {
        for (const v of node.variables || []) {
          const varName = v.name;
          if (!varName) continue;

          if (node.initialValue) {
            const init = node.initialValue;
            if (init.type === 'FunctionCall' && init.expression?.name === 'keccak256') {
              const arg = init.arguments?.[0];
              const strVal = arg?.value || arg?.string || varName;
              roleMap.set(varName, strVal);
              roleMap.set(computeRoleHash(strVal).toLowerCase(), strVal);
            } else if (init.number && typeof init.number === 'string' && init.number.startsWith('0x')) {
              roleMap.set(varName, varName);
              roleMap.set(init.number.toLowerCase(), varName);
            } else if (init.value && typeof init.value === 'string' && init.value.startsWith('0x')) {
              roleMap.set(varName, varName);
              roleMap.set(init.value.toLowerCase(), varName);
            }
          }
        }
      },
    });

    // Pass 2: Extract functions and role gates from modifiers and body calls
    parser.visit(ast, {
      FunctionDefinition(node: any) {
        const fnName = node.name;
        if (!fnName) return;

        // Check modifiers: onlyRole(ROLE) or onlyRoleOrOpenRole(ROLE)
        for (const m of node.modifiers || []) {
          if (m.name === 'onlyRole' || m.name === 'onlyRoleOrOpenRole') {
            const arg = m.arguments?.[0];
            const rawRole = arg?.name || arg?.value;
            if (rawRole) {
              const resolvedRole =
                roleMap.get(String(rawRole).toLowerCase()) ||
                roleMap.get(String(rawRole)) ||
                String(rawRole);
              gates.push({ fn: fnName, gatedBy: resolvedRole });
            }
          }
        }

        // Check function body for inline _checkRole / hasRole calls
        if (node.body) {
          parser.visit(node.body, {
            FunctionCall(callNode: any) {
              const callName = callNode.expression?.name;
              if (callName === '_checkRole' || callName === 'hasRole') {
                const arg = callNode.arguments?.[0];
                const rawRole = arg?.name || arg?.value;
                if (rawRole) {
                  const resolvedRole =
                    roleMap.get(String(rawRole).toLowerCase()) ||
                    roleMap.get(String(rawRole)) ||
                    String(rawRole);
                  if (!gates.some((g) => g.fn === fnName && g.gatedBy === resolvedRole)) {
                    gates.push({ fn: fnName, gatedBy: resolvedRole });
                  }
                }
              }
            },
          });
        }
      },
    });

    if (gates.length > 0 || roleMap.size > KNOWN_ROLE_NAMES.length * 2) {
      return { roleMap, gates, method: 'ast_parser' };
    }
  } catch {
    // Fall back to regex pattern inspection if AST parser fails on partial snippet
  }

  // 2. Fallback: Pattern inspection over source code
  const fallbackGates: FunctionGate[] = [];
  const roleDefRegex =
    /bytes32\s+(?:public|private|internal)?\s*(?:constant)?\s*([a-zA-Z0-9_]+)\s*=\s*(?:keccak256\s*\(\s*["']([a-zA-Z0-9_]+)["']\s*\)|(0x[a-fA-F0-9]{64}))/g;

  let match: RegExpExecArray | null;
  while ((match = roleDefRegex.exec(sourceCode)) !== null) {
    const varName = match[1]!;
    const strLiteral = match[2];
    const hexLiteral = match[3];

    const standardName = strLiteral || varName;
    roleMap.set(varName, standardName);
    if (hexLiteral) {
      roleMap.set(hexLiteral.toLowerCase(), standardName);
    }
  }

  const fnRegex = /function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*([^{;]*)(?:\{|;)/g;

  while ((match = fnRegex.exec(sourceCode)) !== null) {
    const fnName = match[1]!;
    const modifiersAndRest = match[3]!;
    const startIndex = match.index;
    const bodySnippet = sourceCode.slice(startIndex, startIndex + 500);

    const modifierMatch = modifiersAndRest.match(
      /(?:onlyRole|onlyRoleOrOpenRole)\s*\(\s*([a-zA-Z0-9_]+|(?:0x[a-fA-F0-9]{64}))\s*\)/i
    );
    if (modifierMatch?.[1]) {
      const rawRole = modifierMatch[1];
      const resolvedRole = roleMap.get(rawRole.toLowerCase()) || roleMap.get(rawRole) || rawRole;
      fallbackGates.push({ fn: fnName, gatedBy: resolvedRole });
      continue;
    }

    const bodyCheckMatch = bodySnippet.match(
      /(?:_checkRole|hasRole)\s*\(\s*([a-zA-Z0-9_]+|(?:0x[a-fA-F0-9]{64}))/i
    );
    if (bodyCheckMatch?.[1]) {
      const rawRole = bodyCheckMatch[1];
      const resolvedRole = roleMap.get(rawRole.toLowerCase()) || roleMap.get(rawRole) || rawRole;
      fallbackGates.push({ fn: fnName, gatedBy: resolvedRole });
    }
  }

  return { roleMap, gates: fallbackGates, method: 'pattern_inspection' };
}

/**
 * Summarize function capabilities for a specific role into human-readable capability description.
 */
export function formatRoleCapabilitySummary(
  roleName: string,
  targetName: string,
  gates: FunctionGate[]
): { capabilities: FunctionGate[]; summary: string } {
  const matchingGates = gates.filter(
    (g) => g.gatedBy.toLowerCase() === roleName.toLowerCase()
  );

  const uniqueFns = Array.from(new Set(matchingGates.map((g) => g.fn)));

  if (uniqueFns.length === 0) {
    return {
      capabilities: [],
      summary: `unresolved permissions on ${targetName}`,
    };
  }

  const hasSchedule = uniqueFns.some((f) => f.toLowerCase().includes('schedule'));
  const hasCancel = uniqueFns.some((f) => f.toLowerCase().includes('cancel'));
  const hasExecute = uniqueFns.some((f) => f.toLowerCase().includes('execute'));

  let actionPhrases: string[] = [];
  if (hasSchedule && hasCancel) {
    actionPhrases.push('schedule and cancel');
  } else if (hasSchedule) {
    actionPhrases.push('schedule');
  } else if (hasCancel) {
    actionPhrases.push('cancel');
  } else if (hasExecute) {
    actionPhrases.push('execute');
  } else {
    actionPhrases.push(`call ${uniqueFns.join(', ')}`);
  }

  const summary = `can ${actionPhrases.join(' and ')} on ${targetName} (per verified source)`;
  return { capabilities: matchingGates, summary };
}

function getBlockscoutDomain(network: SupportedNetwork): string {
  return network === 'ethereum' ? 'eth.blockscout.com' : 'base.blockscout.com';
}

/**
 * Fetch verified source code for a contract from Blockscout v2 API
 */
export async function fetchContractSourceCode(
  network: SupportedNetwork,
  address: Address
): Promise<{ sourceCode?: string; contractName?: string } | null> {
  const domain = getBlockscoutDomain(network);

  const url = `https://${domain}/api/v2/smart-contracts/${address}`;
  const timeoutMs = parseInt(process.env.BLOCKSCOUT_TIMEOUT_MS || '5000', 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Callscope/1.0 (DAO Proposal Analyzer)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;

    let sourceCode = typeof data.source_code === 'string' ? data.source_code : '';
    if (!sourceCode && Array.isArray(data.additional_sources)) {
      sourceCode = data.additional_sources.map((s: any) => s.source_code || '').join('\n');
    }

    const contractName = typeof data.name === 'string' ? data.name : undefined;
    return { sourceCode: sourceCode || undefined, contractName };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve role capabilities from target contract verified source
 */
export async function resolveRoleCapabilitiesFromSource(
  network: SupportedNetwork,
  targetAddress: Address,
  targetName: string,
  roleHex: string,
  providedSourceCode?: string
): Promise<RoleCapability> {
  let source = providedSourceCode;

  if (!source) {
    const fetched = await fetchContractSourceCode(network, targetAddress);
    source = fetched?.sourceCode;
  }

  if (!source || source.trim().length === 0) {
    return {
      status: 'unresolved',
      sourceOrigin: 'unresolved',
      summary: 'capability: unresolved',
    };
  }

  try {
    const { roleMap, gates } = parseSolidityRoleCapabilities(source);
    const resolvedRoleName =
      roleMap.get(roleHex.toLowerCase()) ||
      roleMap.get(roleHex) ||
      'UNKNOWN_ROLE';

    const { capabilities, summary } = formatRoleCapabilitySummary(
      resolvedRoleName,
      targetName || 'target contract',
      gates
    );

    if (capabilities.length === 0) {
      return {
        status: 'unresolved',
        sourceOrigin: 'unresolved',
        summary: 'capability: unresolved',
      };
    }

    return {
      status: 'resolved',
      capabilities,
      summary,
      sourceOrigin: 'verified_source',
    };
  } catch {
    return {
      status: 'unresolved',
      sourceOrigin: 'unresolved',
      summary: 'capability: unresolved',
    };
  }
}

/**
 * Profile recipient address: EOA vs contract, verified status, and deployment age
 */
export async function profileRecipient(
  client: PublicClient<any, any>,
  network: SupportedNetwork,
  recipientAddress: string,
  proposalTimestamp?: number
): Promise<RecipientProfile> {
  let formattedAddr: Address;
  try {
    formattedAddr = getAddress(recipientAddress);
  } catch {
    return {
      type: 'EOA',
      summary: 'Recipient: EOA',
    };
  }

  // 1. Query bytecode on chain
  let isContract = false;
  try {
    const code = await client.getCode({ address: formattedAddr });
    isContract = Boolean(code && code !== '0x');
  } catch {
    // If getCode fails, treat as unverified
  }

  if (!isContract) {
    return {
      type: 'EOA',
      summary: 'Recipient: EOA',
    };
  }

  // 2. Query Blockscout for verification and creation info
  let isVerified = false;
  let deployedTimestamp: number | undefined;

  const domain = getBlockscoutDomain(network);
  if (domain) {
    try {
      const [scRes, addrRes] = await Promise.allSettled([
        fetch(`https://${domain}/api/v2/smart-contracts/${formattedAddr}`, {
          headers: { 'User-Agent': 'Callscope/1.0', Accept: 'application/json' },
        }).then((r) => (r.ok ? r.json() : null)),
        fetch(`https://${domain}/api/v2/addresses/${formattedAddr}`, {
          headers: { 'User-Agent': 'Callscope/1.0', Accept: 'application/json' },
        }).then((r) => (r.ok ? r.json() : null)),
      ]);

      const scData = scRes.status === 'fulfilled' ? scRes.value : null;
      const addrData = addrRes.status === 'fulfilled' ? addrRes.value : null;

      if (scData?.is_verified || scData?.source_code || scData?.abi) {
        isVerified = true;
      }
      if (addrData?.is_verified) {
        isVerified = true;
      }

      if (scData?.verified_at) {
        deployedTimestamp = Math.floor(new Date(scData.verified_at).getTime() / 1000);
      }
    } catch {
      // Keep defaults
    }
  }

  let daysBefore: number | undefined;
  let ageText = '';

  if (proposalTimestamp && deployedTimestamp && proposalTimestamp >= deployedTimestamp) {
    daysBefore = Math.floor((proposalTimestamp - deployedTimestamp) / 86400);
    ageText = daysBefore === 0 ? 'deployed on same day as proposal' : `deployed ${daysBefore} days before proposal`;
  }

  const verifiedStatus = isVerified ? 'verified' : 'unverified';
  const summaryParts = ['Recipient: contract', verifiedStatus];
  if (ageText) {
    summaryParts.push(ageText);
  }

  return {
    type: 'contract',
    isVerified,
    deployedDaysBefore: daysBefore,
    deployedTimestamp,
    summary: summaryParts.join(', '),
  };
}
