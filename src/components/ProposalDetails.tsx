import React, { useState } from 'react';
import type { ProposalInfo, SupportedNetwork } from '../types/analysis';

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
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const explorerBase =
    network === 'ethereum' ? 'https://etherscan.io' : 'https://basescan.org';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
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

        <div className="detail-item">
          <span className="detail-label">Governor Contract</span>
          <span className="detail-value tabular-nums">
            <a
              href={`${explorerBase}/address/${governorAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="address-link"
              title="View on Explorer"
            >
              {governorAddress}
            </a>
            <button
              type="button"
              className="copy-btn"
              onClick={() => copyToClipboard(governorAddress, 'Governor')}
              aria-label="Copy Governor address"
            >
              {copiedField === 'Governor' ? 'Copied' : 'Copy'}
            </button>
          </span>
        </div>

        <div className="detail-item">
          <span className="detail-label">Proposal ID</span>
          <span className="detail-value tabular-nums break-all">
            {proposal.id}
            <button
              type="button"
              className="copy-btn"
              onClick={() => copyToClipboard(proposal.id, 'ID')}
              aria-label="Copy Proposal ID"
            >
              {copiedField === 'ID' ? 'Copied' : 'Copy'}
            </button>
          </span>
        </div>

        {proposal.proposer && (
          <div className="detail-item">
            <span className="detail-label">Proposer</span>
            <span className="detail-value tabular-nums">
              <a
                href={`${explorerBase}/address/${proposal.proposer}`}
                target="_blank"
                rel="noopener noreferrer"
                className="address-link"
              >
                {proposal.proposer}
              </a>
              <button
                type="button"
                className="copy-btn"
                onClick={() => copyToClipboard(proposal.proposer!, 'Proposer')}
                aria-label="Copy Proposer address"
              >
                {copiedField === 'Proposer' ? 'Copied' : 'Copy'}
              </button>
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
            <span className="detail-value tabular-nums break-all">
              <a
                href={`${explorerBase}/tx/${proposal.creationTransaction}`}
                target="_blank"
                rel="noopener noreferrer"
                className="address-link"
              >
                {proposal.creationTransaction}
              </a>
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
