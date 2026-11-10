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

  let matchingEvent: DecodedProposalEvent | null = null;

  for (let page = 1; page <= maxPages; page++) {
    const url = `${config.blockscoutApiUrl}?module=logs&action=getLogs&address=${governorAddress}&fromBlock=0&toBlock=latest&topic0=${PROPOSAL_CREATED_TOPIC0}&page=${page}&offset=${pageSize}`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Callscope/1.0 (DAO Proposal Analyzer)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3_000),
      });

      if (!res.ok) break;

      const json = (await res.json()) as any;
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
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('Ambiguous event')) {
        throw err;
      }
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
      try {
        const latestBlockData = await client.getBlock({ blockTag: 'latest' });
        const timeDiff = Number(latestBlockData.timestamp - creationTimepoint);
        const secPerBlock = network === 'base' ? 0.623 : 12;
        const estimatedDiff = BigInt(Math.max(0, Math.floor(timeDiff / secPerBlock)));
        targetBlock =
          latestBlockData.number > estimatedDiff ? latestBlockData.number - estimatedDiff : 0n;
      } catch {
        targetBlock = latestBlock;
      }
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

export async function retrieveProposalCreatedEvent(
  client: PublicClient<any, any>,
  network: SupportedNetwork,
  governorAddress: Address,
  proposalId: string
): Promise<DecodedProposalEvent> {
  const cleanId = proposalId.trim();

  // 1. Try Blockscout explorer logs with pagination
  let matchingEvent: DecodedProposalEvent | null = null;
  try {
    matchingEvent = await fetchProposalEventFromBlockscout(network, governorAddress, cleanId);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('Ambiguous event')) {
      throw err;
    }
    // Fall back to RPC without reporting missing
  }

  if (matchingEvent) {
    return matchingEvent;
  }

  // 2. Fallback to RPC logs with adaptive range scanning and on-chain snapshot targeting
  try {
    matchingEvent = await fetchProposalEventFromRpc(client, network, governorAddress, cleanId);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('Ambiguous event')) {
      throw err;
    }
  }

  if (matchingEvent) {
    return matchingEvent;
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
