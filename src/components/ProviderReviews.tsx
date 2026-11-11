import React, { useState } from 'react';
import type { AssessmentOutcome, ProviderReview, ReviewItem, ReviewItemKind, DescriptionConsistency } from '../types/analysis';
import { normalizeReviewItem } from '../../server/providers/review-normalizer';
import { computeReviewerAgreement } from '../lib/reviewer-agreement';

interface ProviderReviewsProps {
  serv: ProviderReview;
  dolphin: ProviderReview;
  assessment?: AssessmentOutcome;
  extendedConsistency?: DescriptionConsistency;
}

const ReviewItemRow: React.FC<{ item: ReviewItem }> = ({ item }) => {
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  const getKindBadgeClass = (kind: ReviewItemKind) => {
    switch (kind) {
      case 'supported':
        return 'review-badge-supported';
      case 'unsupported_claim':
        return 'review-badge-unsupported';
      case 'risk':
        return 'review-badge-risk';
      case 'contradiction':
        return 'review-badge-contradiction';
      case 'note':
      default:
        return 'review-badge-note';
    }
  };

  const getKindLabel = (kind: ReviewItemKind) => {
    switch (kind) {
      case 'supported':
        return 'Supported';
      case 'unsupported_claim':
        return 'Unsupported Claim';
      case 'risk':
        return 'Risk';
      case 'contradiction':
        return 'Contradiction';
      case 'note':
      default:
        return 'Note';
    }
  };

  return (
    <li className="review-observation-item" data-testid="review-item">
      <div className="review-item-main" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            className={`review-kind-badge ${getKindBadgeClass(item.kind)}`}
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {getKindLabel(item.kind)}
          </span>
          {item.actionRef !== undefined && (
            <span
              className="review-ref-badge"
              style={{
                fontSize: '0.75rem',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                fontFamily: 'monospace',
              }}
            >
              Action #{item.actionRef + 1}
            </span>
          )}
          {item.findingRef && (
            <span
              className="review-ref-badge"
              style={{
                fontSize: '0.75rem',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                fontFamily: 'monospace',
              }}
            >
              Finding: {item.findingRef}
            </span>
          )}
          {item.claimRef && (
            <span
              className="review-ref-badge"
              style={{
                fontSize: '0.75rem',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                fontFamily: 'monospace',
              }}
            >
              Claim: {item.claimRef}
            </span>
          )}
        </div>
        <span className="review-item-issue">{item.issue}</span>
        {item.evidence && (
          <div className="review-item-evidence-wrap" style={{ marginTop: '4px' }}>
            <button
              type="button"
              className="toggle-evidence-btn"
              onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textDecoration: 'underline',
              }}
            >
              {isEvidenceOpen ? 'Hide evidence' : 'Show evidence'}
            </button>
            {isEvidenceOpen && (
              <div
                className="review-item-evidence"
                style={{
                  marginTop: '4px',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  fontSize: '0.825rem',
                  fontStyle: 'italic',
                  color: 'var(--text-secondary, #cbd5e1)',
                  borderLeft: '2px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                {item.evidence}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

export const ProviderReviews: React.FC<ProviderReviewsProps> = ({ serv, dolphin, assessment, extendedConsistency }) => {
  const agreement = computeReviewerAgreement(assessment, serv, dolphin, extendedConsistency);

  const getStatusBadge = (review: ProviderReview) => {
    switch (review.status) {
      case 'ok':
      case 'available':
        return (
          <span className="review-status-badge status-available">
            <span className="badge-dot" aria-hidden="true" />
            <span>Available</span>
          </span>
        );
      case 'pending':
        return (
          <span
            className="review-status-badge status-pending"
            style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
          >
            <span className="badge-dot pulse-dot" style={{ backgroundColor: '#38bdf8' }} aria-hidden="true" />
            <span>Analyzing...</span>
          </span>
        );
      case 'not_configured':
        return (
          <span className="review-status-badge status-unconfigured">
            <span className="badge-dot" aria-hidden="true" />
            <span>Not configured</span>
          </span>
        );
      case 'rate_limited':
        return (
          <span
            className="review-status-badge status-rate-limited"
            style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)' }}
          >
            <span className="badge-dot" style={{ backgroundColor: '#fbbf24' }} aria-hidden="true" />
            <span>Rate limited</span>
          </span>
        );
      case 'timed_out':
        return (
          <span
            className="review-status-badge status-timed-out"
            style={{ color: '#fb923c', borderColor: 'rgba(251, 146, 60, 0.3)' }}
          >
            <span className="badge-dot" style={{ backgroundColor: '#fb923c' }} aria-hidden="true" />
            <span>Timed out</span>
          </span>
        );
      case 'auth_error':
        return (
          <span
            className="review-status-badge status-auth-error"
            style={{ color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}
          >
            <span className="badge-dot" style={{ backgroundColor: '#f87171' }} aria-hidden="true" />
            <span>Auth error</span>
          </span>
        );
      case 'guard_blocked':
        return (
          <span
            className="review-status-badge status-guard-blocked"
            style={{ color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.3)' }}
          >
            <span className="badge-dot" style={{ backgroundColor: '#f43f5e' }} aria-hidden="true" />
            <span>Guard blocked</span>
          </span>
        );
      case 'schema_invalid':
        return (
          <span
            className="review-status-badge status-schema-invalid"
            style={{ color: '#e879f9', borderColor: 'rgba(232, 121, 249, 0.3)' }}
          >
            <span className="badge-dot" style={{ backgroundColor: '#e879f9' }} aria-hidden="true" />
            <span>Schema invalid</span>
          </span>
        );
      case 'upstream_error':
      case 'error':
      case 'unavailable':
      default:
        return (
          <span className="review-status-badge status-error">
            <span className="badge-dot" aria-hidden="true" />
            <span>Unavailable</span>
          </span>
        );
    }
  };

  const renderReviewContent = (review: ProviderReview, providerName: string) => {
    if (review.status === 'pending') {
      return (
        <div
          className="review-body"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', padding: '16px 0' }}
        >
          <div className="progress-spinner-wrap" style={{ width: '18px', height: '18px' }} aria-hidden="true">
            <svg
              className="progress-spinner"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: '18px', height: '18px' }}
            >
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.3" />
              <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontSize: '0.875rem' }}>
            {review.summary || `Running independent ${providerName} advisory inspection...`}
          </span>
        </div>
      );
    }

    if (review.status === 'not_configured') {
      return (
        <p className="review-empty-text">
          {review.reason ||
            `${providerName} API key was not configured in the server environment. Deterministic analysis was completed independently.`}
        </p>
      );
    }

    if (
      review.status === 'rate_limited' ||
      review.status === 'timed_out' ||
      review.status === 'auth_error' ||
      review.status === 'guard_blocked' ||
      review.status === 'schema_invalid' ||
      review.status === 'upstream_error' ||
      review.status === 'error' ||
      review.status === 'unavailable'
    ) {
      return (
        <div className="review-error-block" style={{ padding: '8px 0' }}>
          <p className="review-error-text" style={{ margin: 0 }}>
            {review.reason || review.error || `${providerName} review was temporarily unavailable.`}
          </p>
          {review.attempts !== undefined && review.attempts > 1 && (
            <span
              className="review-attempts-tag"
              style={{ display: 'inline-block', marginTop: '4px', fontSize: '0.75rem', color: '#94a3b8' }}
            >
              (Attempts: {review.attempts})
            </span>
          )}
        </div>
      );
    }

    const items: ReviewItem[] =
      review.items && review.items.length > 0
        ? review.items
        : (review.findings || []).map((f) => normalizeReviewItem(f));

    return (
      <div className="review-body">
        {review.summary && <p className="review-summary-text">{review.summary}</p>}

        {review.scenarios && review.scenarios.length > 0 && (
          <div className="review-scenarios-block" style={{ marginTop: '14px', marginBottom: '14px' }}>
            <h4
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#cbd5e1',
                marginBottom: '10px',
              }}
            >
              Adversarial Scenarios &amp; Rebuttal Audit
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {review.scenarios.map((sc) => {
                const isRefuted = sc.rebuttalStatus === 'refuted_by_data';
                const isNotRefuted = sc.rebuttalStatus === 'not_refuted';
                return (
                  <div
                    key={sc.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      border: `1px solid ${
                        isRefuted
                          ? 'rgba(34, 197, 94, 0.3)'
                          : isNotRefuted
                            ? 'rgba(239, 68, 68, 0.3)'
                            : 'rgba(59, 130, 246, 0.3)'
                      }`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#f8fafc' }}>{sc.title}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {sc.severityHint && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              color: '#cbd5e1',
                            }}
                          >
                            {sc.severityHint}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: isRefuted
                              ? 'rgba(34, 197, 94, 0.2)'
                              : isNotRefuted
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(59, 130, 246, 0.2)',
                            color: isRefuted ? '#4ade80' : isNotRefuted ? '#f87171' : '#60a5fa',
                          }}
                        >
                          {isRefuted
                            ? '✓ Refuted by Engine Facts'
                            : isNotRefuted
                              ? '⚠ Not Refuted (Plausible Risk)'
                              : '⚑ Needs Delegate Review'}
                        </span>
                      </div>
                    </div>
                    {sc.impact && (
                      <p style={{ margin: '6px 0 4px', fontSize: '0.8rem', color: '#94a3b8' }}>
                        <strong style={{ color: '#cbd5e1' }}>Impact:</strong> {sc.impact}
                      </p>
                    )}
                    {sc.refutedBy && (
                      <div
                        style={{
                          marginTop: '6px',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          fontSize: '0.75rem',
                          color: isRefuted ? '#86efac' : isNotRefuted ? '#fca5a5' : '#93c5fd',
                        }}
                      >
                        <strong>Engine Audit:</strong> {sc.refutedBy}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <ul className="review-observations-list">
            {items.map((item, idx) => (
              <ReviewItemRow key={idx} item={item} />
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <section className="section-card reviews-section" aria-labelledby="reviews-heading">
      <div className="section-header-row">
        <div className="section-heading-group">
          <span className="section-kicker">Secondary Intelligence</span>
          <h2 id="reviews-heading" className="section-heading">Sponsor advisory reviews</h2>
        </div>
        <span className="section-note">Advisory delegate assistance</span>
      </div>

      {/* Reviewer Agreement Strip */}
      <div
        className={`reviewer-agreement-strip agreement-${agreement.status}`}
        data-testid="reviewer-agreement-strip"
        style={{
          marginBottom: '20px',
          padding: '14px 18px',
          borderRadius: '8px',
          border:
            agreement.status === 'disagree'
              ? '1px solid rgba(239, 68, 68, 0.4)'
              : agreement.status === 'agree'
                ? '1px solid rgba(34, 197, 94, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor:
            agreement.status === 'disagree'
              ? 'rgba(239, 68, 68, 0.08)'
              : agreement.status === 'agree'
                ? 'rgba(34, 197, 94, 0.08)'
                : 'rgba(255, 255, 255, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                backgroundColor:
                  agreement.status === 'disagree'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : agreement.status === 'agree'
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'rgba(255, 255, 255, 0.1)',
                color:
                  agreement.status === 'disagree'
                    ? '#f87171'
                    : agreement.status === 'agree'
                      ? '#4ade80'
                      : '#94a3b8',
              }}
            >
              {agreement.status === 'disagree'
                ? 'Reviewers disagree: human review needed'
                : agreement.status === 'agree'
                  ? 'Reviewers agree'
                  : agreement.status === 'pending'
                    ? 'Reviewer comparison pending'
                    : 'Engine authoritative'}
            </span>
            <span style={{ fontSize: '0.875rem', color: '#e2e8f0', fontWeight: 500 }}>
              {agreement.headline}
            </span>
          </div>
        </div>

        {/* Stances list */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap' }}>
          {agreement.stances.map((s) => (
            <div
              key={s.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <span style={{ color: '#94a3b8', fontWeight: 500 }}>{s.name}:</span>
              <span
                style={{
                  fontWeight: 600,
                  color:
                    s.verdict === 'flagged'
                      ? '#f87171'
                      : s.verdict === 'clear'
                        ? '#4ade80'
                        : '#94a3b8',
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="reviews-grid">
        {/* OpenServ SERV Card */}
        <article className="review-card">
          <div className="review-card-header">
            <div className="review-provider-title">
              <span className="provider-name">OpenServ SERV</span>
              <span className="provider-role">Description / action comparison</span>
            </div>
            {getStatusBadge(serv)}
          </div>
          {renderReviewContent(serv, 'OpenServ SERV')}
        </article>

        {/* Dolphin Card */}
        <article className="review-card">
          <div className="review-card-header">
            <div className="review-provider-title">
              <span className="provider-name">Dolphin</span>
              <span className="provider-role">Dolphin Lighthouse · deepseek-ai/DeepSeek-V4.1-Flash</span>
            </div>
            {getStatusBadge(dolphin)}
          </div>
          {renderReviewContent(dolphin, 'Dolphin')}
        </article>
      </div>

      <div className="reviews-disclaimer">
        <span className="disclaimer-stamp" aria-hidden="true">NOTICE</span>
        <p>
          Advisory reviews are bounded AI evaluations for delegate context. The deterministic analysis engine remains authoritative.
        </p>
      </div>
    </section>
  );
};
