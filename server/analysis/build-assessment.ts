import type {
  AssessmentOutcome,
  ProposalAction,
  Finding,
  DescriptionConsistency,
} from '../../src/types/analysis';

export interface BuildAssessmentInput {
  actions: ProposalAction[];
  findings: Finding[];
  consistency: DescriptionConsistency;
  limitations: string[];
}

/**
 * Deterministically compute the overall assessment outcome following strict precedence rules:
 *
 * 1. "review_recommended":
 *    - Any sensitive operation detected (grantRole, revokeRole, transferOwnership, upgradeTo, changeAdmin, etc.)
 *    - Any finding with severity 'critical' or 'high'
 *    - Material description/action inconsistency ('inconsistent')
 *
 * 2. "analysis_incomplete":
 *    - Any action remains undecoded (action.decoded === false)
 *    - Limitations indicate unverified contracts, unknown selectors, or missing ABIs
 *    - Description consistency is 'indeterminate' while actions exist
 *
 * 3. "no_significant_issue_detected":
 *    - ALL actions successfully decoded
 *    - No sensitive operations or high/critical findings
 *    - Description consistency is 'consistent'
 *    - No incomplete analysis limitations
 *
 * An undecoded or opaque action CANNOT produce "no_significant_issue_detected".
 */
export function buildAssessment(input: BuildAssessmentInput): AssessmentOutcome {
  const { actions, findings, consistency, limitations } = input;

  // 1. Check for sensitive operations or high/critical findings
  const hasHighOrCriticalFinding = findings.some(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );
  const isInconsistent = consistency.status === 'inconsistent';

  if (hasHighOrCriticalFinding || isInconsistent) {
    return 'review_recommended';
  }

  // 2. Check for incomplete analysis or undecoded actions
  const hasUndecodedAction = actions.some((a) => !a.decoded);
  const hasIncompleteLimitation = limitations.some((l) =>
    /unavailable|unverified|could not be decoded|not found in verified abi|failed/i.test(l)
  );
  const isIndeterminate = consistency.status === 'indeterminate' && actions.length > 0;

  if (hasUndecodedAction || hasIncompleteLimitation || isIndeterminate) {
    return 'analysis_incomplete';
  }

  // 3. Clean assessment
  return 'no_significant_issue_detected';
}

