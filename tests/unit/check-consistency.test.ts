import { describe, it, expect } from 'vitest';
import { checkDescriptionActionConsistency } from '../../server/analysis/check-consistency';
import type { ProposalAction } from '../../src/types/analysis';

describe('checkDescriptionActionConsistency', () => {
  const dummyTarget = '0x1111111111111111111111111111111111111111';

  it('marks empty description as indeterminate', () => {
    const result = checkDescriptionActionConsistency('', []);
    expect(result.status).toBe('indeterminate');
  });

  it('marks text-only proposal with no actions as consistent', () => {
    const result = checkDescriptionActionConsistency('Informational proposal discussing treasury ideas.', []);
    expect(result.status).toBe('consistent');
  });

  it('detects consistent grantRole action with matching security council description', () => {
    const desc = `Security Council: Grant PROPOSER_ROLE to the new Security Council multisig at 0x2acbf518b3759f6e1fa163294eda55bf1d0ae051.`;
    const action: ProposalAction = {
      index: 0,
      target: dummyTarget,
      value: '0',
      signature: 'grantRole(bytes32,address)',
      selector: '0x2f2ff15d',
      decoded: true,
      functionName: 'grantRole',
      args: [
        { name: 'role', type: 'bytes32', value: '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1' },
        { name: 'account', type: 'address', value: '0x2acbf518b3759f6e1fa163294eda55bf1d0ae051' },
      ],
      rawCalldata: '0x2f2ff15d...',
    };

    const result = checkDescriptionActionConsistency(desc, [action]);
    expect(result.status).toBe('consistent');
    expect(result.explanation).toContain('match');
  });

  it('detects discrepancy when executable action is transfer but description only mentions role', () => {
    const desc = 'Grant admin permissions to governance committee.';
    const action: ProposalAction = {
      index: 0,
      target: dummyTarget,
      value: '0',
      signature: '',
      selector: '0xa9059cbb',
      decoded: true,
      functionName: 'transfer',
      args: [
        { name: 'to', type: 'address', value: '0x3333333333333333333333333333333333333333' },
        { name: 'amount', type: 'uint256', value: '1000000' },
      ],
      rawCalldata: '0xa9059cbb...',
    };

    const result = checkDescriptionActionConsistency(desc, [action]);
    expect(result.status).toBe('inconsistent');
    expect(result.discrepancies).toBeDefined();
    expect(result.discrepancies?.[0]).toContain('does not describe token disbursements');
  });

  it('detects discrepancy when executable action is upgrade but description makes no mention', () => {
    const desc = 'Distribute community grants to developer teams.';
    const action: ProposalAction = {
      index: 0,
      target: dummyTarget,
      value: '0',
      signature: '',
      selector: '0x3659cfe6',
      decoded: true,
      functionName: 'upgradeTo',
      args: [
        { name: 'newImpl', type: 'address', value: '0x5555555555555555555555555555555555555555' },
      ],
      rawCalldata: '0x3659cfe6...',
    };

    const result = checkDescriptionActionConsistency(desc, [action]);
    expect(result.status).toBe('inconsistent');
    expect(result.discrepancies?.[0]).toContain('upgrades contract implementation');
  });
});
