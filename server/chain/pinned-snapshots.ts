import type { Address, Hex } from 'viem';
import type { SupportedNetwork } from './types';
import type { DecodedProposalEvent } from './proposal-events';
import ethEnsSnapshot from '../fixtures/ethereum-0x323a76393544d5ecca80cd6ef2a560c6a395b7e3-77767899528494238518019756391533686963875234067646094287125791110488147463806.json';
import baseUnlockSnapshot from '../fixtures/base-0x65ba0624403fc5ca2b20479e9f626ed4d78e0ad9-27419154582993156392805749742953507877176483681373228046916881327937839104508.json';
import syntheticCleanGrantSnapshot from '../fixtures/ethereum-0x323a76393544d5ecca80cd6ef2a560c6a395b7e3-999001.json';
import syntheticUnverifiedUpgradeSnapshot from '../fixtures/ethereum-0x323a76393544d5ecca80cd6ef2a560c6a395b7e3-999002.json';

const PINNED_SNAPSHOTS = [
  ethEnsSnapshot,
  baseUnlockSnapshot,
  syntheticCleanGrantSnapshot,
  syntheticUnverifiedUpgradeSnapshot,
];

function parseSnapshot(raw: any): DecodedProposalEvent {
  return {
    proposalId: raw.proposalId,
    proposer: raw.proposer as Address,
    targets: raw.targets as readonly Address[],
    values: (raw.values as string[]).map((v) => BigInt(v)),
    signatures: raw.signatures as readonly string[],
    calldatas: raw.calldatas as readonly Hex[],
    voteStart: BigInt(raw.voteStart ?? 0),
    voteEnd: BigInt(raw.voteEnd ?? 0),
    description: raw.description ?? '',
    transactionHash: raw.transactionHash as Hex,
    blockNumber: BigInt(raw.blockNumber ?? 0),
  };
}

export function getPinnedSnapshot(
  network: SupportedNetwork,
  governorAddress: Address,
  proposalId: string
): DecodedProposalEvent | null {
  const cleanId = proposalId.trim();
  const match = PINNED_SNAPSHOTS.find(
    (s) =>
      s.chain === network &&
      s.governor.toLowerCase() === governorAddress.toLowerCase() &&
      s.proposalId === cleanId
  );
  if (match) {
    return parseSnapshot(match);
  }
  return null;
}

export function getPinnedSnapshotByTxHash(
  txHash: string
): { event: DecodedProposalEvent; governorAddress: Address; network: SupportedNetwork; proposalId: string } | null {
  const cleanTx = txHash.toLowerCase().trim();
  const match = PINNED_SNAPSHOTS.find(
    (s) => (s as any).transactionHash?.toLowerCase() === cleanTx
  );
  if (match) {
    return {
      event: parseSnapshot(match),
      governorAddress: (match as any).governor as Address,
      network: (match as any).chain as SupportedNetwork,
      proposalId: (match as any).proposalId,
    };
  }
  return null;
}

