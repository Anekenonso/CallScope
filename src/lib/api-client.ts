import type { AnalysisRequest, AnalysisResponse, ApiErrorResponse } from '../types/analysis';

export async function analyseProposal(request: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await fetch('/api/analyse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Upstream server or gateway returned non-JSON (e.g. 500/504 gateway response)
    const preview = text.trim().slice(0, 160) || response.statusText || 'Server error';
    throw new Error(`Server returned HTTP ${response.status}: ${preview}`);
  }

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    throw new Error(errorData.details || errorData.error || 'Failed to analyse proposal');
  }

  return data as AnalysisResponse;
}

