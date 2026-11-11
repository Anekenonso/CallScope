import React, { useState } from 'react';
import type { ProviderReview, ReviewItem, ReviewItemKind } from '../types/analysis';
import { normalizeReviewItem } from '../../server/providers/review-normalizer';

interface ProviderReviewsProps {
  serv: ProviderReview;
  dolphin: ProviderReview;
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

export const ProviderReviews: React.FC<ProviderReviewsProps> = ({ serv, dolphin }) => {
  const getStatusBadge = (review: ProviderReview) => {
    switch (review.status) {
      case 'available':
        return (
          <span className="review-status-badge status-available">
            <span className="badge-dot" aria-hidden="true" />
            <span>Available</span>
          </span>
        );
      case 'not_configured':
        return (
          <span className="review-status-badge status-unconfigured">
            <span className="badge-dot" aria-hidden="true" />
            <span>Not configured</span>
          </span>
        );
      case 'error':
      case 'unavailable':
        return (
          <span className="review-status-badge status-error">
            <span className="badge-dot" aria-hidden="true" />
            <span>Unavailable</span>
          </span>
        );
      default:
        return null;
    }
  };

  const renderReviewContent = (review: ProviderReview, providerName: string) => {
    if (review.status === 'not_configured') {
      return (
        <p className="review-empty-text">
          {providerName} API key was not configured in the server environment. Deterministic analysis was completed independently.
        </p>
      );
    }

    if (review.status === 'error' || review.status === 'unavailable') {
      return (
        <p className="review-error-text">
          {review.error || `${providerName} review was temporarily unavailable.`}
        </p>
      );
    }

    const items: ReviewItem[] =
      review.items && review.items.length > 0
        ? review.items
        : (review.findings || []).map((f) => normalizeReviewItem(f));

    return (
      <div className="review-body">
        {review.summary && <p className="review-summary-text">{review.summary}</p>}

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
              <span className="provider-role">Secondary security reviewer</span>
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
