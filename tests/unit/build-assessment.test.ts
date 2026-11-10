import { describe, it, expect } from 'vitest';
import { buildAssessment } from '../../server/analysis/build-assessment';
import type { ProposalAction, Finding, DescriptionConsistency } from '../../src/types/analysis';

describe('buildAssessment precedence engine', () => {
  const dummyAction: ProposalAction = {
    index: 0,
    target: '0x1111111111111111111111111111111111111111',
    value: '0',
    signature: '',
    selector: '0xa9059cbb',
    decoded: true,
    functionName: 'transfer',
    rawCalldata: '0xa9059cbb...',
  };

  const cleanConsistency: DescriptionConsistency = {
    status: 'consistent',
    explanation: 'Actions match description.',
  };

  it('yields no_significant_issue_detected when all actions are decoded, clean, and consistent', () => {
    const outcome = buildAssessment({
      actions: [dummyAction],
      findings: [],
      consistency: cleanConsistency,
      limitations: [],
    });
    expect(outcome).toBe('no_significant_issue_detected');
  });

  it('yields review_recommended when sensitive operations or high severity findings exist', () => {
    const finding: Finding = {
      id: 'SENSITIVE_GRANT_ROLE_0',
      severity: 'high',
      title: 'Action #1 grants privileged role',
      description: 'Grants PROPOSER_ROLE to security council',
      verified: true,
      whyItMatters: 'Alters permissions',
    };

    const outcome = buildAssessment({
      actions: [dummyAction],
      findings: [finding],
      consistency: cleanConsistency,
      limitations: [],
    });
    expect(outcome).toBe('review_recommended');
  });

  it('yields review_recommended when description consistency is inconsistent', () => {
    const inconsistent: DescriptionConsistency = {
      status: 'inconsistent',
      explanation: 'Discrepancy detected between claims and actions.',
    };

    const outcome = buildAssessment({
      actions: [dummyAction],
      findings: [],
      consistency: inconsistent,
      limitations: [],
    });
    expect(outcome).toBe('review_recommended');
  });

  it('yields analysis_incomplete when an action could not be decoded', () => {
    const undecodedAction: ProposalAction = {
      index: 0,
      target: '0x2222222222222222222222222222222222222222',
      value: '0',
      signature: '',
      selector: '0x12345678',
      decoded: false,
      rawCalldata: '0x12345678deadbeef',
      decodeError: 'ABI unavailable',
    };

    const outcome = buildAssessment({
      actions: [undecodedAction],
      findings: [],
      consistency: cleanConsistency,
      limitations: ['Action #1: Verified contract ABI unavailable.'],
    });
    expect(outcome).toBe('analysis_incomplete');
  });

  it('yields analysis_incomplete when limitations indicate missing ABIs or unverified contracts', () => {
    const outcome = buildAssessment({
      actions: [dummyAction],
      findings: [],
      consistency: cleanConsistency,
      limitations: ['Target contract ABI unavailable; raw calldata preserved.'],
    });
    expect(outcome).toBe('analysis_incomplete');
  });

  it('GUARANTEE: undecoded or opaque action CANNOT produce no_significant_issue_detected', () => {
    const partiallyUndecodedActions: ProposalAction[] = [
      dummyAction,
      {
        index: 1,
        target: '0x3333333333333333333333333333333333333333',
        value: '0',
        signature: '',
        selector: '0x99999999',
        decoded: false,
        rawCalldata: '0x99999999...',
      },
    ];

    const outcome = buildAssessment({
      actions: partiallyUndecodedActions,
      findings: [],
      consistency: cleanConsistency,
      limitations: [],
    });
    expect(outcome).not.toBe('no_significant_issue_detected');
    expect(outcome).toBe('analysis_incomplete');
  });

  it('review_recommended takes precedence over analysis_incomplete when high severity finding exists', () => {
    const undecodedAction: ProposalAction = {
      index: 0,
      target: '0x2222222222222222222222222222222222222222',
      value: '0',
      signature: '',
      selector: '0x12345678',
      decoded: false,
      rawCalldata: '0x12345678deadbeef',
    };

    const criticalFinding: Finding = {
      id: 'SENSITIVE_UPGRADE_0',
      severity: 'critical',
      title: 'Action upgrades implementation logic',
      description: 'Upgrades logic',
      verified: true,
      whyItMatters: 'Alters code',
    };

    const outcome = buildAssessment({
      actions: [undecodedAction],
      findings: [criticalFinding],
      consistency: cleanConsistency,
      limitations: ['Action undecoded'],
    });
    expect(outcome).toBe('review_recommended');
  });
});
