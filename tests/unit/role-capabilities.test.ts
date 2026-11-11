import { describe, it, expect } from 'vitest';
import {
  parseSolidityRoleCapabilities,
  formatRoleCapabilitySummary,
  resolveRoleCapabilitiesFromSource,
  profileRecipient,
  computeRoleHash,
} from '../../server/analysis/role-capabilities';
import { detectFindings } from '../../server/analysis/detect-findings';
import { buildAssessment } from '../../server/analysis/build-assessment';
import type { ProposalAction, DescriptionConsistency } from '../../src/types/analysis';

describe('Task 5: Role capability resolution & recipient profile', () => {
  // OpenZeppelin Variant A: Older TimelockController (e.g. OZ 4.0 - 4.8)
  // cancel() is gated by PROPOSER_ROLE
  const olderOzTimelockSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TimelockController {
    bytes32 public constant TIMELOCK_ADMIN_ROLE = keccak256("TIMELOCK_ADMIN_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    modifier onlyRole(bytes32 role) {
        _checkRole(role, msg.sender);
        _;
    }

    function schedule(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public virtual onlyRole(PROPOSER_ROLE) {}

    function scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public virtual onlyRole(PROPOSER_ROLE) {}

    function cancel(bytes32 id) public virtual onlyRole(PROPOSER_ROLE) {}

    function execute(
        address target,
        uint256 value,
        bytes calldata payload,
        bytes32 predecessor,
        bytes32 salt
    ) public payable virtual onlyRole(EXECUTOR_ROLE) {}
}
`;

  // OpenZeppelin Variant B: Newer TimelockController (e.g. OZ 4.9+)
  // cancel() is gated by CANCELLER_ROLE (separate role)
  const newerOzTimelockSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TimelockController {
    bytes32 public constant TIMELOCK_ADMIN_ROLE = keccak256("TIMELOCK_ADMIN_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");

    modifier onlyRole(bytes32 role) {
        _checkRole(role, msg.sender);
        _;
    }

    function schedule(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public virtual onlyRole(PROPOSER_ROLE) {}

    function scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public virtual onlyRole(PROPOSER_ROLE) {}

    function cancel(bytes32 id) public virtual onlyRole(CANCELLER_ROLE) {}

    function execute(
        address target,
        uint256 value,
        bytes calldata payload,
        bytes32 predecessor,
        bytes32 salt
    ) public payable virtual onlyRole(EXECUTOR_ROLE) {}
}
`;

  describe('OpenZeppelin Variant Comparison', () => {
    it('uses AST parser (@solidity-parser/parser) on full Solidity contracts', () => {
      const res = parseSolidityRoleCapabilities(olderOzTimelockSource);
      expect(res.method).toBe('ast_parser');
      expect(res.gates.length).toBeGreaterThan(0);
    });

    it('falls back gracefully to pattern inspection on unparseable snippet syntax', () => {
      // Incomplete snippet with unbalanced brackets
      const brokenSnippet = 'contract Incomplete { function broken( onlyRole(PROPOSER_ROLE)';
      const res = parseSolidityRoleCapabilities(brokenSnippet);
      expect(res.method).toBe('pattern_inspection');
    });

    it('resolves cancel capability under PROPOSER_ROLE for older OZ Timelock variant', () => {
      const { gates } = parseSolidityRoleCapabilities(olderOzTimelockSource);
      const { capabilities, summary } = formatRoleCapabilitySummary(
        'PROPOSER_ROLE',
        'TimelockController',
        gates
      );

      const fns = capabilities.map((c) => c.fn);
      expect(fns).toContain('schedule');
      expect(fns).toContain('cancel');
      expect(summary).toBe('can schedule and cancel on TimelockController (per verified source)');
    });

    it('excludes cancel capability from PROPOSER_ROLE on newer OZ Timelock variant, assigning it to CANCELLER_ROLE', () => {
      const { gates } = parseSolidityRoleCapabilities(newerOzTimelockSource);

      // PROPOSER_ROLE on newer OZ does NOT include cancel
      const proposerResult = formatRoleCapabilitySummary(
        'PROPOSER_ROLE',
        'TimelockController',
        gates
      );
      const proposerFns = proposerResult.capabilities.map((c) => c.fn);
      expect(proposerFns).toContain('schedule');
      expect(proposerFns).not.toContain('cancel');
      expect(proposerResult.summary).toBe('can schedule on TimelockController (per verified source)');

      // CANCELLER_ROLE includes cancel
      const cancellerResult = formatRoleCapabilitySummary(
        'CANCELLER_ROLE',
        'TimelockController',
        gates
      );
      const cancellerFns = cancellerResult.capabilities.map((c) => c.fn);
      expect(cancellerFns).toContain('cancel');
      expect(cancellerResult.summary).toBe('can cancel on TimelockController (per verified source)');

      // Assert outputs between older and newer variants strictly differ
      expect(proposerResult.summary).not.toBe(
        formatRoleCapabilitySummary('PROPOSER_ROLE', 'TimelockController', parseSolidityRoleCapabilities(olderOzTimelockSource).gates).summary
      );
    });
  });

  describe('Unresolved Capabilities & Limitations', () => {
    it('returns unresolved capability when source code is missing or unparseable', async () => {
      const roleHex = computeRoleHash('PROPOSER_ROLE');
      const result = await resolveRoleCapabilitiesFromSource(
        'ethereum',
        '0x0000000000000000000000000000000000000001',
        'UnknownContract',
        roleHex,
        '' // Empty source
      );

      expect(result.status).toBe('unresolved');
      expect(result.summary).toBe('capability: unresolved');
    });

    it('feeds unresolved capability limitations into analysis_incomplete outcome', () => {
      const cleanConsistency: DescriptionConsistency = {
        status: 'consistent',
        explanation: 'Matches description',
      };

      const outcome = buildAssessment({
        actions: [
          {
            index: 0,
            target: '0x1111111111111111111111111111111111111111',
            value: '0',
            signature: '',
            selector: '0x2f2ff15d',
            decoded: true,
            rawCalldata: '0x2f2ff15d...',
          },
        ],
        findings: [],
        consistency: cleanConsistency,
        limitations: [
          'Action #1 to 0x1111111111111111111111111111111111111111: Role capability unresolved; verified contract source code unavailable or unparseable.',
        ],
      });

      expect(outcome).toBe('analysis_incomplete');
    });
  });

  describe('Recipient Profiling', () => {
    it('profiles EOA addresses accurately via eth_getCode', async () => {
      const mockClient = {
        getCode: async () => '0x', // No bytecode -> EOA
      } as any;

      const profile = await profileRecipient(
        mockClient,
        'ethereum',
        '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
      );

      expect(profile.type).toBe('EOA');
      expect(profile.summary).toBe('Recipient: EOA');
    });

    it('profiles contract addresses with deployment age relative to proposal', async () => {
      const mockClient = {
        getCode: async () => '0x608060405234801561001057600080fd5b50', // Bytecode -> contract
      } as any;

      // Proposal created on 2026-07-16 (ts: 1784246400)
      const proposalTs = 1784246400;

      const profile = await profileRecipient(
        mockClient,
        'ethereum',
        '0x2acbf518b3759f6e1fa163294eda55bf1d0ae051',
        proposalTs
      );

      expect(profile.type).toBe('contract');
      expect(profile.summary).toContain('Recipient: contract');
    });
  });

  describe('Findings Text Augmentation', () => {
    it('formats finding description with capabilities and recipient facts while keeping severity rules', () => {
      const action: ProposalAction = {
        index: 0,
        target: '0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7',
        targetName: 'TimelockController',
        value: '0',
        signature: 'grantRole(bytes32,address)',
        selector: '0x2f2ff15d',
        decoded: true,
        functionName: 'grantRole',
        args: [
          {
            name: 'role',
            type: 'bytes32',
            value: '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1',
          },
          {
            name: 'account',
            type: 'address',
            value: '0x2acbf518b3759f6e1fa163294eda55bf1d0ae051',
          },
        ],
        rawCalldata: '0x2f2ff15d...',
        roleCapability: {
          status: 'resolved',
          capabilities: [
            { fn: 'schedule', gatedBy: 'PROPOSER_ROLE' },
            { fn: 'cancel', gatedBy: 'PROPOSER_ROLE' },
          ],
          summary: 'can schedule and cancel on TimelockController (per verified source)',
          sourceOrigin: 'verified_source',
        },
        recipientProfile: {
          type: 'contract',
          isVerified: true,
          deployedDaysBefore: 6,
          summary: 'Recipient: contract, verified, deployed 6 days before proposal',
        },
      };

      const findings = detectFindings([action]);
      expect(findings).toHaveLength(1);
      const finding = findings[0]!;

      // Severity rule maintained
      expect(finding.severity).toBe('high');
      expect(finding.title).toContain('PROPOSER_ROLE');

      // Description contains capability arrow and recipient profile
      expect(finding.description).toContain('Grants PROPOSER_ROLE');
      expect(finding.description).toContain('can schedule and cancel on TimelockController (per verified source)');
      expect(finding.description).toContain('Recipient: contract, verified, deployed 6 days before proposal');
      expect(finding.description).toContain('0x2acbf518b3759f6e1fa163294eda55bf1d0ae051');
    });
  });
});

