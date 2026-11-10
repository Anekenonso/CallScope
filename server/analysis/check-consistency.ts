import type { ProposalAction, DescriptionConsistency } from '../../src/types/analysis';

/**
 * Deterministically examine consistency between proposal description and decoded executable actions
 */
export function checkDescriptionActionConsistency(
  description: string,
  actions: ProposalAction[]
): DescriptionConsistency {
  if (!description || description.trim().length === 0) {
    return {
      status: 'indeterminate',
      explanation: 'Proposal description is empty; cannot establish consistency with actions.',
    };
  }

  if (actions.length === 0) {
    return {
      status: 'consistent',
      explanation: 'Proposal contains zero executable actions (text-only proposal).',
    };
  }

  const descLower = description.toLowerCase();
  const omissions: string[] = [];
  const discrepancies: string[] = [];

  // Extract all 20-byte hex addresses mentioned in description
  const mentionedAddresses = new Set<string>();
  const addressMatches = description.match(/0x[a-fA-F0-9]{40}/g) || [];
  for (const addr of addressMatches) {
    mentionedAddresses.add(addr.toLowerCase());
  }

  // Keywords indicating intent
  const mentionsTransfer = /transfer|fund|allocation|disbursement|treasury|usdc|dai|payment|budget/i.test(description);
  const mentionsRole = /role|proposer|executor|admin|permission|security council|signer|multisig/i.test(description);
  const mentionsUpgrade = /upgrade|implementation|logic|proxy|migrate/i.test(description);
  const mentionsOwnership = /ownership|owner|transfer\s+ownership/i.test(description);

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    const actionNum = i + 1;

    if (!action.decoded) {
      omissions.push(`Action #${actionNum}: Action could not be decoded and cannot be verified against proposal claims.`);
      continue;
    }

    const fn = (action.functionName || '').toLowerCase();

    // 1. Role operations
    if (fn === 'grantrole' || fn === 'revokerole') {
      const recipient = action.args?.find((a) => a.name.toLowerCase().includes('account') || a.type === 'address')?.value || '';
      const recipientLower = recipient.toLowerCase();

      if (!mentionsRole) {
        discrepancies.push(`Action #${actionNum} grants/revokes permissions, but description does not discuss role changes.`);
      }

      if (recipient && !mentionedAddresses.has(recipientLower) && !descLower.includes(recipientLower)) {
        // If recipient not mentioned explicitly by address, check if description mentions the recipient organization or multisig
        if (!descLower.includes('security council') && !descLower.includes('multisig')) {
          omissions.push(`Action #${actionNum}: Permission recipient ${recipient} is not explicitly identified in the description.`);
        }
      }
    }

    // 2. Token transfers
    else if (fn === 'transfer' || fn === 'transferfrom') {
      const recipient = action.args?.[0]?.value || '';
      const recipientLower = recipient.toLowerCase();

      if (!mentionsTransfer) {
        discrepancies.push(`Action #${actionNum} executes a token transfer, but description does not describe token disbursements.`);
      }

      // Check if recipient is mentioned in description
      if (recipient && !mentionedAddresses.has(recipientLower) && !descLower.includes(recipientLower)) {
        omissions.push(`Action #${actionNum}: Token recipient ${recipient} (${action.targetName || 'token'}) is not specified in the description text.`);
      }
    }

    // 3. Upgrades
    else if (fn === 'upgradeto' || fn === 'upgradetoandcall') {
      if (!mentionsUpgrade) {
        discrepancies.push(`Action #${actionNum} upgrades contract implementation, but description does not mention an upgrade.`);
      }
    }

    // 4. Ownership
    else if (fn === 'transferownership') {
      if (!mentionsOwnership) {
        discrepancies.push(`Action #${actionNum} transfers contract ownership, but description does not mention ownership transfer.`);
      }
    }
  }

  // Synthesize consistency outcome
  if (discrepancies.length > 0) {
    return {
      status: 'inconsistent',
      explanation: `Material discrepancies detected between proposal claims and executable calls: ${discrepancies.join(' ')}`,
      omissions: omissions.length > 0 ? omissions : undefined,
      discrepancies,
    };
  }

  if (omissions.length > 0) {
    // If some actions were undecoded or had unmentioned recipients
    return {
      status: 'inconsistent',
      explanation: `Executable actions contain items not verified or omitted in description: ${omissions.join(' ')}`,
      omissions,
    };
  }

  return {
    status: 'consistent',
    explanation: 'Executable actions match the stated operations and intended effects in the proposal description.',
  };
}
