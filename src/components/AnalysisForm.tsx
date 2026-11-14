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
  const [creationTxHash, setCreationTxHash] = useState('');
  const [showCreationTx, setShowCreationTx] = useState(false);
  const [errors, setErrors] = useState<FormValidationErrors>({});

  const loadExample = (
    exNetwork: SupportedNetwork,
    exGov: string,
    exId: string,
    exTx: string = ''
  ) => {
    setNetwork(exNetwork);
    setGovernorAddress(exGov);
    setProposalId(exId);
    setCreationTxHash(exTx);
    if (exTx) {
      setShowCreationTx(true);
    }
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
      creationTxHash: creationTxHash.trim() || undefined,
    });
  };

  return (
    <div className="analysis-form-card">
      <form onSubmit={handleSubmit} className="analysis-form" noValidate>
        <div className="form-grid">
          {/* Network selector */}
          <div className="form-field">
            <label htmlFor="network-select">Network</label>
            <select
              id="network-select"
              className="form-select"
              value={network}
              disabled={isLoading}
              onChange={(e) => setNetwork(e.target.value as SupportedNetwork)}
            >
              <option value="ethereum">Ethereum</option>
              <option value="base">Base</option>
            </select>
            {errors.network && <span className="field-error">{errors.network}</span>}
          </div>

          {/* Governor address input */}
          <div className="form-field">
            <label htmlFor="governor-address">Governor</label>
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
          <div className="form-field">
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
          <button
            type="submit"
            className="form-button"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-pulse-ring" aria-hidden="true" />
                <span>Analysing...</span>
              </>
            ) : (
              'Analyse'
            )}
          </button>
        </div>

        {/* Optional creation tx disclosure toggle */}
        <div className="optional-tx-section">
          <button
            type="button"
            className="disclosure-toggle-btn"
            disabled={isLoading}
            onClick={() => setShowCreationTx(!showCreationTx)}
          >
            {showCreationTx ? '− Hide creation transaction' : '+ Creation transaction (recommended for Base)'}
          </button>
          {showCreationTx && (
            <div className="form-field optional-tx-field">
              <label htmlFor="creation-tx-input">Creation transaction hash or explorer URL</label>
              <input
                id="creation-tx-input"
                type="text"
                className="form-input tabular-nums"
                placeholder="0x... or https://basescan.org/tx/..."
                value={creationTxHash}
                disabled={isLoading}
                onChange={(e) => setCreationTxHash(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          )}
        </div>

        {/* Examples row */}
        <div className="examples-row">
          <span className="examples-label">Live fixtures:</span>
          <button
            type="button"
            className="example-link-btn"
            disabled={isLoading}
            onClick={() =>
              loadExample(
                'ethereum',
                '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
                '77767899528494238518019756391533686963875234067646094287125791110488147463806'
              )
            }
          >
            ENS EP 6.50 (Ethereum)
          </button>
          <span className="example-divider">·</span>
          <button
            type="button"
            className="example-link-btn"
            disabled={isLoading}
            onClick={() =>
              loadExample(
                'base',
                '0x4cEeE1b6289624d381383C1Bb42B118d5f2c3274',
                '67980167403673109499075429330278697663140272061888632626477705936897665178458',
                '0x6c1eec8ddfaa65a308c4b404852e2fdda0d911365bde23ceb51986ca8ca04554'
              )
            }
          >
            Summer SIP 4.2 (Base)
          </button>
          <span className="example-divider">·</span>
          <button
            type="button"
            className="example-link-btn"
            disabled={isLoading}
            onClick={() =>
              loadExample(
                'base',
                '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9',
                '27419154582993156392805749742953507877176483681373228046916881327937839104508',
                '0xa7ba89ff0db229f6f00b01d9d5f006c1db8c0591ffba8c7cb1c6f6b5e0d5b385'
              )
            }
          >
            Unlock DAO (Base)
          </button>
        </div>
      </form>
    </div>
  );
};
