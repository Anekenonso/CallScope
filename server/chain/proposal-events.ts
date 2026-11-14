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
import { getPinnedSnapshot } from './pinned-snapshots';

export { getPinnedSnapshot };

// Standard OpenZeppelin Governor ProposalCreated ABI (Variant 1: unindexed)
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

// Variant 2: proposalId indexed
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

// Variant 3: proposalId and proposer indexed
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

export const PROPOSAL_CREATED_TOPIC0 = keccak256(
  toBytes('ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)')
);

export const SUPPORTED_EVENT_VARIANTS = [
  PROPOSAL_CREATED_EVENT_UNINDEXED,
  PROPOSAL_CREATED_EVENT_INDEXED_ID,
  PROPOSAL_CREATED_EVENT_INDEXED_ID_PROPOSER,
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

export function parseProposalCreatedLog(
  log: Log,
  expectedProposalId: string,
  expectedGovernorAddress?: Address
): DecodedProposalEvent | null {
  if (
    expectedGovernorAddress &&
    log.address &&
    log.address.toLowerCase() !== expectedGovernorAddress.toLowerCase()
  ) {
    return null;
  }

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
      const decodedId = args.proposalId?.toString();

      if (decodedId === expectedProposalId) {
        // Validate array lengths
        const targets = args.targets as readonly Address[];
        const values = args.values as readonly bigint[];
        const signatures = args.signatures as readonly string[];
        const calldatas = args.calldatas as readonly Hex[];

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
          voteStart: args.voteStart ?? 0n,
          voteEnd: args.voteEnd ?? 0n,
          description: args.description ?? '',
          transactionHash: log.transactionHash as Hex,
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
 * Fetch logs using Blockscout explorer API with pagination support
 */
async function fetchProposalEventFromBlockscout(
  network: SupportedNetwork,
  governorAddress: Address,
  expectedProposalId: string
): Promise<DecodedProposalEvent | null> {
  const config = getNetworkConfig(network);
  const pageSize = 1000;
  const maxPages = 5;
  const timeoutMs = process.env.BLOCKSCOUT_TIMEOUT_MS
    ? parseInt(process.env.BLOCKSCOUT_TIMEOUT_MS, 10)
    : 5_000;

  let matchingEvent: DecodedProposalEvent | null = null;

  for (let page = 1; page <= maxPages; page++) {
    const url = `${config.blockscoutApiUrl}?module=logs&action=getLogs&address=${governorAddress}&fromBlock=0&toBlock=latest&topic0=${PROPOSAL_CREATED_TOPIC0}&page=${page}&offset=${pageSize}`;

    let json: any = null;
    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Callscope/1.0 (DAO Proposal Analyzer)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!res.ok) {
          if (attempts < 2) continue;
          break;
        }

        json = (await res.json()) as any;
        break;
      } catch (err) {
        if (attempts >= 2) break;
      }
    }

    if (!json || json.status === '0' || !Array.isArray(json.result) || json.result.length === 0) {
      break;
    }

    for (const item of json.result) {
      if (item.address && item.address.toLowerCase() !== governorAddress.toLowerCase()) {
        continue;
      }

      const log: Log = {
        address: item.address,
        blockHash: item.blockHash,
        blockNumber: BigInt(item.blockNumber),
        data: item.data,
        logIndex: Number(item.logIndex),
        removed: false,
        topics: item.topics.filter(Boolean) as unknown as [`0x${string}`, ...`0x${string}`[]],
        transactionHash: item.transactionHash,
        transactionIndex: Number(item.transactionIndex),
      };

      const parsed = parseProposalCreatedLog(log, expectedProposalId, governorAddress);
      if (parsed) {
        if (matchingEvent && matchingEvent.transactionHash !== parsed.transactionHash) {
          throw new Error(
            `Ambiguous event: multiple conflicting ProposalCreated logs found for proposal ID ${expectedProposalId}`
          );
        }
        matchingEvent = parsed;
      }
    }

    if (matchingEvent) {
      return matchingEvent;
    }

    if (json.result.length < pageSize) {
      break;
    }
  }

  return matchingEvent;
}

