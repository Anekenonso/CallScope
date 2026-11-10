import React, { useState } from 'react';
import type { ProposalAction, SupportedNetwork } from '../types/analysis';

interface ActionListProps {
  actions: ProposalAction[];
  network: SupportedNetwork;
}

export const ActionList: React.FC<ActionListProps> = ({ actions, network }) => {
  const [expandedCalldata, setExpandedCalldata] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const explorerBase =
    network === 'ethereum' ? 'https://etherscan.io' : 'https://basescan.org';

  const toggleCalldata = (index: number) => {
    setExpandedCalldata((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const copyCalldata = (calldata: string, index: number) => {
    navigator.clipboard.writeText(calldata).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  if (!actions || actions.length === 0) {
    return (
      <section className="section-card actions-section" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="section-heading">Actions (0)</h2>
        <p className="empty-message">This proposal contains zero executable on-chain calls (text-only proposal).</p>
      </section>
    );
  }

  return (
    <section className="section-card actions-section" aria-labelledby="actions-heading">
      <div className="section-header-row">
        <h2 id="actions-heading" className="section-heading">Actions ({actions.length})</h2>
        <span className="section-note">Original execution sequence preserved</span>
      </div>

      <div className="actions-stack">
        {actions.map((act) => {
          const isDecoded = act.decoded;
          const isExpanded = !!expandedCalldata[act.index];

          return (
            <article
              key={act.index}
              className={`action-item ${!isDecoded ? 'action-item-undecoded' : ''}`}
            >
              <div className="action-item-header">
                <div className="action-identity">
                  <span className="action-number">#{act.index + 1}</span>
                  <div className="action-title-group">
                    <span className="action-function-name">
                      {isDecoded ? (
                        act.functionName || act.signature || 'Call'
                      ) : (
                        <span className="undecoded-label">Undecoded action ({act.selector})</span>
                      )}
                    </span>
                    <span className="action-target">
                      Target:{' '}
                      <a
                        href={`${explorerBase}/address/${act.target}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="address-link tabular-nums"
                      >
                        {act.targetName ? `${act.targetName} (${act.target.slice(0, 10)}...)` : act.target}
                      </a>
                      {act.isProxy && act.implementation && (
                        <span className="proxy-indicator" title={`Implementation: ${act.implementation}`}>
                          [Proxy → {act.implementation.slice(0, 8)}...]
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="action-meta-badge">
                  {act.value && act.value !== '0' && (
                    <span className="value-badge tabular-nums">
                      Value: {act.value} wei
                    </span>
                  )}
                  <span className={`decode-status-badge ${isDecoded ? 'status-decoded' : 'status-undecoded'}`}>
                    {isDecoded ? 'Decoded' : 'Opaque'}
                  </span>
                </div>
              </div>

              {/* Decoded Arguments */}
              {isDecoded && act.args && act.args.length > 0 && (
                <div className="action-args-container">
                  <span className="args-table-label">Parameters:</span>
                  <div className="args-list">
                    {act.args.map((arg, argIdx) => (
                      <div key={argIdx} className="arg-row">
                        <span className="arg-name">{arg.name || `param_${argIdx}`}</span>
                        <span className="arg-type">{arg.type}</span>
                        <span className="arg-value tabular-nums break-all">{arg.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decode Error if any */}
              {!isDecoded && act.decodeError && (
                <div className="decode-error-notice">
                  <span>Could not resolve ABI: {act.decodeError}</span>
                </div>
              )}

              {/* Raw Calldata Collapsible */}
              <div className="calldata-container">
                <button
                  type="button"
                  className="calldata-toggle-btn"
                  onClick={() => toggleCalldata(act.index)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? 'Hide raw calldata' : 'Inspect raw calldata'}
                </button>

                {isExpanded && (
                  <div className="calldata-inspect-box">
                    <div className="calldata-actions">
                      <span className="calldata-length tabular-nums">
                        {act.rawCalldata.length > 2 ? `${(act.rawCalldata.length - 2) / 2} bytes` : '0 bytes'}
                      </span>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => copyCalldata(act.rawCalldata, act.index)}
                        aria-label="Copy raw calldata"
                      >
                        {copiedIndex === act.index ? 'Copied' : 'Copy calldata'}
                      </button>
                    </div>
                    <pre className="calldata-pre tabular-nums break-all">{act.rawCalldata}</pre>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

