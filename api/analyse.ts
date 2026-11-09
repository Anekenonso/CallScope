import type { VercelRequest, VercelResponse } from '../src/types/vercel';
import type { AnalysisRequest, AnalysisResponse, ApiErrorResponse } from '../src/types/analysis';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enforce POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      error: 'Method Not Allowed',
      details: 'Only POST requests are supported.',
    } satisfies ApiErrorResponse);
  }

  try {
    const { network, governorAddress, proposalId } = (req.body || {}) as Partial<AnalysisRequest>;

    if (!network || (network !== 'ethereum' && network !== 'base')) {
      return res.status(400).json({
        error: 'Invalid network',
        details: 'Network must be either "ethereum" or "base".',
      } satisfies ApiErrorResponse);
    }

    if (!governorAddress || !/^0x[a-fA-F0-9]{40}$/.test(governorAddress)) {
      return res.status(400).json({
        error: 'Invalid Governor address',
        details: 'Governor address must be a valid 20-byte EVM hex address.',
      } satisfies ApiErrorResponse);
    }

    if (!proposalId || !/^\d+$/.test(proposalId.trim())) {
      return res.status(400).json({
        error: 'Invalid proposal ID',
        details: 'Proposal ID must be a valid non-empty decimal string.',
      } satisfies ApiErrorResponse);
    }

    // Stub response for Phase 1 testing
    const response: AnalysisResponse = {
      assessment: 'analysis_incomplete',
      network,
      governorAddress,
      proposal: {
        id: proposalId.trim(),
        description: 'Proposal analysis pipeline under construction.',
        status: 'Pending',
      },
      actions: [],
      findings: [],
      descriptionConsistency: {
        status: 'indeterminate',
        explanation: 'Deterministic engine pipeline scheduled for Phase 2-4.',
      },
      reviews: {
        serv: { status: 'not_configured' },
        dolphin: { status: 'not_configured' },
      },
      limitations: ['Pipeline initialization in progress.'],
      evidence: [],
    };

    return res.status(200).json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return res.status(500).json({
      error: 'Internal server error',
      details: message,
    } satisfies ApiErrorResponse);
  }
}

