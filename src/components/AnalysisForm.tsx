import React, { useState } from 'react';
import type { SupportedNetwork, AnalysisRequest } from '../types/analysis';
import { validateAnalysisInput, type FormValidationErrors } from '../lib/validation';

interface AnalysisFormProps {
  onAnalyse: (request: AnalysisRequest) => void;
  isLoading: boolean;
}

export function AnalysisForm({ onAnalyse, isLoading }: AnalysisFormProps) {
  const [network, setNetwork] = useState<SupportedNetwork>('ethereum');
  const [governorAddress, setGovernorAddress] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [errors, setErrors] = useState<FormValidationErrors>({});

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
      <form onSubmit={handleSubmit} className="analysis-form" noValidate>
        <div className="form-grid">
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

          <div className="form-field">
            <label htmlFor="governor-address">Governor</label>
            <input
              id="governor-address"
              type="text"
              className="form-input"
              placeholder="0x..."
              value={governorAddress}
              disabled={isLoading}
              onChange={(e) => setGovernorAddress(e.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
            {errors.governorAddress && <span className="field-error">{errors.governorAddress}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="proposal-id">Proposal ID</label>
            <input
              id="proposal-id"
              type="text"
              className="form-input"
              placeholder="e.g. 777678..."
              value={proposalId}
              disabled={isLoading}
              onChange={(e) => setProposalId(e.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
            {errors.proposalId && <span className="field-error">{errors.proposalId}</span>}
          </div>

          <button
            type="submit"
            className="form-button"
            disabled={isLoading}
          >
            {isLoading ? 'Analysing...' : 'Analyse'}
          </button>
        </div>
      </form>
    </div>
  );
}

