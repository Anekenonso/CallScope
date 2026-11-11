import React, { useState, Component, type ErrorInfo, type ReactNode } from 'react';
import type { AnalysisRequest, AnalysisResponse, StageTaggedError } from '../types/analysis';
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
import { analyseProposal, fetchProposalReviews, ApiError } from '../lib/api-client';

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
          <div className="error-banner-content">
            <span className="error-title">Display error</span>
            <span>
              {this.state.error?.message ||
                'A rendering error occurred while displaying the proposal results.'}
            </span>
          </div>
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

export interface AppErrorState {
  message: string;
  stageTagged?: StageTaggedError;
}

export const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppErrorState | null>(null);
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
      setIsLoading(false);

      // Phase 2: Asynchronously fetch sponsor reviews if they are pending
      if (
        data.reviews?.serv?.status === 'pending' ||
        data.reviews?.dolphin?.status === 'pending'
      ) {
        try {
          const reviews = await fetchProposalReviews({
            network: data.network,
            governorAddress: data.governorAddress,
            proposalId: data.proposal.id,
          });
          setResult((prev) => (prev ? { ...prev, reviews } : prev));
        } catch (reviewErr) {
          console.error('Phase 2 sponsor review fetch error:', reviewErr);
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  reviews: {
                    serv: {
                      status: 'error',
                      error: 'Failed to load OpenServ SERV review.',
                    },
                    dolphin: {
                      status: 'error',
                      error: 'Failed to load Dolphin review.',
                    },
                  },
                }
              : prev
          );
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError({
          message: err.message,
          stageTagged: err.stageTagged,
        });
      } else {
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError({ message: msg });
      }
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
            <div className="error-banner" role="alert" data-testid="error-banner">
              <div className="error-banner-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="error-title">Analysis failed</span>
                  {error.stageTagged && (
                    <span
                      className="error-stage-badge"
                      data-testid="error-stage-tag"
                      style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        fontFamily: 'monospace',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}
                    >
                      Stage: {error.stageTagged.stage}
                      {error.stageTagged.via ? ` (${error.stageTagged.via})` : ''}
                    </span>
                  )}
                </div>
                <span>{error.message}</span>
                {error.stageTagged?.reason && (
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                    Reason: {error.stageTagged.reason}
                    {error.stageTagged.detail && error.stageTagged.detail !== error.message ? ` — ${error.stageTagged.detail}` : ''}
                  </span>
                )}
              </div>
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
                assessment={result.assessment}
              />

              <EvidenceLinks
                evidence={result.evidence}
                limitations={result.limitations}
              />
            </div>
          )}
        </main>

        <footer className="app-footer">
          <div className="footer-meta">
            <span className="footer-system-dot" aria-hidden="true" />
            <span>Callscope Governance Engine · Deterministic on-chain analysis strictly authoritative</span>
          </div>
          <span className="footer-note">Ethereum Mainnet (1) &amp; Base (8453) Governor Standards</span>
        </footer>
      </div>
    </ErrorBoundary>
  );
};
