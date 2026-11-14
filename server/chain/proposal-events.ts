import {
  decodeEventLog,
  keccak256,
  toBytes,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
} from 'viem';
import type { SupportedNetwork } from './types';
import { getNetworkConfig } from './networks';

// OpenZeppelin Governor ProposalCreated ABI (Variant 1: unindexed)
export const PROPOSAL_CREATED_EVENT_UNINDEXED = {
  type: 'event',
  name: 'ProposalCreated',
  inputs: [
    { name: 'proposalId', type: 'uint256', indexed: false },
    { name: 'proposer', type: 'address', indexed: false },
    { name: 'targets', type: 'address[]', indexed: false },
    { name: 'values', type: 'uint256[]', indexed: false },
    { name: 'signatures', type: 'string[]', indexed: false },
    { name: 'calldatas', type: 'bytes[]', indexed: false },
    { name: 'voteStart', type: 'uint256', indexed: false },
    { name: 'voteEnd', type: 'uint256', indexed: false },
    { name: 'description', type: 'string', indexed: false },
  ],
} as const;

// OpenZeppelin Governor ProposalCreated ABI (Variant 2: proposalId indexed)
export const PROPOSAL_CREATED_EVENT_INDEXED_ID = {
  type: 'event',
  name: 'ProposalCreated',
  inputs: [
    { name: 'proposalId', type: 'uint256', indexed: true },
    { name: 'proposer', type: 'address', indexed: false },
    { name: 'targets', type: 'address[]', indexed: false },
    { name: 'values', type: 'uint256[]', indexed: false },
    { name: 'signatures', type: 'string[]', indexed: false },
    { name: 'calldatas', type: 'bytes[]', indexed: false },
    { name: 'voteStart', type: 'uint256', indexed: false },
    { name: 'voteEnd', type: 'uint256', indexed: false },
    { name: 'description', type: 'string', indexed: false },
  ],
} as const;

// OpenZeppelin Governor ProposalCreated ABI (Variant 3: proposalId and proposer indexed)
export const PROPOSAL_CREATED_EVENT_INDEXED_ID_PROPOSER = {
  type: 'event',
  name: 'ProposalCreated',
  inputs: [
    { name: 'proposalId', type: 'uint256', indexed: true },
    { name: 'proposer', type: 'address', indexed: true },
    { name: 'targets', type: 'address[]', indexed: false },
    { name: 'values', type: 'uint256[]', indexed: false },
    { name: 'signatures', type: 'string[]', indexed: false },
    { name: 'calldatas', type: 'bytes[]', indexed: false },
    { name: 'voteStart', type: 'uint256', indexed: false },
    { name: 'voteEnd', type: 'uint256', indexed: false },
    { name: 'description', type: 'string', indexed: false },
  ],
} as const;

// Compound-Bravo style ProposalCreated ABI (Variant 4: unindexed, with 'id', 'startBlock', 'endBlock')
export const PROPOSAL_CREATED_EVENT_COMPOUND_BRAVO = {
  type: 'event',
  name: 'ProposalCreated',
  inputs: [
    { name: 'id', type: 'uint256', indexed: false },
    { name: 'proposer', type: 'address', indexed: false },
    { name: 'targets', type: 'address[]', indexed: false },
    { name: 'values', type: 'uint256[]', indexed: false },
    { name: 'signatures', type: 'string[]', indexed: false },
    { name: 'calldatas', type: 'bytes[]', indexed: false },
    { name: 'startBlock', type: 'uint256', indexed: false },
    { name: 'endBlock', type: 'uint256', indexed: false },
    { name: 'description', type: 'string', indexed: false },
  ],
} as const;

// Compound-Bravo style ProposalCreated ABI (Variant 5: indexed id)
export const PROPOSAL_CREATED_EVENT_COMPOUND_BRAVO_INDEXED_ID = {
  type: 'event',
  name: 'ProposalCreated',
  inputs: [
    { name: 'id', type: 'uint256', indexed: true },
    { name: 'proposer', type: 'address', indexed: false },
    { name: 'targets', type: 'address[]', indexed: false },
    { name: 'values', type: 'uint256[]', indexed: false },
    { name: 'signatures', type: 'string[]', indexed: false },
    { name: 'calldatas', type: 'bytes[]', indexed: false },
    { name: 'startBlock', type: 'uint256', indexed: false },
    { name: 'endBlock', type: 'uint256', indexed: false },
    { name: 'description', type: 'string', indexed: false },
  ],
} as const;

