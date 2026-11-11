import type { ProposalAction, Finding } from '../../src/types/analysis';

// Known verifiable role hashes from OpenZeppelin contracts
export const KNOWN_ROLE_HASHES: Record<string, { name: string; description: string }> = {
  '0x0000000000000000000000000000000000000000000000000000000000000000': {
    name: 'DEFAULT_ADMIN_ROLE',
    description: 'Root administrator role with power to grant and revoke all other roles.',
  },
  '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1': {
    name: 'PROPOSER_ROLE',
    description: 'Timelock proposer role with permission to queue and schedule governance calls.',
  },
  '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63': {
    name: 'EXECUTOR_ROLE',
    description: 'Timelock executor role with permission to trigger execution of matured proposals.',
  },
  '0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783': {
    name: 'CANCELLER_ROLE',
    description: 'Timelock canceller role with permission to cancel queued governance calls.',
  },
  '0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5': {
    name: 'TIMELOCK_ADMIN_ROLE',
    description: 'Timelock administrator role with authority to manage timelock delays and roles.',
  },
  '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6': {
    name: 'MINTER_ROLE',
    description: 'Permission to mint new tokens.',
  },
  '0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a': {
    name: 'PAUSER_ROLE',
    description: 'Permission to pause and unpause contract operations.',
  },
  '0x189ab7a9244e084837b8600ecdd8ed679b6087361b51ab7900870f6847423f7b': {
    name: 'UPGRADER_ROLE',
    description: 'Permission to upgrade implementation contracts.',
  },
};

export type RoleVerificationStatus = 'verified' | 'recognized_standard_hash' | 'unknown';

export interface RoleResolution {
  roleName: string;
  status: RoleVerificationStatus;
  isVerifiable: boolean;
  explanation: string;
}

/**
 * Resolve role semantics from verifiable contract evidence or known role definitions.
 * Distinguishes between verified contract semantics, recognized standard hashes, and unknown roles.
 */
export function resolveRoleSemantics(roleHex: string, targetName?: string): RoleResolution {
  const normalized = roleHex.toLowerCase();
  const known = KNOWN_ROLE_HASHES[normalized];

  if (known) {
    // Contract-specific evidence: target contract is a verified Timelock or known AccessControl contract
    const targetIsTimelock = Boolean(targetName && /timelock/i.test(targetName));
    const targetIsKnownAccessControl = Boolean(
      targetName && /(accesscontrol|governor|token)/i.test(targetName)
    );

    if (
      targetIsTimelock &&
      (known.name === 'PROPOSER_ROLE' ||
        known.name === 'EXECUTOR_ROLE' ||
        known.name === 'CANCELLER_ROLE' ||
        known.name === 'TIMELOCK_ADMIN_ROLE')
    ) {
      return {
        roleName: known.name,
        status: 'verified',
        isVerifiable: true,
        explanation: `${known.name}: Confirmed on verified ${targetName}. ${known.description}`,
      };
    }

    if (targetIsKnownAccessControl && known.name === 'DEFAULT_ADMIN_ROLE') {
      return {
        roleName: known.name,
        status: 'verified',
        isVerifiable: true,
        explanation: `${known.name}: Confirmed on verified ${targetName}. ${known.description}`,
      };
    }

    // Hash is recognized from OpenZeppelin standard library, but contract-specific semantics are unconfirmed
    return {
      roleName: known.name,
      status: 'recognized_standard_hash',
      isVerifiable: false,
      explanation: `Matches standard OpenZeppelin ${known.name} hash, but contract-specific semantics are unverified on target contract without implementation proof.`,
    };
  }

  return {
    roleName: 'Unknown Role',
    status: 'unknown',
    isVerifiable: false,
    explanation: `Unrecognized role identifier ${roleHex}; semantics could not be confirmed on-chain.`,
  };
}

/**
 * Detect sensitive operations and governance risks deterministically
 */
