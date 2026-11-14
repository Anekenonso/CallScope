import type { ProposalAction, DescriptionConsistency } from '../../src/types/analysis';

/**
 * Perform deterministic NLP-lite semantic consistency check between
 * the proposal description markdown/text and the decoded executable actions.
 */
export function checkDescriptionActionConsistency(
  description: string,
  actions: ProposalAction[]
): DescriptionConsistency {
  // If description is empty, intent cannot be reliably verified
  if (!description || description.trim().length === 0) {
    return {
      status: 'indeterminate',
      explanation: 'Proposal description is completely empty; cannot verify action intent.',
    };
  }

  // If no executable actions exist, verify it is an informational or signal proposal
  if (actions.length === 0) {
    return {
      status: 'consistent',
      explanation:
        'Informational or off-chain voting proposal with no on-chain executable transactions.',
    };
  }

  const descLower = description.toLowerCase();
  const discrepancies: string[] = [];
  const omissions: string[] = [];
  let hasUndecodedAction = false;

  // Extract all Ethereum hex addresses from description text
  const addressMatches = description.match(/0x[a-fA-F0-9]{40}/g) || [];
  const mentionedAddresses = new Set<string>();
  for (const addr of addressMatches) {
    mentionedAddresses.add(addr.toLowerCase());
  }

  // Topic indicators
  const mentionsTransfer = /transfer|fund|allocation|disbursement|treasury|usdc|dai|payment|budget/i.test(
    description
  );
  const mentionsRole = /role|proposer|executor|admin|permission|security council|signer|multisig/i.test(
    description
  );
  const mentionsUpgrade = /upgrade|implementation|logic|proxy|migrate/i.test(description);
  const mentionsOwnership = /ownership|owner|transfer\s+ownership/i.test(description);

  // Extract explicitly claimed transfer amounts from description text
  // Pattern: (transfer|disburse|send|grant|pay) of? (amount) (token)?
  const claimedAmountMatches = [
    ...description.matchAll(
      /(?:transfer|disburse|send|grant|pay|allocation\s+of)\s+(?:of\s+)?(\$?\d[\d,]*(?:\.\d+)?)\s*([a-zA-Z$]+)?/gi
    ),
  ];
  const claimedNumericValues: number[] = [];
  for (const match of claimedAmountMatches) {
    const rawNumStr = (match[1] || '').replace(/[$,]/g, '');
    const num = parseFloat(rawNumStr);
    if (!isNaN(num) && num > 0) {
      claimedNumericValues.push(num);
    }
  }

  const executedTransferAmounts: bigint[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    const actionNum = i + 1;

    if (!action.decoded) {
      hasUndecodedAction = true;
      omissions.push(
        `Action #${actionNum}: Action could not be decoded and cannot be verified against proposal claims.`
      );
      continue;
    }

    const fn = (action.functionName || '').toLowerCase();

    // 1. Role operations
    if (fn === 'grantrole' || fn === 'revokerole') {
      const recipient =
        action.args?.find((a) => a.name.toLowerCase().includes('account') || a.type === 'address')
          ?.value ||
        action.args?.[1]?.value ||
        '';
      const recipientLower = recipient.toLowerCase();

      if (!mentionsRole) {
        discrepancies.push(
          `Action #${actionNum} grants/revokes permissions, but description does not discuss role changes.`
        );
      }

      // Exact recipient address check - generic words like "multisig" do NOT bypass this check
      if (
        recipient &&
        !mentionedAddresses.has(recipientLower) &&
        !descLower.includes(recipientLower)
      ) {
        if (mentionedAddresses.size > 0) {
          discrepancies.push(
            `Recipient mismatch: Action #${actionNum} grants permissions to ${recipient}, which does not match address stated in description.`
          );
        } else {
          omissions.push(
            `Action #${actionNum}: Permission recipient ${recipient} is not explicitly identified by address in the description.`
          );
        }
      }
    }

    // 2. Token transfers: transfer vs transferFrom
    else if (fn === 'transfer' || fn === 'transferfrom') {
      let recipient = '';
      let rawAmount = 0n;

      if (fn === 'transfer') {
        // transfer(address to, uint256 amount) - Recipient is argument 1 (index 0)
        recipient =
          action.args?.find(
            (a) =>
              a.name.toLowerCase() === 'to' ||
              a.name.toLowerCase() === 'recipient' ||
              a.name.toLowerCase() === 'dst'
          )?.value ||
          action.args?.[0]?.value ||
          '';
        const amountStr =
          action.args?.find(
            (a) => a.name.toLowerCase() === 'amount' || a.name.toLowerCase() === 'value'
          )?.value ||
          action.args?.[1]?.value ||
          '0';
        try {
          rawAmount = BigInt(amountStr);
        } catch {
          rawAmount = 0n;
        }
      } else {
        // transferFrom(address from, address to, uint256 amount) - Recipient is argument 2 (index 1)
        recipient =
          action.args?.find(
            (a) =>
              a.name.toLowerCase() === 'to' ||
              a.name.toLowerCase() === 'recipient' ||
              a.name.toLowerCase() === 'dst'
          )?.value ||
          action.args?.[1]?.value ||
          '';
        const amountStr =
          action.args?.find(
            (a) => a.name.toLowerCase() === 'amount' || a.name.toLowerCase() === 'value'
          )?.value ||
          action.args?.[2]?.value ||
          '0';
        try {
          rawAmount = BigInt(amountStr);
        } catch {
          rawAmount = 0n;
        }
      }

      if (rawAmount > 0n) {
        executedTransferAmounts.push(rawAmount);
      }

      const recipientLower = recipient.toLowerCase();

      if (!mentionsTransfer) {
        discrepancies.push(
          `Action #${actionNum} executes a token transfer, but description does not describe token disbursements.`
        );
      }

      // Check if recipient is mentioned in description - exact address matching required
      if (
        recipient &&
        !mentionedAddresses.has(recipientLower) &&
        !descLower.includes(recipientLower)
      ) {
        if (mentionedAddresses.size > 0) {
          discrepancies.push(
            `Recipient mismatch: Action #${actionNum} executes call to ${recipient}, which does not match address stated in description.`
          );
        } else {
          omissions.push(
            `Action #${actionNum}: Token recipient ${recipient} (${action.targetName || 'token'}) is not specified in the description text.`
          );
        }
      }
    }

    // 3. Upgrades
    else if (fn === 'upgradeto' || fn === 'upgradetoandcall') {
      if (!mentionsUpgrade) {
        discrepancies.push(
          `Action #${actionNum} upgrades contract implementation, but description does not mention an upgrade.`
        );
      }
    }

    // 4. Ownership
    else if (fn === 'transferownership') {
      if (!mentionsOwnership) {
        discrepancies.push(
          `Action #${actionNum} transfers contract ownership, but description does not mention ownership transfer.`
        );
      }
    }
  }

  // Compare claimed amounts against executed amounts
  for (const claimed of claimedNumericValues) {
    // Check if claimed amount matches any executed transfer under standard decimal bases (1, 6 decimals for USDC, 18 decimals for ERC20)
    const matchesAny = executedTransferAmounts.some((amt) => {
      const amtStr = amt.toString();
      // Match raw integer
      if (amtStr === claimed.toString()) return true;
      // Match 6 decimals (e.g. 100 USDC = 100_000_000)
      const amt6 = Number(amt) / 1e6;
      if (Math.abs(amt6 - claimed) < 0.001) return true;
      // Match 18 decimals (e.g. 100 tokens = 100 * 1e18)
      const amt18 = Number(amt) / 1e18;
      if (Math.abs(amt18 - claimed) < 0.001) return true;
      return false;
    });

    if (executedTransferAmounts.length > 0 && !matchesAny) {
      discrepancies.push(
        `Amount mismatch: Description claims transfer of ${claimed}, but no executable action matches this amount.`
      );
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

  // Undecoded actions make consistency indeterminate
  if (hasUndecodedAction) {
    return {
      status: 'indeterminate',
      explanation:
        'Proposal contains undecoded actions that cannot be reliably verified against stated claims.',
      omissions,
    };
  }

  // If description mentions operations generally but provides no verifiable addresses or amounts, return indeterminate
  if (actions.length > 0 && omissions.length > 0) {
    return {
      status: 'indeterminate',
      explanation: `Claims cannot be reliably verified against executable actions: ${omissions.join(' ')}`,
      omissions,
    };
  }

  const mentionsAnyOperation =
    mentionsTransfer || mentionsRole || mentionsUpgrade || mentionsOwnership;
  if (
    actions.length > 0 &&
    (!mentionsAnyOperation || (mentionedAddresses.size === 0 && claimedNumericValues.length === 0))
  ) {
    return {
      status: 'indeterminate',
      explanation:
        'Proposal description is too vague to establish verifiable consistency with executable actions.',
    };
  }

  return {
    status: 'consistent',
    explanation:
      'Executable actions match the stated operations, recipients, and intended effects in the proposal description.',
  };
}