export const PROPOSAL_CREATED_TOPIC0 = keccak256(
  toBytes('ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)')
);

export const SUPPORTED_EVENT_VARIANTS = [
  PROPOSAL_CREATED_EVENT_UNINDEXED,
  PROPOSAL_CREATED_EVENT_INDEXED_ID,
  PROPOSAL_CREATED_EVENT_INDEXED_ID_PROPOSER,
  PROPOSAL_CREATED_EVENT_COMPOUND_BRAVO,
  PROPOSAL_CREATED_EVENT_COMPOUND_BRAVO_INDEXED_ID,
] as const;

export const PROPOSAL_STATE_MAP: Record<number, string> = {
  0: 'Pending',
  1: 'Active',
  2: 'Canceled',
  3: 'Defeated',
  4: 'Succeeded',
  5: 'Queued',
  6: 'Expired',
  7: 'Executed',
};

export interface DecodedProposalEvent {
  proposalId: string;
  proposer: Address;
  targets: readonly Address[];
  values: readonly bigint[];
  signatures: readonly string[];
  calldatas: readonly Hex[];
  voteStart: bigint;
  voteEnd: bigint;
  description: string;
  transactionHash: Hex;
  blockNumber: bigint;
}

export class ProposalNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalNotFoundError';
  }
}

/**
 * Verify whether a proposal exists on the Governor contract.
 * Fails fast (< 5s) via proposalSnapshot / state on-chain checks before log retrieval.
 */
export async function verifyProposalExistsOnGovernor(
  client: PublicClient<any, any>,
  governorAddress: Address,
  proposalId: string
): Promise<boolean> {
  let idBigInt: bigint;
  try {
    idBigInt = BigInt(proposalId);
  } catch {
    return false;
  }

  // 1. Try proposalSnapshot(uint256) (standard OpenZeppelin Governor)
  try {
    const snapshot = await client.readContract({
      address: governorAddress,
      abi: [
        {
          name: 'proposalSnapshot',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'proposalId', type: 'uint256' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'proposalSnapshot',
      args: [idBigInt],
    });
    if (snapshot > 0n) return true;
    return false;
  } catch {
    // proposalSnapshot reverted or is not supported (e.g. Compound Bravo)
  }

  // 2. Try state(uint256) (supported by both OZ Governor and Compound Bravo)
  try {
    const state = await client.readContract({
      address: governorAddress,
      abi: [
        {
          name: 'state',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'proposalId', type: 'uint256' }],
          outputs: [{ name: '', type: 'uint8' }],
        },
      ],
      functionName: 'state',
      args: [idBigInt],
    });
    return typeof state === 'number' || typeof state === 'bigint';
  } catch {
    // Both proposalSnapshot and state reverted -> proposal does not exist
    return false;
  }
}