export function detectFindings(actions: ProposalAction[]): Finding[] {
  const findings: Finding[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    const actionNum = i + 1;

    // Check for native value transfer
    if (action.value && action.value !== '0') {
      const formatted = action.formattedAmount || `${action.value} wei`;
      findings.push({
        id: `NATIVE_VALUE_TRANSFER_${i}`,
        severity: 'medium',
        title: `Action #${actionNum} transfers native ETH`,
        description: `Action transfers ${formatted} (${action.value} wei) to ${action.target}.`,
        actionIndex: i,
        target: action.target,
        verified: true,
        verificationBadge: 'Decoded from calldata',
        whyItMatters: 'Direct treasury balance transfers alter DAO reserves and should match requested appropriations.',
      });
    }

    // Check undecoded action or known Safe transaction wrapper
    if (!action.decoded) {
      if (action.isSafeWrapper || action.selector === '0x6a761202') {
        findings.push({
          id: `SAFE_WRAPPER_OPAQUE_${i}`,
          severity: 'medium',
          title: `Action #${actionNum} executes via Safe transaction wrapper`,
          description: `Action targets ${action.targetName || action.target} using Gnosis/Safe execTransaction (0x6a761202). Inner payload calls are opaque and cannot be verified deterministically without multi-call simulation.`,
          actionIndex: i,
          target: action.target,
          verified: true,
          verificationBadge: 'Decoded from calldata',
          whyItMatters:
            'Safe transaction wrappers conceal the underlying destination addresses, token amounts, and contract calls of the transaction.',
        });
      } else {
        findings.push({
          id: `UNDECODED_ACTION_${i}`,
          severity: 'high',
          title: `Action #${actionNum} could not be decoded`,
          description: action.decodeError || `Calldata with selector ${action.selector} to ${action.target} could not be decoded.`,
          actionIndex: i,
          target: action.target,
          verified: false,
          whyItMatters: 'Opaque or undecoded actions prevent delegates from verifying execution safety.',
        });
      }
      continue;
    }

    const fn = action.functionName || '';

    // 1. grantRole(bytes32,address)
    if (fn === 'grantRole') {
      const roleArg =
        action.args?.find((a) => a.name.toLowerCase().includes('role') || a.type === 'bytes32')
          ?.value ||
        action.args?.[0]?.value ||
        '';
      const accountArg =
        action.args?.find((a) => a.name.toLowerCase().includes('account') || a.type === 'address')
          ?.value ||
        action.args?.[1]?.value ||
        '';
      const roleSemantics = resolveRoleSemantics(roleArg, action.targetName);

      const title =
        roleSemantics.status === 'verified'
          ? `Action #${actionNum} grants privileged role: ${roleSemantics.roleName}`
          : roleSemantics.status === 'recognized_standard_hash'
            ? `Action #${actionNum} grants privileged role (unconfirmed semantics): ${roleSemantics.roleName}`
            : `Action #${actionNum} grants unrecognized role`;

      let descriptionText: string;
      if (action.roleCapability && action.roleCapability.status === 'resolved') {
        const capText = action.roleCapability.summary;
        const recText = action.recipientProfile?.summary || `Recipient: ${accountArg}`;
        descriptionText = `Grants ${roleSemantics.roleName} to ${accountArg} → ${capText}. ${recText}`;
      } else if (action.roleCapability && action.roleCapability.status === 'unresolved') {
        const recText = action.recipientProfile?.summary || `Recipient: ${accountArg}`;
        descriptionText = `Grants ${roleSemantics.roleName} to ${accountArg} (capability: unresolved). ${recText}`;
      } else {
        descriptionText = `Grants role ${roleSemantics.roleName} (${roleArg}) to account ${accountArg} on ${action.targetName || action.target}. ${roleSemantics.explanation}`;
      }

      findings.push({
        id: `SENSITIVE_GRANT_ROLE_${i}`,
        severity: 'high',
        title,
        description: descriptionText,
        actionIndex: i,
        target: action.target,
        verified: roleSemantics.status === 'verified',
        verificationBadge:
          roleSemantics.status === 'verified' || roleSemantics.status === 'recognized_standard_hash'
            ? 'Role hash matched'
            : 'Decoded from calldata',
        whyItMatters:
          'Permission grants alter access control topology and confer privileged capabilities on the recipient address.',
      });
      continue;
    }

    // 2. revokeRole(bytes32,address)
    if (fn === 'revokeRole') {
      const roleArg =
        action.args?.find((a) => a.name.toLowerCase().includes('role') || a.type === 'bytes32')
          ?.value ||
        action.args?.[0]?.value ||
        '';
      const accountArg =
        action.args?.find((a) => a.name.toLowerCase().includes('account') || a.type === 'address')
          ?.value ||
        action.args?.[1]?.value ||
        '';
      const roleSemantics = resolveRoleSemantics(roleArg, action.targetName);

      const title =
        roleSemantics.status === 'verified'
          ? `Action #${actionNum} revokes privileged role: ${roleSemantics.roleName}`
          : roleSemantics.status === 'recognized_standard_hash'
            ? `Action #${actionNum} revokes role (unconfirmed semantics): ${roleSemantics.roleName}`
            : `Action #${actionNum} revokes unrecognized role`;

      let descriptionText: string;
      if (action.roleCapability && action.roleCapability.status === 'resolved') {
        const capText = action.roleCapability.summary;
        const recText = action.recipientProfile?.summary || `Recipient: ${accountArg}`;
        descriptionText = `Revokes ${roleSemantics.roleName} from ${accountArg} → revokes ability to ${capText}. ${recText}`;
      } else if (action.roleCapability && action.roleCapability.status === 'unresolved') {
        const recText = action.recipientProfile?.summary || `Recipient: ${accountArg}`;
        descriptionText = `Revokes ${roleSemantics.roleName} from ${accountArg} (capability: unresolved). ${recText}`;
      } else {
        descriptionText = `Revokes role ${roleSemantics.roleName} (${roleArg}) from account ${accountArg} on ${action.targetName || action.target}. ${roleSemantics.explanation}`;
      }

      findings.push({
        id: `SENSITIVE_REVOKE_ROLE_${i}`,
        severity: 'medium',
        title,
        description: descriptionText,
        actionIndex: i,
        target: action.target,
        verified: roleSemantics.status === 'verified',
        verificationBadge:
          roleSemantics.status === 'verified' || roleSemantics.status === 'recognized_standard_hash'
            ? 'Role hash matched'
            : 'Decoded from calldata',
        whyItMatters:
          'Permission revocations remove capabilities and can affect operational multisigs or automated runners.',
      });
      continue;
    }

    // 3. transferOwnership(address)
    if (fn === 'transferOwnership') {
      const newOwner = (action.args?.[0]?.value || '').toLowerCase();
      const isZeroAddress =
        newOwner === '0x0000000000000000000000000000000000000000' ||
        newOwner === '0x0' ||
        !newOwner;
      const isTimelockOrGov =
        /timelock|governor|governance/i.test(action.targetName || '') ||
        /timelock|governor/i.test(action.args?.[0]?.name || '');

      let severity: 'medium' | 'high' = 'high';
      let title = `Action #${actionNum} transfers contract ownership`;
      let description = `Transfers administrative ownership of ${action.targetName || action.target} to ${action.args?.[0]?.value || newOwner}. Delegates should confirm that the recipient address is the intended administrative controller or multisig.`;

      if (isZeroAddress) {
        severity = 'high';
        title = `Action #${actionNum} renounces contract ownership`;
        description = `Transfers ownership of ${action.targetName || action.target} to the zero address (0x0). This permanently removes contract ownership and eliminates owner-only administrative functions.`;
      } else if (isTimelockOrGov) {
        severity = 'medium';
        title = `Action #${actionNum} transfers ownership to governance Timelock`;
        description = `Transfers administrative ownership of ${action.targetName || action.target} to governance controller ${action.args?.[0]?.value || newOwner}. This places contract administrative controls under DAO governance.`;
      }

      findings.push({
        id: `SENSITIVE_TRANSFER_OWNERSHIP_${i}`,
        severity,
        title,
        description,
        actionIndex: i,
        target: action.target,
        verified: true,
        verificationBadge: 'Decoded from calldata',
        whyItMatters:
          'Transferring contract ownership relinquishes exclusive administrative control over the target contract.',
      });
      continue;
    }

    // 4. upgradeTo(address) & upgradeToAndCall(address,bytes)
    if (fn === 'upgradeTo' || fn === 'upgradeToAndCall') {
      const newImpl = action.args?.[0]?.value || '';
      findings.push({
        id: `SENSITIVE_UPGRADE_${i}`,
        severity: 'critical',
        title: `Action #${actionNum} upgrades implementation logic`,
        description: `Upgrades implementation logic of ${action.targetName || action.target} to new code at ${newImpl}${fn === 'upgradeToAndCall' ? ' and executes migration calldata' : ''}.`,
        actionIndex: i,
        target: action.target,
        verified: true,
        verificationBadge: 'Decoded from calldata',
        whyItMatters: 'Smart contract upgrades modify the executable bytecode of the proxy, replacing contract rules and state handling.',
      });
      continue;
    }

    // 5. changeAdmin(address)
    if (fn === 'changeAdmin') {
      const newAdmin = action.args?.[0]?.value || '';
      findings.push({
        id: `SENSITIVE_CHANGE_ADMIN_${i}`,
        severity: 'critical',
        title: `Action #${actionNum} modifies proxy admin`,
        description: `Changes proxy administrator for ${action.targetName || action.target} to ${newAdmin}.`,
        actionIndex: i,
        target: action.target,
        verified: true,
        verificationBadge: 'Decoded from calldata',
        whyItMatters: 'Proxy admins possess direct authority to upgrade implementation logic or manipulate proxy routing.',
      });
      continue;
    }

    // 6. Token approval checks (both infinite and finite material approvals)
    if (fn === 'approve') {
      const spender = action.args?.[0]?.value || '';
      const amount = action.args?.[1]?.value || '';
      const isInfinite =
        amount.startsWith('115792089237316195423570985008687907853269984665640564039457584007913129639935') ||
        amount.toLowerCase().startsWith('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

      if (isInfinite) {
        findings.push({
          id: `INFINITE_TOKEN_APPROVAL_${i}`,
          severity: 'high',
          title: `Action #${actionNum} grants unlimited token allowance`,
          description: `Approves unlimited token allowance on ${action.targetName || action.target} to spender ${spender}. This grants the spender recurring withdrawal authority up to the entire treasury balance without further governance votes.`,
          actionIndex: i,
          target: action.target,
          verified: true,
          verificationBadge: 'Decoded from calldata',
          whyItMatters:
            'Unlimited token allowances permit the spender address to drain approved tokens up to the balance held without transaction-level DAO approval.',
        });
      } else {
        let rawAmount = 0n;
        try {
          rawAmount = BigInt(amount);
        } catch {
          rawAmount = 0n;
        }

        if (rawAmount > 0n) {
          const displayAmount = action.formattedAmount || `${amount} base units`;
          findings.push({
            id: `MATERIAL_TOKEN_APPROVAL_${i}`,
            severity: 'medium',
            title: `Action #${actionNum} grants material token approval`,
            description: `Approves a token allowance of ${displayAmount} on ${action.targetName || action.target} to spender ${spender}. This authorizes the spender to withdraw up to this amount via transferFrom.`,
            actionIndex: i,
            target: action.target,
            verified: true,
            verificationBadge: 'Decoded from calldata',
            whyItMatters:
              'Token approvals delegate withdrawal authority to an external contract or address rather than transferring funds directly. An approval does not automatically execute a transfer or configure an active payment stream.',
          });
        }
      }
    }
  }

  return findings;
}
