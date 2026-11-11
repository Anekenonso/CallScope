import type { ProposalAction, DescriptionConsistency } from '../../src/types/analysis';

interface ExecutedAmountInfo {
  raw: bigint;
  decimals?: number;
  decimalsUnavailable?: boolean;
  symbol?: string;
  isApproval?: boolean;
  spender?: string;
}

/**
 * Extract explicit recipient addresses designated in the description text.
 * Only addresses explicitly linked to transfer destinations, recipients, beneficiaries,
 * or grant winners are treated as explicit recipient constraints.
 */
function extractExplicitRecipientAddresses(description: string): Set<string> {
  const explicit = new Set<string>();
  const recipientPattern =
    /(?:to|recipient|beneficiary|destination|send\s+to|transfer\s+to|pay\s+to|grant\s+to|winner|wallet|payout\s+to)[:\s]+(0x[a-fA-F0-9]{40})/gi;
  let match: RegExpExecArray | null;
  while ((match = recipientPattern.exec(description)) !== null) {
    if (match[1]) {
      explicit.add(match[1].toLowerCase());
    }
  }
  return explicit;
}

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

  // Extract explicitly bound recipient addresses from description
  const explicitRecipients = extractExplicitRecipientAddresses(description);

  // Topic indicators
  const mentionsTransfer =
    /\b(transfer|fund|funds|allocation|disbursement|treasury|usdc|dai|payment|budget)\b/i.test(
      description
    );
  const mentionsRole =
    /\b(role|proposer|executor|admin|permission|permissions|security\s+council|signer|multisig)\b/i.test(
      description
    );
  const mentionsUpgrade = /\b(upgrade|implementation|logic|proxy|migrate)\b/i.test(description);
  const mentionsOwnership = /\b(ownership|owner|transfer\s+ownership|renounce)\b/i.test(description);
  const describesStream =
    /\b(stream|streaming|daily\s+stream|daily\s+usdc|sablier|superfluid|continuous\s+stream)\b/i.test(
      description
    );
  const describesApproval = /\b(approve|approval|allowance)\b/i.test(description);

  // Extract explicitly claimed transfer amounts from description text
  const claimedAmountMatches = [
    ...description.matchAll(
      /(?:transfer|disburse|send|grant|pay|allocation\s+of|stream\s+of|stream)\s+(?:of\s+)?(\$?\d[\d,]*(?:\.\d+)?)\s*([a-zA-Z$]+)?/gi
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

  const executedAmounts: ExecutedAmountInfo[] = [];
  let hasActualTransferAction = false;

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

    // Check for direct native ETH transfer
    if (action.isNativeTransfer || (action.value && action.value !== '0' && fn === 'transfer')) {
      hasActualTransferAction = true;
      const recipient =
        action.args?.find((a) => a.name.toLowerCase() === 'recipient')?.value ||
        action.target ||
        '';
      const recipientLower = recipient.toLowerCase();

      let rawAmount = 0n;
      try {
        rawAmount = BigInt(action.value || '0');
      } catch {
        rawAmount = 0n;
      }

      if (rawAmount > 0n) {
        executedAmounts.push({
          raw: rawAmount,
          decimals: 18,
          symbol: 'ETH',
        });
      }

      if (!mentionsTransfer) {
        discrepancies.push(
          `Action #${actionNum} transfers native ETH, but description does not describe funds disbursement.`
        );
      }

      // Check recipient address consistency
      if (
        recipient &&
        !mentionedAddresses.has(recipientLower) &&
        !descLower.includes(recipientLower)
      ) {
        if (explicitRecipients.size > 0 && !explicitRecipients.has(recipientLower)) {
          discrepancies.push(
            `Recipient mismatch: Action #${actionNum} sends native ETH to ${recipient}, which contradicts the explicit recipient stated in description.`
          );
        } else {
          omissions.push(
            `Action #${actionNum}: Native ETH recipient ${recipient} is not specified by address in the description.`
          );
        }
      }
      continue;
    }

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

      // Exact recipient address check
      if (
        recipient &&
        !mentionedAddresses.has(recipientLower) &&
        !descLower.includes(recipientLower)
      ) {
        if (explicitRecipients.size > 0 && !explicitRecipients.has(recipientLower)) {
          discrepancies.push(
            `Recipient mismatch: Action #${actionNum} grants permissions to ${recipient}, which contradicts address stated in description.`
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
      hasActualTransferAction = true;
      let recipient = '';
      let rawAmount = 0n;

      if (fn === 'transfer') {
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
        executedAmounts.push({
          raw: rawAmount,
          decimals: action.tokenDecimals,
          decimalsUnavailable: action.decimalsUnavailable,
          symbol: action.tokenSymbol,
        });
      }

      const recipientLower = recipient.toLowerCase();

      if (!mentionsTransfer) {
        discrepancies.push(
          `Action #${actionNum} executes a token transfer, but description does not describe token disbursements.`
        );
      }

      // Check if recipient is mentioned or explicitly contradicted
      if (
        recipient &&
        !mentionedAddresses.has(recipientLower) &&
        !descLower.includes(recipientLower)
      ) {
        if (explicitRecipients.size > 0 && !explicitRecipients.has(recipientLower)) {
          discrepancies.push(
            `Recipient mismatch: Action #${actionNum} executes call to ${recipient}, which does not match address stated in description.`
          );
        } else {
          // Address not in description, but no contradicting address was explicitly named
          omissions.push(
            `Action #${actionNum}: Token recipient ${recipient} (${action.targetName || 'token'}) is not specified in the description text.`
          );
        }
      }
    }

    // 3. Token Approvals: approve(address spender, uint256 amount)
    else if (fn === 'approve') {
      const spender =
        action.args?.find(
          (a) =>
            a.name.toLowerCase() === 'spender' ||
            a.name.toLowerCase() === 'usr' ||
            a.type === 'address'
        )?.value ||
        action.args?.[0]?.value ||
        '';
      const amountStr =
        action.args?.find(
          (a) => a.name.toLowerCase() === 'amount' || a.name.toLowerCase() === 'value'
        )?.value ||
        action.args?.[1]?.value ||
        '0';

      let rawAmount = 0n;
      try {
        rawAmount = BigInt(amountStr);
      } catch {
        rawAmount = 0n;
      }

      executedAmounts.push({
        raw: rawAmount,
        decimals: action.tokenDecimals,
        decimalsUnavailable: action.decimalsUnavailable,
        symbol: action.tokenSymbol,
        isApproval: true,
        spender,
      });

      // Catch scenario: Description claims a daily stream / streaming payment, but only executes approve
      if (describesStream) {
        discrepancies.push(
          `Action #${actionNum} executes a token approval (\`approve\`) to ${spender} on ${action.targetName || action.target}, but the proposal describes establishing a payment stream (daily stream). A token approval only delegates withdrawal allowance and does not configure or initiate an active stream.`
        );
      } else if (mentionsTransfer && !describesApproval && !hasActualTransferAction) {
        // Proposal claims direct transfer/grant/payment, but only approves
        discrepancies.push(
          `Action #${actionNum} executes a token approval (\`approve\`) rather than a direct transfer or disbursement as described in the proposal. An approval grants withdrawal allowance to ${spender} but does not transfer treasury funds.`
        );
      }
    }

    // 4. Upgrades
    else if (fn === 'upgradeto' || fn === 'upgradetoandcall') {
      if (!mentionsUpgrade) {
        discrepancies.push(
          `Action #${actionNum} upgrades contract implementation, but description does not mention an upgrade.`
        );
      }
    }

    // 5. Ownership
    else if (fn === 'transferownership') {
      if (!mentionsOwnership) {
        discrepancies.push(
          `Action #${actionNum} transfers contract ownership, but description does not mention ownership transfer.`
        );
      }
    }
  }

  // Compare claimed amounts against executed transfer amounts
  const nonApprovalAmounts = executedAmounts.filter((ea) => !ea.isApproval);

  for (const claimed of claimedNumericValues) {
    const matchesAny = nonApprovalAmounts.some((ea) => {
      // 1. Raw integer match
      if (ea.raw.toString() === claimed.toString()) return true;

      // 2. Verified decimals match (never guess if decimalsUnavailable)
      if (ea.decimals !== undefined && !ea.decimalsUnavailable) {
        const scaled = Number(ea.raw) / Math.pow(10, ea.decimals);
        if (Math.abs(scaled - claimed) < 0.001) return true;
      } else if (!ea.decimalsUnavailable) {
        // Fallback standard decimals (6 or 18) only if decimalsUnavailable is NOT set
        const amt6 = Number(ea.raw) / 1e6;
        if (Math.abs(amt6 - claimed) < 0.001) return true;
        const amt18 = Number(ea.raw) / 1e18;
        if (Math.abs(amt18 - claimed) < 0.001) return true;
      }
      return false;
    });

    if (nonApprovalAmounts.length > 0 && !matchesAny) {
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
    mentionsTransfer || mentionsRole || mentionsUpgrade || mentionsOwnership || describesApproval;
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
