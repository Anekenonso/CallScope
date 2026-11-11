import React, { useEffect, useState } from 'react';
import type { SupportedNetwork } from '../types/analysis';

interface AnalysisProgressProps {
  network?: SupportedNetwork;
  governorAddress?: string;
  proposalId?: string;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  network,
  governorAddress,
  proposalId,
}) => {
  const [seconds, setSeconds] = useState(0);

  // Real elapsed seconds counter
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => +(prev + 0.1).toFixed(1));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const formattedGov = governorAddress
    ? governorAddress.length > 14
      ? `${governorAddress.slice(0, 8)}...${governorAddress.slice(-6)}`
      : governorAddress
    : null;

  const formattedId = proposalId
    ? proposalId.length > 16
      ? `${proposalId.slice(0, 10)}...`
      : proposalId
    : null;

  return (
    <div
      className="analysis-progress-card"
      role="status"
      aria-live="polite"
      aria-label="Analysis in progress"
    >
      <div className="progress-header">
        <div className="progress-title-wrap">
          <div className="progress-spinner-wrap" aria-hidden="true">
            <svg
              className="progress-spinner"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="spinner-track"
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <path
                className="spinner-indicator"
                d="M12 3a9 9 0 0 1 9 9"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div className="progress-kicker">On-Chain Inspection Active</div>
            <h3 className="progress-headline">Analysing on-chain proposal</h3>
            <p className="progress-subheadline">
              {network ? <span className="network-tag">{network.toUpperCase()}</span> : null}
              {formattedGov ? <span className="target-addr-tag tabular-nums">{formattedGov}</span> : null}
              {formattedId ? <span className="proposal-id-tag tabular-nums">#{formattedId}</span> : null}
            </p>
          </div>
        </div>

        <div className="progress-elapsed">
          <span className="elapsed-label">Elapsed</span>
          <span className="elapsed-counter tabular-nums">{seconds.toFixed(1)}s</span>
        </div>
      </div>

      <div className="progress-bar-track" aria-hidden="true">
        <div
          className="progress-bar-fill indeterminate-bar"
          style={{ width: '100%' }}
        />
        <div className="progress-bar-shimmer" />
      </div>

      <div className="progress-indeterminate-status" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.875rem' }}>
          <span className="pulse-dot" style={{ backgroundColor: '#38bdf8', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} />
          <span>Executing deterministic on-chain governance inspection pipeline...</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
          Resolving verified smart contract ABIs, decoding calldata payloads, verifying function role capabilities against source code, and matching claims deterministically.
        </p>
      </div>
    </div>
  );
};
