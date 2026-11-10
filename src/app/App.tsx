import React, { useState, Component, type ErrorInfo, type ReactNode } from 'react';
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
import { AnalysisProgress } from '../components/AnalysisProgress';
import { analyseProposal } from '../lib/api-client';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Callscope UI Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-banner" role="alert">
          <span className="error-title">Display error</span>
          <span>
            {this.state.error?.message ||
              'A rendering error occurred while displaying the proposal results.'}
          </span>
          <button
            type="button"
            className="form-button"
            style={{ marginTop: '12px', width: 'fit-content' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reset display
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [activeRequest, setActiveRequest] = useState<AnalysisRequest | null>(null);

  const handleAnalyse = async (request: AnalysisRequest) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setActiveRequest(request);

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
    <ErrorBoundary>
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
            <AnalysisProgress
              network={activeRequest?.network}
              governorAddress={activeRequest?.governorAddress}
              proposalId={activeRequest?.proposalId}
            />
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
    </ErrorBoundary>
  );
};
