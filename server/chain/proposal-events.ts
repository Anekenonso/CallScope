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

// Known proposal creation block anchors for reliable historical recovery
const KNOWN_PROPOSAL_BLOCK_HINTS: Record<string, bigint> = {
  // ENS Ethereum Mainnet Security Council grantRole proposal
  '77767899528494238518019756391533686963875234067646094287125791110488147463806': 25524727n,
  // Unlock Base Mainnet transfer proposal
  '27419154582993156392805749742953507877176483681373228046916881327937839104508': 52891503n,
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
  expectedProposalId: string
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
      // If error is our explicit array mismatch error, rethrow it
      if (err instanceof Error && err.message.startsWith('Malformed ProposalCreated')) {
        throw err;
      }
      // Otherwise continue checking other variants
    }
  }

  return null;
}

/**
 * Fetch logs using Blockscout explorer API (handles entire chain history in one call)
 */
async function fetchLogsFromBlockscout(
  network: SupportedNetwork,
  governorAddress: Address
): Promise<Log[]> {
  const config = getNetworkConfig(network);
  const url = `${config.blockscoutApiUrl}?module=logs&action=getLogs&address=${governorAddress}&fromBlock=0&toBlock=latest&topic0=${PROPOSAL_CREATED_TOPIC0}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Callscope/1.0 (DAO Proposal Analyzer)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
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
}

/**
 * Fetch logs using RPC with adaptive bounded range scanning
 */
async function fetchLogsFromRpc(
  client: PublicClient<any, any>,
  governorAddress: Address,
  anchorBlock?: bigint
): Promise<Log[]> {
  const latestBlock = await client.getBlockNumber();
  const allLogs: Log[] = [];

  // If we have an anchor block, query a focused range around it
  if (anchorBlock !== undefined && anchorBlock > 0n) {
    const fromBlock = anchorBlock > 50n ? anchorBlock - 50n : 0n;
    const toBlock = anchorBlock + 50n;
    try {
      const logs = await client.getLogs({
        address: governorAddress,
        fromBlock,
        toBlock,
      });
      allLogs.push(...logs);
      if (allLogs.length > 0) return allLogs;
    } catch {
      // Continue to bounded adaptive search
    }
  }

  // Scan recent blocks with 1,000-block chunks
  const chunkSize = 1_000n;
  const scanLimit = 50_000n;
  const startBlock = latestBlock > scanLimit ? latestBlock - scanLimit : 0n;
  let toBlock = latestBlock;

  while (toBlock > startBlock) {
    const fromBlock = toBlock > chunkSize ? toBlock - chunkSize : 0n;
    try {
      const logs = await client.getLogs({
        address: governorAddress,
        fromBlock,
        toBlock,
      });
      allLogs.push(...logs);
    } catch {
      break;
    }
    if (fromBlock === 0n) break;
    toBlock = fromBlock - 1n;
  }

  return allLogs;
}

export async function retrieveProposalCreatedEvent(
  client: PublicClient<any, any>,
  network: SupportedNetwork,
  governorAddress: Address,
  proposalId: string
): Promise<DecodedProposalEvent> {
  const cleanId = proposalId.trim();

  // 1. Try Blockscout explorer logs endpoint (fast, complete historical range)
  let matchingEvent: DecodedProposalEvent | null = null;
  try {
    const blockscoutLogs = await fetchLogsFromBlockscout(network, governorAddress);
    for (const log of blockscoutLogs) {
      const parsed = parseProposalCreatedLog(log, cleanId);
      if (parsed) {
        if (matchingEvent && matchingEvent.transactionHash !== parsed.transactionHash) {
          throw new Error(`Ambiguous event: multiple conflicting ProposalCreated logs found for proposal ID ${cleanId}`);
        }
        matchingEvent = parsed;
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('Ambiguous event')) {
      throw err;
    }
    // Fallback to RPC
  }

  if (matchingEvent) {
    return matchingEvent;
  }

  // 2. Fallback to RPC logs with anchor hint if available
  const anchorBlock = KNOWN_PROPOSAL_BLOCK_HINTS[cleanId];
  const rpcLogs = await fetchLogsFromRpc(client, governorAddress, anchorBlock);
  for (const log of rpcLogs) {
    const parsed = parseProposalCreatedLog(log, cleanId);
    if (parsed) {
      if (matchingEvent && matchingEvent.transactionHash !== parsed.transactionHash) {
        throw new Error(`Ambiguous event: multiple conflicting ProposalCreated logs found for proposal ID ${cleanId}`);
      }
      matchingEvent = parsed;
    }
  }

  if (matchingEvent) {
    return matchingEvent;
  }

  throw new Error(`ProposalCreated event not found for proposal ID ${cleanId} on Governor ${governorAddress}`);
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
