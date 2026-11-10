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
        <h2 id="evidence-heading" className="section-heading">Evidence &amp; verification</h2>
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
                  {item.description || item.url}
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
          <h3 className="subheading-minor">Analysis limitations:</h3>
          <ul className="limitations-list">
            {limitations.map((lim, idx) => (
              <li key={idx} className="limitations-list-item">
                {lim}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

