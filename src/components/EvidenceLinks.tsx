import React from 'react';
import type { EvidenceItem } from '../types/analysis';

interface EvidenceLinksProps {
  evidence: EvidenceItem[];
  limitations: string[];
}

export const EvidenceLinks: React.FC<EvidenceLinksProps> = ({ evidence, limitations }) => {
  return (
    <section className="section-card evidence-section" aria-labelledby="evidence-heading">
      <div className="section-header-row">
        <div className="section-heading-group">
          <span className="section-kicker">Provenance &amp; Scope</span>
          <h2 id="evidence-heading" className="section-heading">Evidence &amp; verification</h2>
        </div>
        <span className="section-note">On-chain references</span>
      </div>

      {evidence && evidence.length > 0 && (
        <div className="evidence-grid">
          {evidence.map((item, idx) => (
            <div key={idx} className="evidence-item">
              <span className="evidence-label">{item.label}</span>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="evidence-link break-all tabular-nums"
                >
                  <span className="external-arrow" aria-hidden="true">↗</span>
                  <span>{item.description || item.url}</span>
                </a>
              ) : (
                <span className="evidence-text break-all">{item.description}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {limitations && limitations.length > 0 && (
        <div className="limitations-container">
          <div className="limitations-header">
            <span className="limitations-stamp" aria-hidden="true">SCOPE</span>
            <h3 className="subheading-minor">Analysis limitations &amp; boundaries:</h3>
          </div>
          <ul className="limitations-list">
            {limitations.map((lim, idx) => (
              <li key={idx} className="limitations-list-item">
                <span className="limitation-bullet" aria-hidden="true">―</span>
                <span>{lim}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
