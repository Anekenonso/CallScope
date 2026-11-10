import React from 'react';
import type { DescriptionConsistency } from '../types/analysis';

interface ConsistencyViewProps {
  consistency: DescriptionConsistency;
}

export const ConsistencyView: React.FC<ConsistencyViewProps> = ({ consistency }) => {
  const statusClass = `consistency-${consistency.status.toLowerCase()}`;
  const statusLabel =
    consistency.status === 'consistent'
      ? 'Consistent'
      : consistency.status === 'inconsistent'
        ? 'Inconsistent'
        : 'Indeterminate';

  return (
    <section className="section-card consistency-section" aria-labelledby="consistency-heading">
      <div className="section-header-row">
        <div className="section-heading-group">
          <span className="section-kicker">Cross-Examination</span>
          <h2 id="consistency-heading" className="section-heading">Description consistency</h2>
        </div>
        <span className={`consistency-badge ${statusClass}`}>
          <span className="badge-dot" aria-hidden="true" />
          <span>{statusLabel}</span>
        </span>
      </div>

      <div className="consistency-body">
        <p className="consistency-explanation">{consistency.explanation}</p>

        {consistency.omissions && consistency.omissions.length > 0 && (
          <div className="consistency-details-group">
            <h3 className="subheading-minor">Unmentioned actions / omissions:</h3>
            <ul className="consistency-list">
              {consistency.omissions.map((item, idx) => (
                <li key={idx} className="consistency-list-item warning-item">
                  <span className="list-bullet" aria-hidden="true">⚠</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {consistency.discrepancies && consistency.discrepancies.length > 0 && (
          <div className="consistency-details-group">
            <h3 className="subheading-minor">Discrepancies identified:</h3>
            <ul className="consistency-list">
              {consistency.discrepancies.map((item, idx) => (
                <li key={idx} className="consistency-list-item error-item">
                  <span className="list-bullet" aria-hidden="true">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};