/**
 * Read proposal snapshot block or timestamp from Governor contract if supported
 */
async function queryGovernorSnapshotValue(
  client: PublicClient<any, any>,
  governorAddress: Address,
  proposalId: string
): Promise<bigint | null> {
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
      args: [BigInt(proposalId)],
    });

    const val = BigInt(snapshot as any);
    return val > 0n ? val : null;
  } catch {
    return null;
  }
}

/**
 * Read governor votingDelay from contract if supported
 */
async function queryGovernorVotingDelay(
  client: PublicClient<any, any>,
  governorAddress: Address
): Promise<bigint | null> {
  try {
    const delay = await client.readContract({
      address: governorAddress,
      abi: [
        {
          name: 'votingDelay',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'votingDelay',
    });
    return BigInt(delay as any);
  } catch {
    return null;
  }
}

/**
 * Monotonic interpolation search for an approximate block matching targetTimestamp.
 * Handles non-linear block time shifts (e.g. Base Flashblocks rollout) and avoids
 * requesting blocks deeper than standard public RPC retention depths.
 */
async function estimateBlockFromTimestamp(
  client: PublicClient<any, any>,
  targetTimestamp: bigint,
  latestBlock: bigint
): Promise<bigint> {
  try {
    const latestBlockData = await client.getBlock({ blockTag: 'latest' });
    let high = latestBlockData.number;
    let highTs = latestBlockData.timestamp;
    if (targetTimestamp >= highTs) return high;

    // Anchor lower search bound: try ~5M blocks back, falling back to ~1.5M if archive depth is restricted
    let low = high > 5_000_000n ? high - 5_000_000n : 1n;
    let lowTs = 0n;
    try {
      const lowBlock = await client.getBlock({ blockNumber: low });
      lowTs = lowBlock.timestamp;
    } catch {
      low = high > 1_500_000n ? high - 1_500_000n : 1n;
      const lowBlock = await client.getBlock({ blockNumber: low });
      lowTs = lowBlock.timestamp;
    }

    if (targetTimestamp <= lowTs) return low;

    let currentMid = (low + high) / 2n;
    for (let i = 0; i < 5; i++) {
      if (highTs <= lowTs || high <= low) break;
      const rawFrac = Number(targetTimestamp - lowTs) / Number(highTs - lowTs);
      const frac = Math.max(0.01, Math.min(0.99, rawFrac));
      const range = high - low;
      const step = BigInt(Math.max(1, Math.min(Number(range - 1n), Math.floor(Number(range) * frac))));
      currentMid = low + step;
      try {
        const midBlock = await client.getBlock({ blockNumber: currentMid });
        if (midBlock.timestamp < targetTimestamp) {
          low = currentMid;
          lowTs = midBlock.timestamp;
        } else if (midBlock.timestamp > targetTimestamp) {
          high = currentMid;
          highTs = midBlock.timestamp;
        } else {
          return currentMid;
        }
        if (high - low <= 1_000n) return currentMid;
      } catch {
        break;
      }
    }
    return currentMid;
  } catch {
    return latestBlock;
  }
}

/**
 * Fetch logs using RPC with adaptive bounded range scanning and contract snapshot targeting.
 * Handles both block-based and timestamp-based snapshot timepoints across Ethereum and Base.
 */
async function fetchProposalEventFromRpc(
  client: PublicClient<any, any>,
  network: SupportedNetwork,
  governorAddress: Address,
  expectedProposalId: string
): Promise<DecodedProposalEvent | null> {
  const latestBlock = await client.getBlockNumber();
  let matchingEvent: DecodedProposalEvent | null = null;

  // 1. If contract supports proposalSnapshot(), target the exact creation window
  const snapshotVal = await queryGovernorSnapshotValue(client, governorAddress, expectedProposalId);
  if (snapshotVal !== null) {
    const votingDelay = await queryGovernorVotingDelay(client, governorAddress);
    // In OpenZeppelin Governor: snapshot = creation_timepoint + votingDelay
    // So creation_timepoint = snapshot - votingDelay
    const creationTimepoint =
      votingDelay !== null && snapshotVal > votingDelay ? snapshotVal - votingDelay : snapshotVal;

    let targetBlock: bigint;

    if (creationTimepoint < 500_000_000n) {
      // Direct block number (e.g. Ethereum Mainnet)
      targetBlock = creationTimepoint <= latestBlock ? creationTimepoint : latestBlock;
    } else {
      // Timestamp (e.g. Base L2 with timestamp timepoints)
      targetBlock = await estimateBlockFromTimestamp(client, creationTimepoint, latestBlock);
    }

    // Concentric search rings around targetBlock using <= 9,900 block chunks (safe for all RPCs)
    const rings: [bigint, bigint][] = [
      // Ring 0: immediate target (within ±5,000 blocks)
      [
        targetBlock > 5_000n ? targetBlock - 5_000n : 0n,
        targetBlock + 5_000n <= latestBlock ? targetBlock + 5_000n : latestBlock,
      ],
      // Ring 1: slightly wider backward & forward
      [
        targetBlock > 14_900n ? targetBlock - 14_900n : 0n,
        targetBlock > 5_001n ? targetBlock - 5_001n : 0n,
      ],
      [
        targetBlock + 5_001n <= latestBlock ? targetBlock + 5_001n : latestBlock,
        targetBlock + 14_900n <= latestBlock ? targetBlock + 14_900n : latestBlock,
      ],
      // Ring 2: wider margin
      [
        targetBlock > 24_800n ? targetBlock - 24_800n : 0n,
        targetBlock > 14_901n ? targetBlock - 14_901n : 0n,
      ],
      [
        targetBlock + 14_901n <= latestBlock ? targetBlock + 14_901n : latestBlock,
        targetBlock + 24_800n <= latestBlock ? targetBlock + 24_800n : latestBlock,
      ],
    ];

    for (const [fromBlock, toBlock] of rings) {
      if (fromBlock >= toBlock) continue;
      try {
        const logs = await (client as any).getLogs({
          address: governorAddress,
          topics: [PROPOSAL_CREATED_TOPIC0],
          fromBlock,
          toBlock,
        });

        for (const log of logs) {
          const parsed = parseProposalCreatedLog(log, expectedProposalId, governorAddress);
          if (parsed) {
            if (matchingEvent && matchingEvent.transactionHash !== parsed.transactionHash) {
              throw new Error(
                `Ambiguous event: multiple conflicting ProposalCreated logs found for proposal ID ${expectedProposalId}`
              );
            }
            matchingEvent = parsed;
          }
        }
      } catch {
        // Continue to next ring
      }

      if (matchingEvent) return matchingEvent;
    }

    // If votingDelay was unknown/reverted, also search backwards towards windowStart in 9,900-block chunks
    if (votingDelay === null || votingDelay === 0n) {
      const lookback = network === 'base' ? 650_000n : 60_000n;
      const windowStart = targetBlock > lookback ? targetBlock - lookback : 0n;
      let bTo = targetBlock > 25_000n ? targetBlock - 25_000n : 0n;
      const chunkSize = 9_900n;

      while (bTo > windowStart) {
        const bFrom = bTo > chunkSize ? bTo - chunkSize : 0n;
        try {
          const logs = await (client as any).getLogs({
            address: governorAddress,
            topics: [PROPOSAL_CREATED_TOPIC0],
            fromBlock: bFrom,
            toBlock: bTo,
          });

          for (const log of logs) {
            const parsed = parseProposalCreatedLog(log, expectedProposalId, governorAddress);
            if (parsed) {
              if (matchingEvent && matchingEvent.transactionHash !== parsed.transactionHash) {
                throw new Error(
                  `Ambiguous event: multiple conflicting ProposalCreated logs found for proposal ID ${expectedProposalId}`
                );
              }
              matchingEvent = parsed;
            }
          }
        } catch {
          // Continue searching
        }

        if (matchingEvent) return matchingEvent;
        if (bFrom === 0n || bFrom <= windowStart) break;
        bTo = bFrom - 1n;
      }
    }
  }

  // 2. Adaptive backward scanning with dynamic chunk sizing as general fallback
  let chunkSize = 9_900n;
  const minChunkSize = 2_000n;
  const maxScanDepth = network === 'base' ? 1_500_000n : 500_000n;
  const lowestAllowedBlock = latestBlock > maxScanDepth ? latestBlock - maxScanDepth : 0n;
  let currentToBlock = latestBlock;

  while (currentToBlock > lowestAllowedBlock) {
    const fromBlock = currentToBlock > chunkSize ? currentToBlock - chunkSize : 0n;

    try {
      const logs = await (client as any).getLogs({
        address: governorAddress,
        topics: [PROPOSAL_CREATED_TOPIC0],
        fromBlock,
        toBlock: currentToBlock,
      });

      for (const log of logs) {
        const parsed = parseProposalCreatedLog(log, expectedProposalId, governorAddress);
        if (parsed) {
          if (matchingEvent && matchingEvent.transactionHash !== parsed.transactionHash) {
            throw new Error(
              `Ambiguous event: multiple conflicting ProposalCreated logs found for proposal ID ${expectedProposalId}`
            );
          }
          matchingEvent = parsed;
        }
      }

      if (matchingEvent) return matchingEvent;

      if (fromBlock === 0n || fromBlock <= lowestAllowedBlock) break;
      currentToBlock = fromBlock - 1n;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('Ambiguous event')) {
        throw err;
      }
      // If RPC rejected range, adaptively halve chunk size and retry
      if (chunkSize > minChunkSize) {
        chunkSize = chunkSize / 2n;
        continue;
      } else {
        if (fromBlock === 0n) break;
        currentToBlock = fromBlock - 1n;
      }
    }
  }

  return matchingEvent;
}

export class ProposalEventLookupError extends Error {
  readonly stage = 'event_lookup' as const;
  readonly via: 'blockscout' | 'rpc';
  readonly reason: 'timeout' | 'range_rejected' | 'rate_limited' | 'not_found';
  readonly detail: string;

  constructor(options: {
    message: string;
    via: 'blockscout' | 'rpc';
    reason: 'timeout' | 'range_rejected' | 'rate_limited' | 'not_found';
    detail: string;
  }) {
    super(options.message);
    this.name = 'ProposalEventLookupError';
    this.via = options.via;
    this.reason = options.reason;
    this.detail = options.detail;
  }
}

export interface ProposalFromTxResult {
  event: DecodedProposalEvent;
  governorAddress: Address;
  proposalId: string;
}

export async function retrieveProposalEventFromTxHash(
  client: PublicClient<any, any>,
  txHash: Hex
): Promise<ProposalFromTxResult> {
  let receipt: any;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ProposalEventLookupError({
      message: `Failed to fetch transaction receipt for ${txHash}`,
      via: 'rpc',
      reason: 'not_found',
      detail: msg,
    });
  }

  if (!receipt || !Array.isArray(receipt.logs)) {
    throw new ProposalEventLookupError({
      message: `Transaction receipt not found for ${txHash}`,
      via: 'rpc',
      reason: 'not_found',
      detail: 'No receipt returned by RPC.',
    });
  }

  for (const log of receipt.logs) {
    for (const abiItem of SUPPORTED_EVENT_VARIANTS) {
      try {
        const decoded = decodeEventLog({
          abi: [abiItem],
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === 'ProposalCreated') {
          const args = decoded.args as any;
          const decodedId = args.proposalId?.toString();
          if (!decodedId) continue;

          const targets = args.targets as readonly Address[];
          const values = args.values as readonly bigint[];
          const signatures = args.signatures as readonly string[];
          const calldatas = args.calldatas as readonly Hex[];

          return {
            event: {
              proposalId: decodedId,
              proposer: args.proposer,
              targets,
              values,
              signatures,
              calldatas,
              voteStart: args.voteStart ?? 0n,
              voteEnd: args.voteEnd ?? 0n,
              description: args.description ?? '',
              transactionHash: txHash,
              blockNumber: receipt.blockNumber ?? 0n,
            },
            governorAddress: log.address as Address,
            proposalId: decodedId,
          };
        }
      } catch {}
    }
  }

  throw new ProposalEventLookupError({
    message: `No ProposalCreated event found in transaction receipt for ${txHash}`,
    via: 'rpc',
    reason: 'not_found',
    detail: 'Transaction was found but did not emit a recognized Governor ProposalCreated event.',
  });
}

export type DecodedProposalEventWithSource = DecodedProposalEvent & {
  eventSource: string;
};

export async function retrieveProposalCreatedEvent(
  client: PublicClient<any, any>,
  network: SupportedNetwork,
  governorAddress: Address,
  proposalId: string,
  options?: { reverifyLive?: boolean }
): Promise<DecodedProposalEventWithSource> {
  const cleanId = proposalId.trim();

  // 0. Use pinned snapshot if available and not reverifying live
  if (!options?.reverifyLive) {
    const pinned = getPinnedSnapshot(network, governorAddress, cleanId);
    if (pinned) {
      return {
        ...pinned,
        eventSource: `pinned snapshot (block ${pinned.blockNumber})`,
      };
    }
  }

  let blockscoutDiag = { attempted: false, reason: 'not_found' as 'timeout' | 'range_rejected' | 'rate_limited' | 'not_found', detail: '' };
  let rpcDiag = { attempted: false, reason: 'not_found' as 'timeout' | 'range_rejected' | 'rate_limited' | 'not_found', detail: '' };

  // 1. Try Blockscout explorer logs with pagination
  let matchingEvent: DecodedProposalEvent | null = null;
  try {
    blockscoutDiag.attempted = true;
    matchingEvent = await fetchProposalEventFromBlockscout(network, governorAddress, cleanId);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('Ambiguous event')) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timeout') || msg.includes('aborted')) {
      blockscoutDiag.reason = 'timeout';
      blockscoutDiag.detail = 'Blockscout request timed out';
    } else if (msg.includes('429')) {
      blockscoutDiag.reason = 'rate_limited';
      blockscoutDiag.detail = 'Blockscout rate limit exceeded';
    } else {
      blockscoutDiag.reason = 'not_found';
      blockscoutDiag.detail = msg;
    }
  }

  if (matchingEvent) {
    return {
      ...matchingEvent,
      eventSource: `live RPC (block ${matchingEvent.blockNumber})`,
    };
  }

  // 2. Fallback to RPC logs with adaptive range scanning and on-chain snapshot targeting
  try {
    rpcDiag.attempted = true;
    matchingEvent = await fetchProposalEventFromRpc(client, network, governorAddress, cleanId);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('Ambiguous event')) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timeout')) {
      rpcDiag.reason = 'timeout';
      rpcDiag.detail = 'RPC log query timed out';
    } else if (msg.includes('429') || msg.includes('limit reached')) {
      rpcDiag.reason = 'rate_limited';
      rpcDiag.detail = 'RPC rate limit reached';
    } else if (msg.includes('range') || msg.includes('limit')) {
      rpcDiag.reason = 'range_rejected';
      rpcDiag.detail = 'RPC rejected block range query';
    } else {
      rpcDiag.reason = 'not_found';
      rpcDiag.detail = msg;
    }
  }

  if (matchingEvent) {
    return {
      ...matchingEvent,
      eventSource: `live RPC (block ${matchingEvent.blockNumber})`,
    };
  }

  // Determine primary failure reason
  const primaryVia = rpcDiag.attempted ? 'rpc' : 'blockscout';
  const primaryReason = rpcDiag.reason !== 'not_found' ? rpcDiag.reason : (blockscoutDiag.reason !== 'not_found' ? blockscoutDiag.reason : 'not_found');
  const primaryDetail = rpcDiag.detail || blockscoutDiag.detail || `ProposalCreated event not found in searched block range on Governor ${governorAddress}`;

  throw new ProposalEventLookupError({
    message: `ProposalCreated event not found for proposal ID ${cleanId} on Governor ${governorAddress}`,
    via: primaryVia,
    reason: primaryReason,
    detail: primaryDetail,
  });
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
