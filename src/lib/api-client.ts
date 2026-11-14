import type { AnalysisRequest, AnalysisResponse, ApiErrorResponse, DescriptionConsistency, ProviderReview, StageTaggedError, SupportedNetwork } from '../types/analysis';

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

export interface ReviewRequest {
  network: SupportedNetwork;
  governorAddress: string;
  proposalId: string;
  tier?: 'standard' | 'deep';
  reverifyLive?: boolean;
}

export interface ReviewResponse {
  serv: ProviderReview;
  dolphin: ProviderReview;
  extendedClaimsCheck?: DescriptionConsistency;
  tier?: 'instant' | 'standard' | 'deep';
  timings?: Record<string, number>;
}

export async function fetchProposalReviews(request: ReviewRequest): Promise<ReviewResponse> {
  const response = await fetch('/api/review', {
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
    const preview = text.trim().slice(0, 160) || response.statusText || 'Server error';
    throw new ApiError(`Review server returned HTTP ${response.status}: ${preview}`);
  }

  if (!response.ok) {
    const errorData = data as any;
    throw new ApiError(errorData?.message || errorData?.error || 'Failed to fetch reviews');
  }

  return data as ReviewResponse;
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

