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
        <div className="section-header-row">
          <div className="section-heading-group">
            <span className="section-kicker">Execution Ledger</span>
            <h2 id="actions-heading" className="section-heading">Actions (0)</h2>
          </div>
          <span className="section-note">Text-only proposal</span>
        </div>
        <div className="empty-message-box">
          <p className="empty-message">This proposal contains zero executable on-chain calls (text-only proposal).</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section-card actions-section" aria-labelledby="actions-heading">
      <div className="section-header-row">
        <div className="section-heading-group">
          <span className="section-kicker">Execution Ledger · The Call Record</span>
          <h2 id="actions-heading" className="section-heading">Actions ({actions.length})</h2>
        </div>
        <span className="section-note">Original execution sequence preserved</span>
      </div>

      <div className="actions-stack">
        {actions.map((act) => {
          const isDecoded = act.decoded;
          const isExpanded = !!expandedCalldata[act.index];
          const byteLength = act.rawCalldata.length > 2 ? (act.rawCalldata.length - 2) / 2 : 0;

          return (
            <article
              key={act.index}
              id={`action-${act.index}`}
              className={`action-item ${!isDecoded ? 'action-item-undecoded' : ''}`}
            >
              {/* Receipt Header Strip */}
              <div className="action-item-header">
                <div className="action-identity">
                  <span className="action-number">#{act.index + 1}</span>
                  <div className="action-title-group">
                    <div className="action-func-row">
                      <span className="action-function-name">
                        {act.isNativeTransfer ? (
                          'Native ETH Transfer'
                        ) : isDecoded ? (
                          act.functionName || act.signature || 'Call'
                        ) : act.isSafeWrapper ? (
                          'Safe Transaction Wrapper (execTransaction)'
                        ) : (
                          <span className="undecoded-label">Undecoded action ({act.selector})</span>
                        )}
                      </span>
                      {act.selector && (
                        <span className="action-selector-tag tabular-nums">{act.selector}</span>
                      )}
                      {act.isNativeTransfer && (
                        <span className="action-selector-tag">Native ETH</span>
                      )}
                      {act.isSafeWrapper && (
                        <span className="action-selector-tag" style={{ background: '#78350f', color: '#fef3c7' }}>
                          Safe Wrapper
                        </span>
                      )}
                    </div>
                    <div className="action-target">
                      <span className="target-prefix">Target:</span>{' '}
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
                    </div>
                  </div>
                </div>

                <div className="action-meta-badge">
                  {act.formattedAmount ? (
                    <span className="value-badge tabular-nums">
                      {act.formattedAmount}
                    </span>
                  ) : act.value && act.value !== '0' ? (
                    <span className="value-badge tabular-nums">
                      Value: {act.value} wei
                    </span>
                  ) : null}
                  <span className={`decode-status-badge ${isDecoded ? 'status-decoded' : 'status-undecoded'}`}>
                    <span className="badge-dot" aria-hidden="true" />
                    <span>{isDecoded ? 'Decoded' : act.isSafeWrapper ? 'Opaque (Wrapper)' : 'Opaque'}</span>
                  </span>
                </div>
              </div>

              {/* Decoded Arguments Table */}
              {isDecoded && act.args && act.args.length > 0 && (
                <div className="action-args-container">
                  <div className="args-table-header">
                    <span className="args-table-label">Verified Parameters:</span>
                    <span className="args-count tabular-nums">{act.args.length} typed argument{act.args.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="args-list">
                    {act.args.map((arg, argIdx) => (
                      <div key={argIdx} className="arg-row">
                        <span className="arg-name">{arg.name || `param_${argIdx}`}</span>
                        <span className="arg-type">{arg.type}</span>
                        <div className="arg-value-group">
                          {arg.formattedValue ? (
                            <span className="arg-value tabular-nums break-all font-semibold">
                              {arg.formattedValue}
                              {arg.rawAmount && arg.rawAmount !== arg.formattedValue && (
                                <span className="text-xs text-muted block opacity-75">
                                  Raw: {arg.rawAmount} ({arg.decimals ?? 18} decimals)
                                </span>
                              )}
                            </span>
                          ) : arg.decimalsUnavailable ? (
                            <span className="arg-value tabular-nums break-all">
                              {arg.value}
                              <span className="text-xs text-amber-500 block">
                                (formatted amount unavailable — unverified decimals)
                              </span>
                            </span>
                          ) : (
                            <span className="arg-value tabular-nums break-all">{arg.value}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decode Error Notice */}
              {!isDecoded && act.decodeError && (
                <div className="decode-error-notice">
                  <span className="decode-error-icon" aria-hidden="true">!</span>
                  <span>Could not resolve ABI: {act.decodeError}</span>
                </div>
              )}

              {/* Raw Calldata Collapsible Inspector */}
              <div className="calldata-container">
                <button
                  type="button"
                  className="calldata-toggle-btn"
                  onClick={() => toggleCalldata(act.index)}
                  aria-expanded={isExpanded}
                >
                  <span className="calldata-toggle-icon" aria-hidden="true">
                    {isExpanded ? '▾' : '▸'}
                  </span>
                  <span>{isExpanded ? 'Hide raw calldata' : 'Inspect raw calldata'}</span>
                  <span className="calldata-size-hint tabular-nums">({byteLength} bytes)</span>
                </button>

                {isExpanded && (
                  <div className="calldata-inspect-box">
                    <div className="calldata-actions">
                      <span className="calldata-length tabular-nums">
                        {byteLength} bytes ({act.rawCalldata.length} hex chars)
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
