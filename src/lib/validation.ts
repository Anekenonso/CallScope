import type { SupportedNetwork } from '../types/analysis';

export interface FormValidationErrors {
  network?: string;
  governorAddress?: string;
  proposalId?: string;
  txHashOrUrl?: string;
}

export interface ParsedTxInput {
  txHash: `0x${string}`;
  inferredNetwork?: SupportedNetwork;
}

export function parseTxHashOrUrl(input: string): ParsedTxInput | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  const txPattern = /^0x[a-fA-F0-9]{64}$/;
  if (txPattern.test(trimmed)) {
    return { txHash: trimmed as `0x${string}` };
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname;
    const match = pathname.match(/(?:tx|transaction)\/(0x[a-fA-F0-9]{64})/i);
    if (!match) return null;

    const txHash = match[1] as `0x${string}`;
    let inferredNetwork: SupportedNetwork | undefined;
    if (host.includes('etherscan.io') || host.includes('eth.blockscout.com')) {
      inferredNetwork = 'ethereum';
    } else if (host.includes('basescan.org') || host.includes('base.blockscout.com')) {
      inferredNetwork = 'base';
    }
    return { txHash, inferredNetwork };
  } catch {
    return null;
  }
}

export function validateAnalysisInput(
  network: string,
  governorAddress: string,
  proposalId: string,
  txHashOrUrl?: string,
  inputMode: 'governor' | 'tx' = 'governor'
): { isValid: boolean; errors: FormValidationErrors } {
  const errors: FormValidationErrors = {};

  if (inputMode === 'tx' || (txHashOrUrl !== undefined && txHashOrUrl.length > 0)) {
    const trimmed = (txHashOrUrl || '').trim();
    if (trimmed.length === 0) {
      errors.txHashOrUrl = 'Please enter a transaction hash or explorer URL.';
      return {
        isValid: false,
        errors,
      };
    }
    const parsed = parseTxHashOrUrl(trimmed);
    if (!parsed) {
      errors.txHashOrUrl = 'Must be a 66-character transaction hash (0x...) or an Etherscan/Basescan tx URL.';
    } else {
      const effectiveNetwork = parsed.inferredNetwork || network;
      if (!effectiveNetwork || (effectiveNetwork !== 'ethereum' && effectiveNetwork !== 'base')) {
        errors.network = 'Select either Ethereum or Base.';
      }
    }
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  if (!network || (network !== 'ethereum' && network !== 'base')) {
    errors.network = 'Select either Ethereum or Base.';
  }

  const trimmedAddress = governorAddress ? governorAddress.trim() : '';
  if (!trimmedAddress) {
    errors.governorAddress = 'Governor address is required.';
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
    errors.governorAddress = 'Must be a valid 0x hex address (42 characters).';
  }

  const trimmedProposalId = proposalId ? proposalId.trim() : '';
  if (!trimmedProposalId) {
    errors.proposalId = 'Proposal ID is required.';
  } else if (!/^\d+$/.test(trimmedProposalId)) {
    errors.proposalId = 'Proposal ID must be a numeric integer.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

