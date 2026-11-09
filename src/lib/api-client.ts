import type { AnalysisRequest, AnalysisResponse, ApiErrorResponse } from '../types/analysis';

export async function analyseProposal(request: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await fetch('/api/analyse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    throw new Error(errorData.details || errorData.error || 'Failed to analyse proposal');
  }

  return data as AnalysisResponse;
}