export function parseProposalCreatedLog(
  log: Log,
  expectedProposalId?: string
): DecodedProposalEvent | null {
  for (const eventAbi of SUPPORTED_EVENT_VARIANTS) {
    try {
      const decoded = decodeEventLog({
        abi: [eventAbi],
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName !== 'ProposalCreated') {
        continue;
      }

      const args = decoded.args as any;
      const decodedId = (args.proposalId ?? args.id)?.toString();

      if (!decodedId) continue;

      if (!expectedProposalId || decodedId === expectedProposalId) {
        const targets = (args.targets || []) as readonly Address[];
        const values = (args.values || []) as readonly bigint[];
        const signatures = (args.signatures || []) as readonly string[];
        const calldatas = (args.calldatas || []) as readonly Hex[];

        if (
          !Array.isArray(targets) ||
          !Array.isArray(values) ||
          !Array.isArray(signatures) ||
          !Array.isArray(calldatas)
        ) {
          throw new Error('Malformed ProposalCreated event: action properties must be arrays');
        }

        if (
          targets.length !== values.length ||
          targets.length !== signatures.length ||
          targets.length !== calldatas.length
        ) {
          throw new Error(
            `Malformed ProposalCreated event: action array length mismatch (targets: ${targets.length}, values: ${values.length}, signatures: ${signatures.length}, calldatas: ${calldatas.length})`
          );
        }

        return {
          proposalId: decodedId,
          proposer: args.proposer,
          targets,
          values,
          signatures,
          calldatas,
          voteStart: args.voteStart ?? args.startBlock ?? 0n,
          voteEnd: args.voteEnd ?? args.endBlock ?? 0n,
          description: args.description ?? '',
          transactionHash: (log.transactionHash || '0x') as Hex,
          blockNumber: log.blockNumber ?? 0n,
        };
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('Malformed ProposalCreated')) {
        throw err;
      }
    }
  }

  return null;
}

/**
 * Extract clean 32-byte 0x transaction hash from user input (raw hash or explorer URL)
 */
export function extractTransactionHash(input?: string): Hex | null {
  if (!input || typeof input !== 'string') return null;
  const match = input.trim().match(/0x[a-fA-F0-9]{64}/);
  return match ? (match[0].toLowerCase() as Hex) : null;
}

/**
 * Resolve ProposalCreated event directly from a creation transaction receipt
 */
export async function retrieveEventFromCreationTx(
  client: PublicClient<any, any>,
  governorAddress: Address,
  txHash: Hex,
  expectedProposalId?: string
): Promise<DecodedProposalEvent> {
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (!receipt) {
    throw new Error(`Transaction receipt not found for hash ${txHash}`);
  }

  const governorLower = governorAddress.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === governorLower) {
      const parsed = parseProposalCreatedLog(log, expectedProposalId);
      if (parsed) {
        return parsed;
      }
    }
  }

  throw new Error(
    `No ProposalCreated log for Governor ${governorAddress} found in transaction ${txHash}`
  );
}

/**
 * Fetch logs using Blockscout explorer API (single call, filtered by address + topic0, 8s timeout, 1 retry)
 */
async function fetchLogsFromBlockscout(
  network: SupportedNetwork,
  governorAddress: Address
): Promise<Log[]> {
  const config = getNetworkConfig(network);
  const url = `${config.blockscoutApiUrl}?module=logs&action=getLogs&address=${governorAddress}&fromBlock=0&toBlock=latest&topic0=${PROPOSAL_CREATED_TOPIC0}`;

  const attemptFetch = async (): Promise<Log[]> => {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Callscope/1.0 (DAO Proposal Analyzer)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      throw new Error(`Blockscout API HTTP error ${res.status}`);
    }

    const json = (await res.json()) as any;
    if (!json || json.status === '0' || !Array.isArray(json.result)) {
      return [];
    }

    return json.result.map((item: any) => ({
      address: item.address,
      blockHash: item.blockHash,
      blockNumber: BigInt(item.blockNumber),
      data: item.data,
      logIndex: Number(item.logIndex),
      removed: false,
      topics: [item.topics[0], item.topics[1], item.topics[2], item.topics[3]].filter(Boolean),
      transactionHash: item.transactionHash,
      transactionIndex: Number(item.transactionIndex),
    })) as Log[];
  };

  try {
    return await attemptFetch();
  } catch {
    // 1 retry on transport failure
    try {
      return await attemptFetch();
    } catch {
      return [];
    }
  }
}

/**
 * Bounded RPC adaptive log retrieval when provider rejects full range
 * Maximum budget: 10 requests, 8 seconds. Never guesses creation block.
 */
async function fetchLogsAdaptiveBoundedRpc(
  client: PublicClient<any, any>,
  governorAddress: Address,
  cleanId: string
): Promise<DecodedProposalEvent | null> {
  const MAX_REQUESTS = 10;
  const MAX_DURATION_MS = 8_000;
  const CHUNK_SIZE = 100_000n;
  const startTime = Date.now();

  let latestBlock: bigint;
  try {
    latestBlock = await client.getBlockNumber();
  } catch {
    return null;
  }

  let toBlock = latestBlock;
  let requestsMade = 0;

  while (toBlock > 0n && requestsMade < MAX_REQUESTS && Date.now() - startTime < MAX_DURATION_MS) {
    const fromBlock = toBlock > CHUNK_SIZE ? toBlock - CHUNK_SIZE : 0n;
    requestsMade++;

    try {
      const logs = await client.getLogs({
        address: governorAddress,
        event: PROPOSAL_CREATED_EVENT_UNINDEXED,
        fromBlock,
        toBlock,
      } as any);

      for (const log of logs) {
        const parsed = parseProposalCreatedLog(log, cleanId);
        if (parsed) {
          return parsed;
        }
      }
    } catch {
      // Chunk failed or too wide, stop this branch
      break;
    }

    if (fromBlock === 0n) break;
    toBlock = fromBlock - 1n;
  }

  return null;
}

