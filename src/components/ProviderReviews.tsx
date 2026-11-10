import React from 'react';
import type { ProviderReview } from '../types/analysis';

interface ProviderReviewsProps {
  serv: ProviderReview;
  dolphin: ProviderReview;
}

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

    return (
      <div className="review-body">
        {review.summary && <p className="review-summary-text">{review.summary}</p>}

        {review.findings && review.findings.length > 0 && (
          <ul className="review-observations-list">
            {review.findings.map((item, idx) => {
              const text =
                typeof item === 'string'
                  ? item
                  : typeof item === 'object' && item !== null
                    ? (item as Record<string, unknown>).detail ||
                    (item as Record<string, unknown>).description ||
                    JSON.stringify(item)
                    : String(item);

              return (
                <li key={idx} className="review-observation-item">
                  {String(text)}
                </li>
              );
            })}
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
