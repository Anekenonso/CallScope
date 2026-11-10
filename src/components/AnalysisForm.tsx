import React, { useState } from 'react';
import type { SupportedNetwork, AnalysisRequest } from '../types/analysis';
import { validateAnalysisInput, type FormValidationErrors } from '../lib/validation';

interface AnalysisFormProps {
  onAnalyse: (request: AnalysisRequest) => void;
  isLoading: boolean;
}

export const AnalysisForm: React.FC<AnalysisFormProps> = ({ onAnalyse, isLoading }) => {
  const [network, setNetwork] = useState<SupportedNetwork>('ethereum');
  const [governorAddress, setGovernorAddress] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [errors, setErrors] = useState<FormValidationErrors>({});

  const loadExample = (
    exNetwork: SupportedNetwork,
    exGov: string,
    exId: string
  ) => {
    setNetwork(exNetwork);
    setGovernorAddress(exGov);
    setProposalId(exId);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    });
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

        {/* Examples row */}
        <div className="examples-row">
          <span className="examples-label">Archived fixtures:</span>
          <button
            type="button"
            className="example-preset-pill"
            disabled={isLoading}
            onClick={() =>
              loadExample(
                'ethereum',
                '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
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