export async function retrieveProposalCreatedEvent(
  client: PublicClient<any, any>,
  network: SupportedNetwork,
  governorAddress: Address,
  proposalId: string,
  creationTxHashOrUrl?: string
): Promise<DecodedProposalEvent> {
  const cleanId = proposalId.trim();

  // 0. If user provided a creation tx hash or URL, resolve directly from receipt
  const directTxHash = extractTransactionHash(creationTxHashOrUrl);
  if (directTxHash) {
    try {
      return await retrieveEventFromCreationTx(client, governorAddress, directTxHash, cleanId);
    } catch (err: unknown) {
      // If direct receipt failed, proceed to standard lookup order
    }
  }

  // 1. Fail fast on nonexistent proposal (< 5s check, no scanning)
  const proposalExists = await verifyProposalExistsOnGovernor(client, governorAddress, cleanId);
  if (!proposalExists) {
    throw new ProposalNotFoundError(
      `Proposal ${cleanId} not found on Governor ${governorAddress} (proposalSnapshot/state returned 0 or reverted).`
    );
  }

  // 2. Lookup Order (a): Blockscout API getLogs with local matching
  let matchingEvent: DecodedProposalEvent | null = null;
  try {
    const blockscoutLogs = await fetchLogsFromBlockscout(network, governorAddress);
    for (const log of blockscoutLogs) {
      const parsed = parseProposalCreatedLog(log, cleanId);
      if (parsed) {
        if (matchingEvent && matchingEvent.transactionHash !== parsed.transactionHash) {
          throw new Error(
            `Ambiguous event: multiple conflicting ProposalCreated logs found for proposal ID ${cleanId}`
          );
        }
        matchingEvent = parsed;
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('Ambiguous event')) {
      throw err;
    }
  }

  if (matchingEvent) {
    return matchingEvent;
  }

  // 3. Lookup Order (b): Single full-range address+topic-filtered eth_getLogs over configured RPC
  let rpcRangeRejected = false;
  try {
    const rpcLogs = await client.getLogs({
      address: governorAddress,
      event: PROPOSAL_CREATED_EVENT_UNINDEXED,
      fromBlock: 0n,
      toBlock: 'latest',
    } as any);

    for (const log of rpcLogs) {
      const parsed = parseProposalCreatedLog(log, cleanId);
      if (parsed) {
        if (matchingEvent && matchingEvent.transactionHash !== parsed.transactionHash) {
          throw new Error(
            `Ambiguous event: multiple conflicting ProposalCreated logs found for proposal ID ${cleanId}`
          );
        }
        matchingEvent = parsed;
      }
    }
  } catch {
    // Provider rejected full range (e.g. range too wide, query limit exceeded)
    rpcRangeRejected = true;
  }

  if (matchingEvent) {
    return matchingEvent;
  }

  // 4. Lookup Order (c): If provider rejected full range, adaptive range splitting with fixed scan budget
  if (rpcRangeRejected) {
    const adaptiveResult = await fetchLogsAdaptiveBoundedRpc(client, governorAddress, cleanId);
    if (adaptiveResult) {
      return adaptiveResult;
    }
  }

  throw new Error(
    `ProposalCreated event not found for proposal ID ${cleanId} on Governor ${governorAddress}`
  );
}

export async function readGovernorProposalState(
  client: PublicClient<any, any>,
  governorAddress: Address,
  proposalId: string
): Promise<string> {
  try {
    const stateNum = await client.readContract({
      address: governorAddress,
      abi: [
        {
          name: 'state',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'proposalId', type: 'uint256' }],
          outputs: [{ name: '', type: 'uint8' }],
        },
      ],
      functionName: 'state',
      args: [BigInt(proposalId)],
    });

    return PROPOSAL_STATE_MAP[Number(stateNum)] ?? 'Unknown';
  } catch {
    return 'Unknown';
  }
}
