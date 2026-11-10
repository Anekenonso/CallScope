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

const STEPS: Step[] = [
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // Timer for elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => +(prev + 0.1).toFixed(1));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Progression logic based on typical analysis pipeline timings
  useEffect(() => {
    const t1 = setTimeout(() => setCurrentStepIndex(1), 1800);
    const t2 = setTimeout(() => setCurrentStepIndex(2), 4800);
    const t3 = setTimeout(() => setCurrentStepIndex(3), 8500);
    const t4 = setTimeout(() => setCurrentStepIndex(4), 13000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
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
          style={{ width: `${Math.min(96, (currentStepIndex + 1) * 20)}%` }}
        />
        <div className="progress-bar-shimmer" />
      </div>

      <div className="progress-steps-list">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <div
              key={step.id}
              className={`progress-step-item ${
                isDone ? 'step-done' : isCurrent ? 'step-current' : 'step-pending'
              }`}
            >
              <div className="step-indicator">
                {isDone ? (
                  <span className="step-icon done-icon" aria-label="Completed">
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      aria-hidden="true"
                    >
                      <path
                        d="M3.5 8.5L6.5 11.5L12.5 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : isCurrent ? (
                  <span className="step-icon current-icon" aria-label="In progress">
                    <span className="pulse-dot" />
                  </span>
                ) : (
                  <span className="step-icon pending-icon" aria-label="Pending">
                    <span className="pending-dot" />
                  </span>
                )}
              </div>

              <div className="step-content">
                <span className="step-title">{step.title}</span>
                <span className="step-detail">
                  {isCurrent ? step.detail : isDone ? 'Complete' : step.detail}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

