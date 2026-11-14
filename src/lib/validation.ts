export interface FormValidationErrors {
  network?: string;
  governorAddress?: string;
  proposalId?: string;
}

export function validateAnalysisInput(
  network: string,
  governorAddress: string,
  proposalId: string
): { isValid: boolean; errors: FormValidationErrors } {
  const errors: FormValidationErrors = {};

  if (!network || (network !== 'ethereum' && network !== 'base')) {
    errors.network = 'Select either Ethereum or Base.';
  }

  const trimmedAddress = governorAddress.trim();
  if (!trimmedAddress) {
    errors.governorAddress = 'Governor address is required.';
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
    errors.governorAddress = 'Must be a valid 0x hex address (42 characters).';
  }

  const trimmedProposalId = proposalId.trim();
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

