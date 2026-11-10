import { describe, it, expect } from 'vitest';
import { checkDescriptionActionConsistency } from '../../server/analysis/check-consistency';
import { detectFindings } from '../../server/analysis/detect-findings';
import { buildAssessment } from '../../server/analysis/build-assessment';
import { sanitizePublicErrorMessage } from '../../api/analyse';
import type { ProposalAction } from '../../src/types/analysis';

describe('CallScope Core Reliability Fixes Regression Suite', () => {
  const dummyTarget = '0x1111111111111111111111111111111111111111';
  const senderAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const recipientAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const wrongRecipient = '0xcccccccccccccccccccccccccccccccccccccccc';

  describe('1. Description Consistency & transferFrom Recipient Extraction', () => {
    it('correctly extracts args[1] as recipient for transferFrom(address,address,uint256)', () => {
      const action: ProposalAction = {
        index: 0,
        target: dummyTarget,
        value: '0',
        signature: 'transferFrom(address,address,uint256)',
        selector: '0x23b872dd',
        decoded: true,
        functionName: 'transferFrom',
        args: [
          { name: 'from', type: 'address', value: senderAddress },
          { name: 'to', type: 'address', value: recipientAddress },
          { name: 'amount', type: 'uint256', value: '100000000000000000000' }, // 100 tokens (18 dec)
        ],
        rawCalldata: '0x23b872dd...',
      };

      // Description explicitly names the true recipient (recipientAddress)
      const descValid = `Transfer funds to grant winner ${recipientAddress} for tooling development.`;
      const resultValid = checkDescriptionActionConsistency(descValid, [action]);
      expect(resultValid.status).toBe('consistent');

      // Description names the sender or a completely wrong recipient
      const descWrong = `Transfer funds to grant winner ${wrongRecipient} for tooling development.`;
      const resultWrong = checkDescriptionActionConsistency(descWrong, [action]);
      expect(resultWrong.status).toBe('inconsistent');
      expect(resultWrong.discrepancies?.some((d: string) => d.includes('Recipient mismatch'))).toBe(true);
    });

    it('detects amount mismatches between description claims and executed values', () => {
      const action: ProposalAction = {
        index: 0,
        target: dummyTarget,
        value: '0',
        signature: 'transfer(address,uint256)',
        selector: '0xa9059cbb',
        decoded: true,
        functionName: 'transfer',
        args: [
          { name: 'to', type: 'address', value: recipientAddress },
          { name: 'amount', type: 'uint256', value: '1000000000000000000000' }, // 1,000 tokens
        ],
        rawCalldata: '0xa9059cbb...',
      };

      // Description claims 50,000 tokens while action transfers only 1,000
      const descMismatch = `Disburse 50000 tokens to contributor ${recipientAddress}.`;
      const resultMismatch = checkDescriptionActionConsistency(descMismatch, [action]);
      expect(resultMismatch.status).toBe('inconsistent');
      expect(resultMismatch.discrepancies?.some((d: string) => d.includes('Amount mismatch'))).toBe(true);
    });

    it('returns indeterminate rather than fabricating consistency on vague descriptions', () => {
      const action: ProposalAction = {
        index: 0,
        target: dummyTarget,
        value: '0',
        signature: 'transfer(address,uint256)',
        selector: '0xa9059cbb',
        decoded: true,
        functionName: 'transfer',
        args: [
          { name: 'to', type: 'address', value: recipientAddress },
          { name: 'amount', type: 'uint256', value: '1000' },
        ],
        rawCalldata: '0xa9059cbb...',
      };

      // Description mentions transfers generally, but provides no verifiable recipient address or amounts
      const descVague = `Proposal to allocate treasury funds and transfer grants for community tooling.`;
      const result = checkDescriptionActionConsistency(descVague, [action]);
      expect(result.status).toBe('indeterminate');
      expect(result.explanation).toContain('cannot be reliably verified');
    });
  });

  describe('2. Role Verification Uncertainty & Semantics', () => {
    it('does not treat standard role hash as verified without contract-specific evidence', () => {
      // TIMELOCK_ADMIN_ROLE hash
      const adminRole = '0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5';
      const action: ProposalAction = {
        index: 0,
        target: '0x9999999999999999999999999999999999999999', // Generic unverified target contract
        value: '0',
        signature: 'grantRole(bytes32,address)',
        selector: '0x2f2ff15d',
        decoded: true,
        functionName: 'grantRole',
        args: [
          { name: 'role', type: 'bytes32', value: adminRole },
          { name: 'account', type: 'address', value: recipientAddress },
        ],
        rawCalldata: '0x2f2ff15d...',
      };

      const findings = detectFindings([action]);
      expect(findings.length).toBeGreaterThan(0);

      const roleFinding = findings.find((f) => f.id.startsWith('SENSITIVE_GRANT_ROLE'));
      expect(roleFinding).toBeDefined();

      // Crucial requirement: verified must be false because contract implementation is unverified
      expect(roleFinding?.verified).toBe(false);
      // Finding description must include explicit uncertainty disclaimer
      expect(roleFinding?.title).toContain('unconfirmed');
      expect(roleFinding?.description).toContain('contract-specific semantics are unverified');
    });
  });

  describe('3. Incomplete Decoding & Assessment Integrity', () => {
    it('forces "analysis_incomplete" when any action fails to decode and no critical finding exists', () => {
      const undecodedAction: ProposalAction = {
        index: 0,
        target: dummyTarget,
        value: '0',
        signature: '',
        selector: '0x12345678',
        decoded: false,
        rawCalldata: '0x12345678abcdef',
        decodeError: 'Verified ABI not found on explorer or bytecode registry',
      };

      const assessment = buildAssessment({
        actions: [undecodedAction],
        findings: [],
        consistency: {
          status: 'consistent',
          explanation: 'Description matches.',
        },
      });

      expect(assessment).toBe('analysis_incomplete');
      expect(assessment).not.toBe('no_significant_issue_detected');
    });
  });

  describe('4. Public API Error Sanitization & Secret Isolation', () => {
    it('strips file system paths, stack traces, and bearer tokens from public error messages', () => {
      const rawError = `Error: Internal RPC Failure at queryBlock (C:\\Users\\USER\\Software\\CallScope\\server\\chain.ts:145:21)\nBearer mock_token_placeholder_abc123`;

      const sanitized = sanitizePublicErrorMessage(rawError);

      expect(sanitized).not.toContain('C:\\Users');
      expect(sanitized).not.toContain('server\\chain.ts');
      expect(sanitized).not.toContain('mock_token');
      expect(sanitized).toContain('Internal RPC Failure');
    });
  });
});
