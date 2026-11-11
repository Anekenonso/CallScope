import {
  type Address,
  type Hex,
  type PublicClient,
  type AbiFunction,
  getAddress,
  parseAbiItem,
  toFunctionSelector,
  decodeFunctionData,
  concatHex,
  formatEther,
} from 'viem';
import type {
  SupportedNetwork,
  ProposalAction,
  DecodedArg,
} from '../../src/types/analysis';
import { resolveContractAbi, type ResolvedAbiResult } from './resolve-abi';
import { resolveTokenMetadata, formatTokenAmount, type TokenMetadata } from './token-metadata';

export interface DecodeActionsInput {
  network: SupportedNetwork;
  targets: readonly Address[];
  values: readonly bigint[];
  signatures: readonly string[];
  calldatas: readonly Hex[];
  client: PublicClient<any, any>;
}

export interface DecodeActionsResult {
  actions: ProposalAction[];
  limitations: string[];
}

export function formatArgValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'bigint') {
    return val.toString();
  }
  if (typeof val === 'string') {
    return val;
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (Array.isArray(val)) {
    return `[${val.map(formatArgValue).join(', ')}]`;
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    } catch {
      return '[Complex Object]';
    }
  }
  return String(val);
}

/**
 * Format decoded function args into structured DecodedArg array
 */
function mapDecodedArgs(
  abiFunction: AbiFunction,
  args: readonly unknown[] | Record<string, unknown> | undefined
): DecodedArg[] {
  if (!args || !abiFunction.inputs) {
    return [];
  }

  const result: DecodedArg[] = [];
  const argsList = Array.isArray(args) ? args : Object.values(args);

  for (let i = 0; i < abiFunction.inputs.length; i++) {
    const input = abiFunction.inputs[i];
    const val = argsList[i];
    result.push({
      name: input?.name || `arg${i}`,
      type: input?.type || 'unknown',
      value: formatArgValue(val),
    });
  }

  return result;
}

/**
 * Attempt to decode calldata using legacy signature string
 */
function decodeLegacySignature(
  rawSignature: string,
  rawCalldata: Hex
): { functionName: string; selector: string; args: DecodedArg[] } | null {
  const cleanSig = rawSignature.trim().replace(/^function\s+/, '');
  if (!cleanSig) {
    return null;
  }

  try {
    const abiItem = parseAbiItem(`function ${cleanSig}`) as AbiFunction;
    const selector = toFunctionSelector(abiItem);

    // If calldata already includes the selector, use as is; otherwise prepend selector
    let fullCalldata: Hex;
    if (rawCalldata.toLowerCase().startsWith(selector.toLowerCase())) {
      fullCalldata = rawCalldata;
    } else {
      fullCalldata = concatHex([selector, rawCalldata]);
    }

    const decoded = decodeFunctionData({
      abi: [abiItem],
      data: fullCalldata,
    });

    const args = mapDecodedArgs(abiItem, decoded.args as any);

    return {
      functionName: decoded.functionName,
      selector,
      args,
    };
  } catch {
    return null;
  }
}

/**
 * Decode all actions from a proposal, retaining order and preserving raw evidence
 */
