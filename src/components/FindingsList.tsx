import React from 'react';
import type { Finding } from '../types/analysis';

interface FindingsListProps {
  findings: Finding[];
}

export const FindingsList: React.FC<FindingsListProps> = ({ findings }) => {
  if (!findings || findings.length === 0) {
    return (
      <section className="section-card findings-section" aria-labelledby="findings-heading">
        <h2 id="findings-heading" className="section-heading">Findings (0)</h2>
        <p className="empty-message">
          No sensitive permissions, contract upgrades, or high-risk operations detected among verified actions.
        </p>
      </section>
    );
  }

  return (
    <section className="section-card findings-section" aria-labelledby="findings-heading">
      <div className="section-header-row">
        <h2 id="findings-heading" className="section-heading">Findings ({findings.length})</h2>
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
                    {finding.severity.toUpperCase()}
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
                    <span className="verified-badge" title="Verified against on-chain contract bytecode/ABI">
                      Verified on-chain
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

