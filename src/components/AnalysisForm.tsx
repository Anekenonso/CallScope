import React, { useState } from 'react';
import type { SupportedNetwork, AnalysisRequest } from '../types/analysis';
import { validateAnalysisInput, parseTxHashOrUrl, type FormValidationErrors } from '../lib/validation';

interface AnalysisFormProps {
  onAnalyse: (request: AnalysisRequest) => void;
  isLoading: boolean;
}

export const AnalysisForm: React.FC<AnalysisFormProps> = ({ onAnalyse, isLoading }) => {
  const [inputMode, setInputMode] = useState<'governor' | 'tx'>('governor');
  const [network, setNetwork] = useState<SupportedNetwork>('ethereum');
  const [governorAddress, setGovernorAddress] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [txHashOrUrl, setTxHashOrUrl] = useState('');
  const [reverifyLive, setReverifyLive] = useState(false);
  const [errors, setErrors] = useState<FormValidationErrors>({});

  const loadExample = (
    exNetwork: SupportedNetwork,
    exGov: string,
    exId: string
  ) => {
    setInputMode('governor');
    setNetwork(exNetwork);
    setGovernorAddress(exGov);
    setProposalId(exId);
    setTxHashOrUrl('');
    setErrors({});
  };

  const handleTxInputChange = (val: string) => {
    setTxHashOrUrl(val);
    const parsed = parseTxHashOrUrl(val);
    if (parsed?.inferredNetwork) {
      setNetwork(parsed.inferredNetwork);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMode === 'tx') {
      const validation = validateAnalysisInput(network, '', '', txHashOrUrl);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }
      setErrors({});
      const parsed = parseTxHashOrUrl(txHashOrUrl);
      const effectiveNetwork = parsed?.inferredNetwork || network;
      onAnalyse({
        network: effectiveNetwork,
        txHashOrUrl: txHashOrUrl.trim(),
        reverifyLive,
      });
    } else {
      const validation = validateAnalysisInput(network, governorAddress, proposalId);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      setErrors({});
      onAnalyse({
        network,
        governorAddress: governorAddress.trim(),
        proposalId: proposalId.trim(),
        reverifyLive,
      });
    }
  };

  return (
    <div className="analysis-form-card">
      <div className="form-card-header">
        <div className="form-card-title-group">
          <span className="form-kicker">Query Desk</span>
          <h2 className="form-card-headline">Examine proposal calldata &amp; permissions</h2>
        </div>
        <span className="form-card-subtext">Direct RPC event retrieval &amp; bytecode ABI resolution</span>
      </div>

      <form onSubmit={handleSubmit} className="analysis-form" noValidate>
        {/* Input Mode Selector */}
        <div className="form-mode-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            className={`tab-btn ${inputMode === 'governor' ? 'tab-btn-active' : ''}`}
            onClick={() => setInputMode('governor')}
            disabled={isLoading}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #334155)',
              background: inputMode === 'governor' ? 'var(--primary-bg, #2563eb)' : 'transparent',
              color: inputMode === 'governor' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Governor + Proposal ID
          </button>
          <button
            type="button"
            className={`tab-btn ${inputMode === 'tx' ? 'tab-btn-active' : ''}`}
            onClick={() => setInputMode('tx')}
            disabled={isLoading}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #334155)',
              background: inputMode === 'tx' ? 'var(--primary-bg, #2563eb)' : 'transparent',
              color: inputMode === 'tx' ? '#ffffff' : 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Tx Hash / Explorer URL
          </button>
        </div>

        <div className="form-grid">
          {/* Network selector */}
          <div className="form-field">
            <label htmlFor="network-select">Chain</label>
            <div className="select-wrapper">
              <select
                id="network-select"
                className="form-select"
                value={network}
                disabled={isLoading}
                onChange={(e) => setNetwork(e.target.value as SupportedNetwork)}
              >
                <option value="ethereum">Ethereum (1)</option>
                <option value="base">Base (8453)</option>
              </select>
            </div>
            {errors.network && <span className="field-error">{errors.network}</span>}
          </div>

          {inputMode === 'tx' ? (
            <div className="form-field field-tx-hash" style={{ gridColumn: 'span 2' }}>
              <label htmlFor="tx-hash-input">Creation Tx Hash or Explorer URL</label>
              <input
                id="tx-hash-input"
                type="text"
                className="form-input tabular-nums"
                placeholder="0x... or https://etherscan.io/tx/0x... or https://basescan.org/tx/0x..."
                value={txHashOrUrl}
                disabled={isLoading}
                onChange={(e) => handleTxInputChange(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              {errors.txHashOrUrl && (
                <span className="field-error">{errors.txHashOrUrl}</span>
              )}
            </div>
          ) : (
            <>
              {/* Governor address input */}
              <div className="form-field field-governor">
                <label htmlFor="governor-address">Governor Contract</label>
                <input
                  id="governor-address"
                  type="text"
                  className="form-input tabular-nums"
                  placeholder="0x..."
                  value={governorAddress}
                  disabled={isLoading}
                  onChange={(e) => setGovernorAddress(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                />
                {errors.governorAddress && (
                  <span className="field-error">{errors.governorAddress}</span>
                )}
              </div>

              {/* Proposal ID input */}
              <div className="form-field field-proposal-id">
                <label htmlFor="proposal-id">Proposal ID</label>
                <input
                  id="proposal-id"
                  type="text"
                  className="form-input tabular-nums"
                  placeholder="e.g. 777678..."
                  value={proposalId}
                  disabled={isLoading}
                  onChange={(e) => setProposalId(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                />
                {errors.proposalId && (
                  <span className="field-error">{errors.proposalId}</span>
                )}
              </div>
            </>
          )}

          {/* Primary Action Button */}
          <div className="form-action-wrap">
            <button
              type="submit"
              className="form-button"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <span className="button-inner-loading">
                  <span className="button-spinner" aria-hidden="true" />
                  <span>Analysing...</span>
                </span>
              ) : (
                'Analyse'
              )}
            </button>
          </div>
        </div>

        {/* Re-verify live toggle */}
        <div className="reverify-toggle-wrap" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer', color: 'var(--text-muted, #94a3b8)' }}>
            <input
              type="checkbox"
              id="reverify-live-toggle"
              checked={reverifyLive}
              disabled={isLoading}
              onChange={(e) => setReverifyLive(e.target.checked)}
            />
            <span>Re-verify live (bypass pinned snapshot)</span>
          </label>
        </div>

        {/* Examples row */}
        <div className="examples-row" style={{ marginTop: '16px' }}>
          <span className="examples-label">Pinned examples:</span>
          <button
            type="button"
            className="example-preset-pill"
            disabled={isLoading}
            onClick={() =>
              loadExample(
                'ethereum',
                '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
                '77767899528494238518019756391533686963875234067646094287125791110488147463806'
              )
            }
          >
            <span className="preset-network-badge">ETH</span>
            <span className="preset-name">ENS EP 6.50</span>
            <span className="preset-tag">Role Grant</span>
          </button>
          <button
            type="button"
            className="example-preset-pill"
            disabled={isLoading}
            onClick={() =>
              loadExample(
                'base',
                '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9',
                '27419154582993156392805749742953507877176483681373228046916881327937839104508'
              )
            }
          >
            <span className="preset-network-badge">BASE</span>
            <span className="preset-name">Unlock Transfers</span>
            <span className="preset-tag">Token Logic</span>
          </button>
        </div>
      </form>
    </div>
  );
};