export async function decodeProposalActions(
  input: DecodeActionsInput
): Promise<DecodeActionsResult> {
  const { network, targets, values, signatures, calldatas, client } = input;

  // Validate array lengths
  if (
    targets.length !== values.length ||
    targets.length !== signatures.length ||
    targets.length !== calldatas.length
  ) {
    throw new Error(
      `Malformed proposal action arrays: lengths do not match (targets: ${targets.length}, values: ${values.length}, signatures: ${signatures.length}, calldatas: ${calldatas.length})`
    );
  }

  const actions: ProposalAction[] = [];
  const limitations: string[] = [];
  const abiCache = new Map<string, ResolvedAbiResult>();
  const tokenCache = new Map<string, TokenMetadata>();

  for (let i = 0; i < targets.length; i++) {
    const rawTarget = targets[i]!;
    const rawValue = values[i]!.toString();
    const rawSignature = signatures[i] || '';
    const rawCalldata = calldatas[i] || '0x';

    let targetAddress: string;
    try {
      targetAddress = getAddress(rawTarget);
    } catch {
      targetAddress = rawTarget;
    }

    // Determine 4-byte selector
    let selector = '0x';
    if (rawCalldata && rawCalldata.length >= 10) {
      selector = rawCalldata.slice(0, 10).toLowerCase();
    }

    // Base action template preserving raw data
    const action: ProposalAction = {
      index: i,
      target: targetAddress,
      value: rawValue,
      signature: rawSignature,
      selector,
      decoded: false,
      rawCalldata,
    };

    const hasEmptyCalldata = !rawCalldata || rawCalldata === '0x' || rawCalldata.trim() === '';
    const hasNativeValue = rawValue !== '0';

    // A. Native ETH transfers: non-zero value and empty calldata recognized as direct transfer
    if (hasEmptyCalldata && hasNativeValue) {
      const ethFormatted = `${formatEther(BigInt(rawValue))} ETH`;
      action.decoded = true;
      action.functionName = 'transfer';
      action.selector = '0x';
      action.signature = 'transfer(address,uint256)';
      action.isNativeTransfer = true;
      action.targetName = action.targetName || 'Recipient';
      action.formattedAmount = ethFormatted;
      action.tokenDecimals = 18;
      action.tokenSymbol = 'ETH';
      action.args = [
        {
          name: 'recipient',
          type: 'address',
          value: targetAddress,
        },
        {
          name: 'amount',
          type: 'uint256',
          value: rawValue,
          formattedValue: ethFormatted,
          rawAmount: rawValue,
          decimals: 18,
          symbol: 'ETH',
        },
      ];
      actions.push(action);
      continue;
    }

    // E. Safe Transaction Wrapper (execTransaction selector: 0x6a761202)
    if (selector === '0x6a761202') {
      action.decoded = false;
      action.isSafeWrapper = true;
      action.functionName = 'execTransaction (Safe Transaction Wrapper)';
      action.selector = '0x6a761202';
      action.signature =
        'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)';
      action.decodeError =
        'Safe execTransaction wrapper detected (0x6a761202). Nested inner calls cannot be inspected; analysis is opaque.';
      const safeLimitation = `Action #${i + 1} to ${targetAddress}: Executes via Safe wrapper (0x6a761202). Inner payload calls are opaque and cannot be inspected; analysis is marked incomplete.`;
      action.limitations = [safeLimitation];
      limitations.push(safeLimitation);
      actions.push(action);
      continue;
    }

    // 1. Try legacy signature decoding if signature string is present
    if (rawSignature.trim() !== '') {
      const legacyResult = decodeLegacySignature(rawSignature, rawCalldata);
      if (legacyResult) {
        action.decoded = true;
        action.functionName = legacyResult.functionName;
        action.selector = legacyResult.selector;
        action.args = legacyResult.args;
        await enrichTokenAmountMetadata(action, network, targetAddress as Address, client, tokenCache);
        actions.push(action);
        continue;
      }
    }

    // 2. If no valid signature or signature decoding failed, attempt verified ABI resolution
    try {
      const resolved = await resolveContractAbi(network, targetAddress, client, abiCache);

      if (resolved.contractName) {
        action.targetName = resolved.contractName;
      }
      if (resolved.isProxy) {
        action.isProxy = true;
        action.implementation = resolved.implementationAddress;
      }

      if (resolved.abi) {
        try {
          const decoded = decodeFunctionData({
            abi: resolved.abi,
            data: rawCalldata,
          });

          // Find matching ABI function definition for typed argument names
          const abiFn = resolved.abi.find(
            (item) => item.type === 'function' && item.name === decoded.functionName
          ) as AbiFunction | undefined;

          action.decoded = true;
          action.functionName = decoded.functionName;
          action.args = abiFn
            ? mapDecodedArgs(abiFn, decoded.args as any)
            : [];
          await enrichTokenAmountMetadata(action, network, targetAddress as Address, client, tokenCache);
          actions.push(action);
          continue;
        } catch (decodeErr: any) {
          action.decodeError = `Selector ${selector} could not be decoded with verified ABI: ${decodeErr.message}`;
          limitations.push(
            `Action #${i + 1} to ${targetAddress}: Function selector ${selector} not found in verified ABI.`
          );
        }
      } else {
        action.decodeError = resolved.error || `Verified ABI unavailable for target ${targetAddress}`;
        limitations.push(
          `Action #${i + 1} to ${targetAddress}: Verified contract ABI unavailable; raw calldata preserved.`
        );
      }
    } catch (err: any) {
      action.decodeError = `Target ABI resolution error: ${err.message}`;
      limitations.push(
        `Action #${i + 1} to ${targetAddress}: ABI resolution failed (${err.message}).`
      );
    }

    // If reached here, action was not successfully decoded
    actions.push(action);
  }

  return { actions, limitations };
}

async function enrichTokenAmountMetadata(
  action: ProposalAction,
  network: SupportedNetwork,
  targetAddress: Address,
  client: PublicClient<any, any>,
  tokenCache: Map<string, TokenMetadata>
): Promise<void> {
  const fn = (action.functionName || '').toLowerCase();
  if (fn !== 'transfer' && fn !== 'transferfrom' && fn !== 'approve') {
    return;
  }

  let amountArg: DecodedArg | undefined;
  if (fn === 'transfer' || fn === 'approve') {
    amountArg =
      action.args?.find(
        (a) => a.name.toLowerCase() === 'amount' || a.name.toLowerCase() === 'value'
      ) || action.args?.[1];
  } else if (fn === 'transferfrom') {
    amountArg =
      action.args?.find(
        (a) => a.name.toLowerCase() === 'amount' || a.name.toLowerCase() === 'value'
      ) || action.args?.[2];
  }

  if (!amountArg || !amountArg.value) {
    return;
  }

  amountArg.rawAmount = amountArg.value;

  const meta = await resolveTokenMetadata(network, targetAddress, client, tokenCache);

  if (meta.verified && meta.decimals !== undefined) {
    amountArg.decimals = meta.decimals;
    amountArg.symbol = meta.symbol;
    action.tokenDecimals = meta.decimals;
    action.tokenSymbol = meta.symbol;

    const formatted = formatTokenAmount(amountArg.value, meta.decimals, meta.symbol);
    if (formatted.formatted) {
      amountArg.formattedValue = formatted.formatted;
      action.formattedAmount = formatted.formatted;
    }
  } else {
    amountArg.decimalsUnavailable = true;
    action.decimalsUnavailable = true;
  }
}
