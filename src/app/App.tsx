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
  const [isDeepLoading, setIsDeepLoading] = useState(false);
  const [currentTier, setCurrentTier] = useState<'instant' | 'standard' | 'deep'>('instant');
  const [copiedPermalink, setCopiedPermalink] = useState(false);
  const [error, setError] = useState<AppErrorState | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [activeRequest, setActiveRequest] = useState<AnalysisRequest | null>(null);

  const handleAnalyse = async (request: AnalysisRequest) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setActiveRequest(request);
    setCurrentTier('instant');

    try {
      const data = await analyseProposal(request);
      setResult(data);
      setIsLoading(false);

      // Phase 2: Asynchronously fetch sponsor reviews if they are pending (Standard tier)
      if (
        data.reviews?.serv?.status === 'pending' ||
        data.reviews?.dolphin?.status === 'pending'
      ) {
        try {
          const reviews = await fetchProposalReviews({
            network: data.network,
            governorAddress: data.governorAddress,
            proposalId: data.proposal.id,
            tier: 'standard',
          });
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  tier: 'standard',
                  reviews,
                  extendedConsistency:
                    reviews.extendedClaimsCheck || prev.extendedConsistency,
                }
              : prev
          );
          setCurrentTier('standard');
        } catch (reviewErr) {
          console.error('Phase 2 standard review fetch error:', reviewErr);
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

  const handleRunDeepReview = async () => {
    if (!result || isDeepLoading) return;
    setIsDeepLoading(true);
    try {
      const reviews = await fetchProposalReviews({
        network: result.network,
        governorAddress: result.governorAddress,
        proposalId: result.proposal.id,
        tier: 'deep',
      });
      setResult((prev) =>
        prev
          ? {
              ...prev,
              tier: 'deep',
              reviews,
              extendedConsistency:
                reviews.extendedClaimsCheck || prev.extendedConsistency,
            }
          : prev
      );
      setCurrentTier('deep');
    } catch (reviewErr) {
      console.error('Phase 2 deep review fetch error:', reviewErr);
    } finally {
      setIsDeepLoading(false);
    }
  };

  const handleExportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `callscope-proposal-${result.proposal.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    if (!result) return;
    const md = `# Callscope Governance Audit: ${result.proposal.title || `Proposal ${result.proposal.id}`}

**Network:** ${result.network}
**Governor Address:** \`${result.governorAddress}\`
**Deterministic Assessment:** **${result.assessment.toUpperCase()}**
**Active Tier:** ${result.tier || currentTier}

## Executive Findings (${result.findings.length})
${
  result.findings.length > 0
    ? result.findings.map((f) => `- **[${f.severity.toUpperCase()}] ${f.title}**: ${f.description}`).join('\n')
    : '- No significant issues detected by deterministic engine.'
}

## Decoded Actions (${result.actions.length})
${result.actions
  .map(
    (a, i) => `### Action #${i + 1}: ${a.targetName || a.target} -> ${a.functionName || a.selector}
- Target: \`${a.target}\`
- Value: \`${a.value}\`
- Function: \`${a.functionName || a.selector}\`
- Decoded: ${a.decoded ? 'Yes' : 'No'}`
  )
  .join('\n\n')}

## Sponsor Advisory Intelligence
- **OpenServ SERV:** ${result.reviews?.serv?.summary || 'N/A'}
- **Dolphin Lighthouse:** ${result.reviews?.dolphin?.summary || 'N/A'}
${
  result.reviews?.dolphin?.questions && result.reviews.dolphin.questions.length > 0
    ? `\n### Questions for Proposer:\n${result.reviews.dolphin.questions.map((q) => `- ${q}`).join('\n')}`
    : ''
}

---
*Report generated by Callscope — Deterministic Governance Security Engine*
`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `callscope-report-${result.proposal.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPermalink = () => {
    if (!result) return;
    const url = new URL(window.location.href);
    url.searchParams.set('network', result.network);
    url.searchParams.set('governor', result.governorAddress);
    url.searchParams.set('proposalId', result.proposal.id);
    navigator.clipboard.writeText(url.toString());
    setCopiedPermalink(true);
    setTimeout(() => setCopiedPermalink(false), 2000);
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
              <div
                className="report-actions-bar"
                data-testid="report-actions-bar"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '16px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Tier:</span>
                  <span
                    className={`tier-badge tier-badge-${currentTier}`}
                    data-testid="active-tier-badge"
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      letterSpacing: '0.04em',
                      backgroundColor: currentTier === 'deep'
                        ? 'rgba(168, 85, 247, 0.2)'
                        : currentTier === 'standard'
                        ? 'rgba(56, 189, 248, 0.2)'
                        : 'rgba(255, 255, 255, 0.1)',
                      color: currentTier === 'deep' ? '#c084fc' : currentTier === 'standard' ? '#38bdf8' : '#cbd5e1',
                    }}
                  >
                    {currentTier}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleCopyPermalink}
                    className="report-action-btn"
                    data-testid="copy-permalink-btn"
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: copiedPermalink ? '#4ade80' : '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedPermalink ? '✓ Copied Link' : '🔗 Copy Link'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportMarkdown}
                    className="report-action-btn"
                    data-testid="export-md-btn"
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      cursor: 'pointer',
                    }}
                  >
                    📥 Export Markdown
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="report-action-btn"
                    data-testid="export-json-btn"
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      cursor: 'pointer',
                    }}
                  >
                    📥 Export JSON
                  </button>
                </div>
              </div>

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

              <ConsistencyView
                consistency={result.descriptionConsistency}
                extendedConsistency={result.extendedConsistency}
              />

              <ProviderReviews
                serv={result.reviews?.serv}
                dolphin={result.reviews?.dolphin}
                assessment={result.assessment}
                extendedConsistency={result.extendedConsistency}
                currentTier={currentTier}
                isDeepLoading={isDeepLoading}
                onRunDeepReview={handleRunDeepReview}
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
