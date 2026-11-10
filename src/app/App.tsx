import React, { useState } from 'react';
import type { AnalysisRequest, AnalysisResponse } from '../types/analysis';
import { Header } from '../components/Header';
import { AnalysisForm } from '../components/AnalysisForm';
import { AssessmentBanner } from '../components/AssessmentBanner';
import { ProposalDetails } from '../components/ProposalDetails';
import { ActionList } from '../components/ActionList';
import { FindingsList } from '../components/FindingsList';
import { ConsistencyView } from '../components/ConsistencyView';
import { ProviderReviews } from '../components/ProviderReviews';
import { EvidenceLinks } from '../components/EvidenceLinks';
import { analyseProposal } from '../lib/api-client';

export const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const handleAnalyse = async (request: AnalysisRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await analyseProposal(request);
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const undecodedCount =
    result?.actions?.filter((act) => !act.decoded).length ?? 0;

  return (
    <div className="app-container">
      <Header />

      <main>
        <AnalysisForm onAnalyse={handleAnalyse} isLoading={isLoading} />

        {error && (
          <div className="error-banner" role="alert">
            <span className="error-title">Analysis failed</span>
            <span>{error}</span>
          </div>
        )}

        {isLoading && (
          <div className="loading-box" aria-live="polite">
            <span>Querying RPC, retrieving proposal logs, and decoding actions...</span>
          </div>
        )}

        {result && (
          <div className="results-container">
            <AssessmentBanner
              assessment={result.assessment}
              findingsCount={result.findings?.length ?? 0}
              undecodedCount={undecodedCount}
            />

            <ProposalDetails
              proposal={result.proposal}
              network={result.network}
              governorAddress={result.governorAddress}
            />

            <ActionList actions={result.actions} network={result.network} />

            <FindingsList findings={result.findings} />

            <ConsistencyView consistency={result.descriptionConsistency} />

            <ProviderReviews
              serv={result.reviews?.serv}
              dolphin={result.reviews?.dolphin}
            />

            <EvidenceLinks
              evidence={result.evidence}
              limitations={result.limitations}
            />
          </div>
        )}
      </main>
    </div>
  );
};
