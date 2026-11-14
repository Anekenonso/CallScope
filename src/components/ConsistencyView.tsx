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
        <h2 id="consistency-heading" className="section-heading">Description consistency</h2>
        <span className={`consistency-badge ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <p className="consistency-explanation">{consistency.explanation}</p>

      {consistency.omissions && consistency.omissions.length > 0 && (
        <div className="consistency-details-group">
          <h3 className="subheading-minor">Unmentioned actions / omissions:</h3>
          <ul className="consistency-list">
            {consistency.omissions.map((item, idx) => (
              <li key={idx} className="consistency-list-item warning-item">
                {item}
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
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

