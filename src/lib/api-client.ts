import type { AnalysisRequest, AnalysisResponse, ApiErrorResponse, StageTaggedError } from '../types/analysis';

export class ApiError extends Error {
  stageTagged?: StageTaggedError;
  code?: string;

  constructor(message: string, stageTagged?: StageTaggedError, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.stageTagged = stageTagged;
    this.code = code;
  }
}

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
    throw new ApiError(`Server returned HTTP ${response.status}: ${preview}`);
  }

  if (!response.ok) {
    const errorData = data as ApiErrorResponse;
    const msg = errorData.details || errorData.error || 'Failed to analyse proposal';
    throw new ApiError(msg, errorData.stageTagged, errorData.code);
  }

  return data as AnalysisResponse;
}

