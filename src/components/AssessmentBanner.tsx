import React from 'react';
import type { AssessmentOutcome } from '../types/analysis';

interface AssessmentBannerProps {
  assessment: AssessmentOutcome;
  findingsCount: number;
  undecodedCount: number;
}

export const AssessmentBanner: React.FC<AssessmentBannerProps> = ({
  assessment,
  findingsCount,
  undecodedCount,
}) => {
  let title = '';
  let description = '';
  let bannerClass = '';
  let verdictTag = '';

  switch (assessment) {
    case 'review_recommended':
      title = 'Review recommended';
      bannerClass = 'assessment-banner-warning';
      verdictTag = 'Action Required';
      description =
        findingsCount > 0
          ? `${findingsCount} significant finding${findingsCount === 1 ? '' : 's'} identified among executable actions requiring human review.`
          : 'Executable actions or governance parameters require delegate review before voting.';
      break;

    case 'analysis_incomplete':
      title = 'Analysis incomplete';
      bannerClass = 'assessment-banner-incomplete';
      verdictTag = 'Unverified Calldata';
      description =
        undecodedCount > 0
          ? `${undecodedCount} action${undecodedCount === 1 ? '' : 's'} could not be verified or decoded from available ABIs. A clean assessment cannot be issued.`
          : 'One or more executable calls could not be definitively analyzed against verified on-chain data.';
      break;

    case 'no_significant_issue_detected':
      title = 'No significant issue detected';
      bannerClass = 'assessment-banner-positive';
      verdictTag = 'No significant issue detected';
      description =
        'Analysis found no sensitive operations or discrepancies among verified actions. This does not constitute an audit or guarantee of safety.';
      break;
  }

  return (
    <section
      className={`assessment-banner ${bannerClass}`}
      role="region"
      aria-label="Proposal Assessment"
    >
      <div className="assessment-top-strip">
        <div className="assessment-badge-row">
          <span className="assessment-indicator" aria-hidden="true" />
          <span className="assessment-verdict-tag">{verdictTag}</span>
        </div>
        <span className="assessment-seal-label">Deterministic Verdict</span>
      </div>

      <div className="assessment-content">
        <h2 className="assessment-title">{title}</h2>
        <p className="assessment-description">{description}</p>
      </div>
    </section>
  );
};
