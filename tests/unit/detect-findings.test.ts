import { describe, it, expect } from 'vitest';
import {
  detectFindings,
  resolveRoleSemantics,
} from '../../server/analysis/detect-findings';
import type { ProposalAction } from '../../src/types/analysis';

describe('Role semantics resolution', () => {
  it('resolves PROPOSER_ROLE from verifiable hash when verified on target contract', () => {
    const roleHex = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';
    const result = resolveRoleSemantics(roleHex, 'TimelockController');
    expect(result.isVerifiable).toBe(true);
    expect(result.status).toBe('verified');
    expect(result.roleName).toBe('PROPOSER_ROLE');
    expect(result.explanation).toContain('Timelock proposer role');
  });

  it('marks recognized role hash as unconfirmed when contract-specific proof is absent', () => {
    const roleHex = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';
    const result = resolveRoleSemantics(roleHex);
    expect(result.isVerifiable).toBe(false);
    expect(result.status).toBe('recognized_standard_hash');
    expect(result.roleName).toBe('PROPOSER_ROLE');
    expect(result.explanation).toContain('contract-specific semantics are unverified');
  });

  it('resolves DEFAULT_ADMIN_ROLE from 0x00 hash on verified AccessControl', () => {
    const roleHex = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const result = resolveRoleSemantics(roleHex, 'AccessControl');
    expect(result.isVerifiable).toBe(true);
    expect(result.status).toBe('verified');
    expect(result.roleName).toBe('DEFAULT_ADMIN_ROLE');
  });

  it('marks unknown role hash as unknown and unverifiable', () => {
    const roleHex = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const result = resolveRoleSemantics(roleHex);
    expect(result.isVerifiable).toBe(false);
    expect(result.status).toBe('unknown');
    expect(result.roleName).toBe('Unknown Role');
    expect(result.explanation).toContain('Unrecognized role identifier');
  });
});

describe('Sensitive operation detection', () => {
  const dummyTarget = '0x1111111111111111111111111111111111111111';

  it('detects grantRole as high severity finding with decoded parameters', () => {
    const action: ProposalAction = {
      index: 0,
      target: dummyTarget,
      targetName: 'TimelockController',
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

    const findings = detectFindings([action]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('high');
    expect(findings[0]?.title).toContain('PROPOSER_ROLE');
    expect(findings[0]?.description).toContain('0x2acbf518b3759f6e1fa163294eda55bf1d0ae051');
    expect(findings[0]?.verified).toBe(true);
  });

  it('detects transferOwnership with calibrated proportionate severity', () => {
    // 1. Transfer to external address calibrated as high
    const actionHigh: ProposalAction = {
      index: 0,
      target: dummyTarget,
      value: '0',
      signature: '',
      selector: '0xf2fde38b',
      decoded: true,
      functionName: 'transferOwnership',
      args: [
        { name: 'newOwner', type: 'address', value: '0x9999999999999999999999999999999999999999' },
      ],
      rawCalldata: '0xf2fde38b...',
    };

    const findingsHigh = detectFindings([actionHigh]);
    expect(findingsHigh).toHaveLength(1);
    expect(findingsHigh[0]?.severity).toBe('high');
    expect(findingsHigh[0]?.title).toContain('transfers contract ownership');

    // 2. Transfer to governance Timelock calibrated as medium
    const actionMedium: ProposalAction = {
      index: 0,
      target: dummyTarget,
      targetName: 'TimelockController',
      value: '0',
      signature: '',
      selector: '0xf2fde38b',
      decoded: true,
      functionName: 'transferOwnership',
      args: [
        { name: 'newOwner', type: 'address', value: '0x2acbf518b3759f6e1fa163294eda55bf1d0ae051' },
      ],
      rawCalldata: '0xf2fde38b...',
    };
    const findingsMedium = detectFindings([actionMedium]);
    expect(findingsMedium).toHaveLength(1);
    expect(findingsMedium[0]?.severity).toBe('medium');
    expect(findingsMedium[0]?.title).toContain('transfers ownership to governance Timelock');
  });

  it('detects upgradeTo and upgradeToAndCall as critical finding', () => {
    const action: ProposalAction = {
      index: 0,
      target: dummyTarget,
      value: '0',
      signature: '',
      selector: '0x3659cfe6',
      decoded: true,
      functionName: 'upgradeTo',
      args: [
        { name: 'newImplementation', type: 'address', value: '0x8888888888888888888888888888888888888888' },
      ],
      rawCalldata: '0x3659cfe6...',
    };

    const findings = detectFindings([action]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('critical');
    expect(findings[0]?.title).toContain('upgrades implementation logic');
  });

  it('detects changeAdmin as critical finding', () => {
    const action: ProposalAction = {
      index: 0,
      target: dummyTarget,
      value: '0',
      signature: '',
      selector: '0x8f283970',
      decoded: true,
      functionName: 'changeAdmin',
      args: [
        { name: 'newAdmin', type: 'address', value: '0x7777777777777777777777777777777777777777' },
      ],
      rawCalldata: '0x8f283970...',
    };

    const findings = detectFindings([action]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('critical');
    expect(findings[0]?.title).toContain('modifies proxy admin');
  });

  it('flags undecoded actions with high severity', () => {
    const action: ProposalAction = {
      index: 0,
      target: dummyTarget,
      value: '0',
      signature: '',
      selector: '0x12345678',
      decoded: false,
      rawCalldata: '0x12345678deadbeef',
      decodeError: 'Verified ABI unavailable',
    };

    const findings = detectFindings([action]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('high');
    expect(findings[0]?.title).toContain('could not be decoded');
    expect(findings[0]?.verified).toBe(false);
  });

  it('returns empty findings for normal benign transfers without native value', () => {
    const action: ProposalAction = {
      index: 0,
      target: dummyTarget,
      value: '0',
      signature: '',
      selector: '0xa9059cbb',
      decoded: true,
      functionName: 'transfer',
      args: [
        { name: 'to', type: 'address', value: '0x4444444444444444444444444444444444444444' },
        { name: 'amount', type: 'uint256', value: '1000' },
      ],
      rawCalldata: '0xa9059cbb...',
    };

    const findings = detectFindings([action]);
    expect(findings).toHaveLength(0);
  });
});
