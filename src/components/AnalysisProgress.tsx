import React, { useEffect, useState } from 'react';
import type { SupportedNetwork } from '../types/analysis';

interface AnalysisProgressProps {
  network?: SupportedNetwork;
  governorAddress?: string;
  proposalId?: string;
}

interface Step {
  id: string;
  title: string;
  detail: string;
}

const PIPELINE_STAGES: Step[] = [
  {
    id: 'rpc',
    title: 'Connecting to RPC Node',
    detail: 'Verifying network chain ID and Governor contract bytecode...',
  },
  {
    id: 'logs',
    title: 'Retrieving Proposal Logs',
    detail: 'Locating ProposalCreated event and reading on-chain proposal state...',
  },
  {
    id: 'abi',
    title: 'Resolving ABIs & Proxies',
    detail: 'Inspecting EIP-1967/1822 storage slots and fetching verified interfaces...',
  },
  {
    id: 'decode',
    title: 'Decoding Execution Actions',
    detail: 'Parsing function selectors, targets, ETH values, and calldata arguments...',
  },
  {
    id: 'advisory',
    title: 'Evaluating Deterministic Rules & Sponsor Advisory',
    detail: 'Running sensitive operation checks and collecting advisory reviews...',
  },
];

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
          <div className="progress-spinner-wrap">
            <svg
              className="progress-spinner"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
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
            <h3 className="progress-headline">Analysing on-chain proposal</h3>
            <p className="progress-subheadline">
              {network ? <span className="network-tag">{network.toUpperCase()}</span> : null}
              {formattedGov ? <span>{formattedGov}</span> : null}
              {formattedId ? <span>Proposal #{formattedId}</span> : null}
            </p>
          </div>
        </div>

        <div className="progress-elapsed">
          <span className="elapsed-label">Elapsed</span>
          <span className="elapsed-counter tabular-nums">{seconds.toFixed(1)}s</span>
        </div>
      </div>

      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: '100%' }}
        />
        <div className="progress-bar-shimmer" />
      </div>

      <div className="progress-steps-list">
        {PIPELINE_STAGES.map((step) => (
          <div key={step.id} className="progress-step-item step-current">
            <div className="step-indicator">
              <span className="step-icon current-icon" aria-label="Pipeline stage in progress">
                <span className="pulse-dot" />
              </span>
            </div>

            <div className="step-content">
              <span className="step-title">{step.title}</span>
              <span className="step-detail">{step.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
