import React from 'react';
import type { Finding } from '../types/analysis';

interface FindingsListProps {
  findings: Finding[];
}

export const FindingsList: React.FC<FindingsListProps> = ({ findings }) => {
  if (!findings || findings.length === 0) {
    return (
      <section className="section-card findings-section" aria-labelledby="findings-heading">
        <div className="section-header-row">
          <div className="section-heading-group">
            <span className="section-kicker">Security Matrix</span>
            <h2 id="findings-heading" className="section-heading">Findings (0)</h2>
          </div>
          <span className="section-note">Deterministic security rules</span>
        </div>
        <div className="empty-message-box">
          <p className="empty-message">
            No sensitive permissions, contract upgrades, or high-risk operations detected among verified actions.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="section-card findings-section" aria-labelledby="findings-heading">
      <div className="section-header-row">
        <div className="section-heading-group">
          <span className="section-kicker">Security Matrix · Rule-Based Audit</span>
          <h2 id="findings-heading" className="section-heading">Findings ({findings.length})</h2>
        </div>
        <span className="section-note">Deterministic rule-based security findings</span>
      </div>

      <div className="findings-stack">
        {findings.map((finding) => {
          const sevClass = `severity-${finding.severity.toLowerCase()}`;

          return (
            <article key={finding.id} className="finding-item">
              <div className="finding-header">
                <div className="finding-title-row">
                  <span className={`severity-badge ${sevClass}`}>
                    <span className="severity-dot" aria-hidden="true" />
                    <span>{finding.severity.toUpperCase()}</span>
                  </span>
                  <h3 className="finding-title">{finding.title}</h3>
                </div>

                <div className="finding-meta">
                  {finding.actionIndex !== undefined && (
                    <span className="finding-action-tag">
                      Action #{finding.actionIndex + 1}
                    </span>
                  )}
                  {finding.verified && (
                    <span
                      className="verified-badge"
                      title={finding.verificationBadge || (finding.id.includes('ROLE') ? 'Role hash matched' : 'Decoded from calldata')}
                    >
                      <span className="verified-dot" aria-hidden="true" />
                      <span>{finding.verificationBadge || (finding.id.includes('ROLE') ? 'Role hash matched' : 'Decoded from calldata')}</span>
                    </span>
                  )}
                </div>
              </div>

              <p className="finding-description">{finding.description}</p>

              {finding.whyItMatters && (
                <div className="why-it-matters-box">
                  <span className="why-it-matters-label">Why it matters:</span>
                  <p className="why-it-matters-text">{finding.whyItMatters}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
