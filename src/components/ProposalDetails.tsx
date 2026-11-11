import React, { useState } from 'react';
import type { ProposalInfo, SupportedNetwork } from '../types/analysis';
import { Address } from './Address';

interface ProposalDetailsProps {
  proposal: ProposalInfo;
  network: SupportedNetwork;
  governorAddress: string;
}

export const ProposalDetails: React.FC<ProposalDetailsProps> = ({
  proposal,
  network,
  governorAddress,
}) => {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const explorerBase =
    network === 'ethereum' ? 'https://etherscan.io' : 'https://basescan.org';

  const copyIdToClipboard = () => {
    navigator.clipboard.writeText(proposal.id).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const hasLongDescription =
    proposal.description && proposal.description.length > 300;
  const displayedDescription =
    hasLongDescription && !showFullDescription
      ? proposal.description.slice(0, 300) + '...'
      : proposal.description || 'No description provided with this proposal.';

  return (
    <section className="section-card proposal-details-section" aria-labelledby="proposal-heading">
      <div className="section-header-row">
        <div className="section-heading-group">
          <span className="section-kicker">On-Chain Record</span>
          <h2 id="proposal-heading" className="section-heading">Proposal record &amp; state</h2>
        </div>
        <div className="header-status-wrap">
          <span className={`status-pill status-${proposal.status.toLowerCase()}`}>
            <span className="status-dot-indicator" aria-hidden="true" />
            <span>{proposal.status}</span>
          </span>
        </div>
      </div>

      <div className="details-grid">
        <div className="detail-item">
          <span className="detail-label">Network</span>
          <span className="detail-value">{network === 'ethereum' ? 'Ethereum Mainnet (1)' : 'Base Mainnet (8453)'}</span>
        </div>

        {proposal.eventSource && (
          <div className="detail-item">
            <span className="detail-label">Event Source</span>
            <span className="detail-value" data-testid="event-source" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {proposal.eventSource.startsWith('pinned snapshot') ? (
                <span className="event-source-pill pinned" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: '4px' }}>
                  Event source: {proposal.eventSource}
                </span>
              ) : (
                <span className="event-source-pill live" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '4px' }}>
                  Event source: {proposal.eventSource}
                </span>
              )}
            </span>
          </div>
        )}

        <div className="detail-item">
          <span className="detail-label">Governor Contract</span>
          <span className="detail-value tabular-nums">
            <Address
              value={governorAddress}
              explorerUrl={`${explorerBase}/address/${governorAddress}`}
              label="Governor"
            />
          </span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Proposal ID</span>
          <span
            className="detail-value tabular-nums"
            style={{
              overflowWrap: 'anywhere',
              wordBreak: 'break-all',
              minWidth: 0,
            }}
          >
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{proposal.id}</span>
            <button
              type="button"
              className="copy-btn"
              onClick={copyIdToClipboard}
              aria-label="Copy Proposal ID"
            >
              {copiedId ? 'Copied' : 'Copy'}
            </button>
          </span>
        </div>

        {proposal.proposer && (
          <div className="detail-item">
            <span className="detail-label">Proposer</span>
            <span className="detail-value tabular-nums">
              <Address
                value={proposal.proposer}
                explorerUrl={`${explorerBase}/address/${proposal.proposer}`}
                label="Proposer"
              />
            </span>
          </div>
        )}

        {proposal.blockNumber && (
          <div className="detail-item">
            <span className="detail-label">Created at block</span>
            <span className="detail-value tabular-nums">
              <a
                href={`${explorerBase}/block/${proposal.blockNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="address-link"
              >
                {proposal.blockNumber}
              </a>
            </span>
          </div>
        )}

        {proposal.creationTransaction && (
          <div className="detail-item">
            <span className="detail-label">Creation transaction</span>
            <span className="detail-value tabular-nums">
              <Address
                value={proposal.creationTransaction}
                explorerUrl={`${explorerBase}/tx/${proposal.creationTransaction}`}
                label="Creation transaction"
                prefixLength={10}
                suffixLength={8}
              />
            </span>
          </div>
        )}
      </div>

      <div className="description-container">
        <div className="description-header-row">
          <span className="detail-label">Submitted Description</span>
          <span className="description-meta-len">
            {proposal.description ? `${proposal.description.length} chars` : '0 chars'}
          </span>
        </div>
        <div className="description-box">
          <p className="description-text">{displayedDescription}</p>
          {hasLongDescription && (
            <button
              type="button"
              className="expand-text-btn"
              onClick={() => setShowFullDescription(!showFullDescription)}
            >
              {showFullDescription ? 'Show less' : 'Show full description'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
