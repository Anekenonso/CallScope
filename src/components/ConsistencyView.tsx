import React from 'react';
import type { DescriptionConsistency } from '../types/analysis';

interface ConsistencyViewProps {
  consistency: DescriptionConsistency;
  extendedConsistency?: DescriptionConsistency;
}

export const ConsistencyView: React.FC<ConsistencyViewProps> = ({
  consistency,
  extendedConsistency,
}) => {
  const activeConsistency = extendedConsistency || consistency;
  const statusClass = `consistency-${activeConsistency.status.toLowerCase()}`;
  const statusLabel =
    activeConsistency.status === 'consistent'
      ? 'Consistent'
      : activeConsistency.status === 'inconsistent'
        ? 'Inconsistent'
        : activeConsistency.status === 'partially_verified'
          ? 'Partially Verified'
          : 'Indeterminate';

  const claims = extendedConsistency?.claims || consistency.claims || [];

  return (
    <section className="section-card consistency-section" aria-labelledby="consistency-heading">
      <div className="section-header-row">
        <div className="section-heading-group">
          <span className="section-kicker">Cross-Examination</span>
          <h2 id="consistency-heading" className="section-heading">Description consistency</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {extendedConsistency ? (
            <span
              className="badge-tag"
              style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}
              title="Extended claims check proposed by OpenServ SERV and evaluated deterministically"
            >
              Extended check (OpenServ SERV)
            </span>
          ) : (
            <span className="badge-tag" title="Baseline deterministic rule-based keyword check">
              Baseline (rule-based)
            </span>
          )}
          <span className={`consistency-badge ${statusClass}`}>
            <span className="badge-dot" aria-hidden="true" />
            <span>{statusLabel}</span>
          </span>
        </div>
      </div>

      <div className="consistency-body">
        <p className="consistency-explanation">{consistency.explanation}</p>

        {consistency.mode === 'keyword_fallback' && (
          <div className="keyword-fallback-banner">
            <span aria-hidden="true">ℹ</span>
            <span>Keyword check only. Claims were not individually verified via structured extraction.</span>
          </div>
        )}

        {claims.length > 0 && (
          <div className="consistency-details-group">
            <div className="args-table-header" style={{ marginBottom: '8px' }}>
              <span className="args-table-label">Claims Ledger</span>
              <span className="args-count">
                {claims.length} {claims.length === 1 ? 'claim' : 'claims'} extracted
              </span>
            </div>
            <div className="claims-ledger-table-wrap">
              <table className="claims-ledger-table">
                <thead>
                  <tr>
                    <th>Claim Quote</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Calldata Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id}>
                      <td className="claim-quote-cell">“{claim.quote}”</td>
                      <td>
                        <span className="claim-category-badge">{claim.category}</span>
                      </td>
                      <td>
                        <span className={`claim-status-badge claim-status-${claim.status || 'not_checkable'}`}>
                          {claim.status === 'verified' && '✓ Verified'}
                          {claim.status === 'contradicted' && '✕ Contradicted'}
                          {claim.status === 'not_checkable' && '⊘ Not Checkable'}
                          {!claim.status && 'Pending'}
                        </span>
                      </td>
                      <td>
                        <div className="claim-evidence-text">
                          {claim.explanation || '—'}
                          {claim.evidenceRef?.actionIndex !== undefined && (
                            <div>
                              <a
                                href={`#action-${claim.evidenceRef.actionIndex}`}
                                className="claim-evidence-link"
                              >
                                Action #{claim.evidenceRef.actionIndex + 1}
                                {claim.evidenceRef.argName ? ` (${claim.evidenceRef.argName})` : ''}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
