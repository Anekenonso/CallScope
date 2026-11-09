import { useState } from 'react';
import type { AnalysisRequest, AnalysisResponse } from '../types/analysis';
import { AnalysisForm } from '../components/AnalysisForm';
import { analyseProposal } from '../lib/api-client';

export function App() {
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

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-brand">Callscope</h1>
        <span className="app-attribution">OpenServ SERV &amp; Dolphin</span>
      </header>

      <main>
        <AnalysisForm onAnalyse={handleAnalyse} isLoading={isLoading} />

        {error && (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-error-bg)',
              color: 'var(--color-error-text)',
              border: '1px solid var(--color-error-border)',
              borderRadius: '4px',
              marginBottom: '24px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {result && (
          <div
            style={{
              padding: '20px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          >
            <p><strong>Status:</strong> {result.assessment}</p>
            <p><strong>Proposal ID:</strong> {result.proposal.id}</p>
          </div>
        )}
      </main>
    </div>
  );
}

