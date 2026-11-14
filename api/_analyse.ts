import type { VercelRequest, VercelResponse } from '../src/types/vercel';
import type { AnalysisRequest, AnalysisResponse, ApiErrorResponse, EvidenceItem, ProviderReview } from '../src/types/analysis';
import { createChainClient, verifyNetworkChainId, validateGovernorContract } from '../server/chain/rpc-client';
import { retrieveProposalCreatedEvent, readGovernorProposalState, ProposalNotFoundError } from '../server/chain/proposal-events';
import { decodeProposalActions } from '../server/analysis/decode-actions';
import { detectFindings } from '../server/analysis/detect-findings';
import { checkDescriptionActionConsistency } from '../server/analysis/check-consistency';
import { buildAssessment } from '../server/analysis/build-assessment';
import { reviewWithServ } from '../server/providers/serv';
import { reviewWithDolphin } from '../server/providers/dolphin';
import { SUPPORTED_NETWORKS } from '../server/chain/networks';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// In-memory sliding window rate limiter
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

export function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const record = ipRateLimitMap.get(clientIp);
  if (!record || now > record.resetAt) {
    ipRateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  record.count++;
  return record.count > RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Sanitize public error messages to prevent leakage of paths, stack traces, or credentials
 */
export function sanitizePublicErrorMessage(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return 'An internal analysis error occurred.';
  }

  // Remove file system paths (e.g. C:\... or /usr/...)
  let sanitized = raw.replace(/[a-zA-Z]:\\[^\s:]+/g, '[file path]');
  sanitized = sanitized.replace(/\/[a-zA-Z0-9_.\-]+(?:\/[a-zA-Z0-9_.\-]+)+/g, '[file path]');

  // Remove stack trace markers
  sanitized = sanitized.replace(/at\s+[\w.<>]+\s+\(.*?\)/g, '');

  // Redact potential bearer tokens or secrets
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]');
  sanitized = sanitized.replace(/[a-f0-9]{32,64}/gi, (match) => {
    // Keep 20-byte addresses or 32-byte hashes if they look like EVM addresses
    if (match.length === 40 || match.length === 64) return match;
    return '[REDACTED]';
  });

  if (sanitized.length > 200) {
    sanitized = sanitized.slice(0, 200) + '...';
  }

  return sanitized.trim() || 'An internal analysis error occurred.';
}

export const INTERNAL_DEADLINE_MS = 24_500;

/**
 * Core analysis engine pipeline that executes end-to-end analysis on a proposal
 */
export async function executeAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  const { network, governorAddress, proposalId, creationTxHash } = request;

  if (!network || (network !== 'ethereum' && network !== 'base')) {
    throw new ValidationError('Invalid network: must be either "ethereum" or "base".');
  }

  if (!governorAddress || !/^0x[a-fA-F0-9]{40}$/.test(governorAddress)) {
    throw new ValidationError('Invalid Governor address: must be a valid 20-byte EVM hex address.');
  }

  if (!proposalId || !/^\d+$/.test(proposalId.trim())) {
    throw new ValidationError('Invalid proposal ID: must be a valid non-empty decimal string.');
  }

  const trimmedProposalId = proposalId.trim();
  let currentStage = 'initialization';

  const pipelinePromise = (async (): Promise<AnalysisResponse> => {
    // 1. Create client and verify network
    currentStage = 'network_verification';
    const client = createChainClient(network);
    await verifyNetworkChainId(network, client);

    // 2. Validate Governor contract
    currentStage = 'governor_validation';
    const validGovernor = await validateGovernorContract(client, governorAddress, network);

    // 3. Retrieve ProposalCreated event (with direct tx or fail-fast check)
    currentStage = 'event_retrieval';
    let event;
    try {
      event = await retrieveProposalCreatedEvent(
        client,
        network,
        validGovernor,
        trimmedProposalId,
        creationTxHash
      );
    } catch (err: unknown) {
      if (err instanceof ProposalNotFoundError) {
        throw new ValidationError(`Proposal not found for this governor: ${err.message}`);
      }
      // If event could not be established on-chain, return structured Analysis Incomplete per Rule 3
      const state = await readGovernorProposalState(client, validGovernor, trimmedProposalId);
      return {
        assessment: 'analysis_incomplete',
        network,
        governorAddress: validGovernor,
        proposal: {
          id: trimmedProposalId,
          description: `Analysis incomplete: ProposalCreated event could not be recovered by on-chain log scan.`,
          status: state,
        },
        actions: [],
        findings: [
          {
            id: 'PROPOSAL_EVENT_NOT_RECOVERED',
            severity: 'high',
            title: `Analysis incomplete: ProposalCreated log not recovered`,
            description: `On-chain event logs for proposal ID ${trimmedProposalId} on Governor ${validGovernor} could not be established within the scan budget. Hint: Provide the proposal creation transaction hash or explorer URL to analyze this proposal directly.`,
            verified: true,
            whyItMatters:
              'Without the ProposalCreated event log, executable action targets, values, signatures, and calldata cannot be proven from chain state.',
          },
        ],
        descriptionConsistency: {
          status: 'indeterminate',
          explanation: 'Event retrieval incomplete; calldata not recovered.',
        },
        reviews: {
          serv: { status: 'unavailable', error: 'Analysis incomplete: event not recovered' },
          dolphin: { status: 'unavailable', error: 'Analysis incomplete: event not recovered' },
        },
        limitations: [
          'On-chain log retrieval reached scan limits without locating the ProposalCreated event.',
          'Provide the proposal creation transaction hash or explorer URL to decode actions directly without scanning.',
        ],
        evidence: [
          {
            label: 'Governor Contract',
            url: `${SUPPORTED_NETWORKS[network].explorerUrl}/address/${validGovernor}`,
            description: `Verified on-chain governor at ${validGovernor}`,
          },
        ],
      };
    }

    // 4. Read current proposal state
    currentStage = 'state_read';
    const state = await readGovernorProposalState(client, validGovernor, trimmedProposalId);

    // 5. Decode proposal actions
    currentStage = 'action_decoding';
    const { actions, limitations } = await decodeProposalActions({
      network,
      targets: event.targets,
      values: event.values,
      signatures: event.signatures,
      calldatas: event.calldatas,
      client,
    });

    // 6. Run deterministic security checks
    currentStage = 'deterministic_checks';
    const findings = detectFindings(actions);

    // 7. Check consistency between proposal description and executable actions
    currentStage = 'consistency_check';
    const descriptionConsistency = checkDescriptionActionConsistency(event.description, actions);

    // 8. Build final deterministic assessment
    currentStage = 'assessment_synthesis';
    const assessment = buildAssessment({
      actions,
      findings,
      consistency: descriptionConsistency,
      limitations,
    });

    // 9. Run sponsor advisory reviews with a bounded total execution time (max 20s)
    currentStage = 'sponsor_reviews';
    const sponsorTimeoutPromise = new Promise<{ serv: ProviderReview; dolphin: ProviderReview }>(
      (resolve) => {
        setTimeout(() => {
          resolve({
            serv: { status: 'error', error: 'SERV review timed out' },
            dolphin: { status: 'error', error: 'Dolphin review timed out' },
          });
        }, 20_000);
      }
    );

    const sponsorReviewsPromise = Promise.allSettled([
      reviewWithServ(event.description, actions),
      reviewWithDolphin(event.description, actions, findings),
    ]).then(([servRes, dolphinRes]) => ({
      serv:
        servRes.status === 'fulfilled'
          ? servRes.value
          : { status: 'error' as const, error: servRes.reason?.message || 'SERV review failed' },
      dolphin:
        dolphinRes.status === 'fulfilled'
          ? dolphinRes.value
          : { status: 'error' as const, error: dolphinRes.reason?.message || 'Dolphin review failed' },
    }));

    const reviews = await Promise.race([sponsorReviewsPromise, sponsorTimeoutPromise]);

    // Evidence links
    const networkConfig = SUPPORTED_NETWORKS[network];
    const evidence: EvidenceItem[] = [
      {
        label: 'Governor Contract',
        url: `${networkConfig.explorerUrl}/address/${validGovernor}`,
        description: `Verified on-chain governor at ${validGovernor}`,
      },
      {
        label: 'Proposal Creation Transaction',
        url: `${networkConfig.explorerUrl}/tx/${event.transactionHash}`,
        description: `Emitted ProposalCreated event in block ${event.blockNumber.toString()}`,
      },
    ];

    for (let i = 0; i < actions.length; i++) {
      const act = actions[i]!;
      evidence.push({
        label: `Action #${i + 1} Target: ${act.targetName || act.target.slice(0, 10) + '...'}`,
        url: `${networkConfig.explorerUrl}/address/${act.target}`,
        description:
          act.isProxy && act.implementation
            ? `Proxy contract pointing to implementation ${act.implementation}`
            : `Direct target contract`,
      });
    }

    return {
      assessment,
      network,
      governorAddress: validGovernor,
      proposal: {
        id: trimmedProposalId,
        description: event.description,
        status: state,
        proposer: event.proposer,
        creationTransaction: event.transactionHash,
        blockNumber: event.blockNumber.toString(),
      },
      actions,
      findings,
      descriptionConsistency,
      reviews,
      limitations,
      evidence,
    };
  })();

  // Wrap in internal hard deadline (~24.5s) to guarantee no raw 504 platform errors
  let timerId: NodeJS.Timeout;
  const deadlinePromise = new Promise<AnalysisResponse>((resolve) => {
    timerId = setTimeout(() => {
      resolve({
        assessment: 'analysis_incomplete',
        network,
        governorAddress,
        proposal: {
          id: trimmedProposalId,
          description: `Analysis timed out during ${currentStage}. The chain log scan exceeded the 25-second execution budget.`,
          status: 'Incomplete',
        },
        actions: [],
        findings: [
          {
            id: 'SCAN_DEADLINE_EXCEEDED',
            severity: 'high',
            title: `Analysis incomplete: stage stalled at ${currentStage}`,
            description: `ProposalCreated event could not be retrieved within the 25-second deadline. Hint: Provide the creation transaction hash or explorer URL to analyze this proposal directly without scanning.`,
            verified: true,
            whyItMatters:
              'Without the ProposalCreated event, executable calldata and parameters cannot be established on-chain.',
          },
        ],
        descriptionConsistency: {
          status: 'indeterminate',
          explanation: 'Event retrieval incomplete; calldata not recovered.',
        },
        reviews: {
          serv: { status: 'unavailable', error: 'Analysis incomplete' },
          dolphin: { status: 'unavailable', error: 'Analysis incomplete' },
        },
        limitations: [
          `Analysis exceeded the 25-second execution deadline during ${currentStage}.`,
          'You can provide the proposal creation transaction hash directly to bypass log scanning.',
        ],
        evidence: [],
      });
    }, INTERNAL_DEADLINE_MS);
  });

  try {
    return await Promise.race([pipelinePromise, deadlinePromise]);
  } finally {
    clearTimeout(timerId!);
  }
}

async function handleWebRequest(request: Request): Promise<Response> {
  // Enforce POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: 'Method Not Allowed',
        details: 'Only POST requests are supported.',
      } satisfies ApiErrorResponse),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          Allow: 'POST',
        },
      }
    );
  }

  // Rate limiting check
  const forwarded = request.headers.get('x-forwarded-for');
  const clientIp = forwarded?.split(',')[0]?.trim() || '127.0.0.1';

  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        details: 'Rate limit exceeded. Please wait before submitting additional proposals.',
      } satisfies ApiErrorResponse),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Read payload text
  let bodyText = '';
  try {
    bodyText = await request.text();
  } catch {
    bodyText = '';
  }

  // Enforce payload size limit (max 64KB)
  if (bodyText.length > 65_536) {
    return new Response(
      JSON.stringify({
        error: 'Payload Too Large',
        details: 'Request body exceeds maximum allowed size (64KB).',
      } satisfies ApiErrorResponse),
      {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let body: AnalysisRequest;
  try {
    body = JSON.parse(bodyText || '{}') as AnalysisRequest;
  } catch {
    return new Response(
      JSON.stringify({
        error: 'Invalid JSON',
        details: 'Request body is not valid JSON.',
      } satisfies ApiErrorResponse),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const response = await executeAnalysis(body);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      const errorTitle = err.message.split(':')[0] || 'Bad Request';
      return new Response(
        JSON.stringify({
          error: errorTitle,
          details: err.message,
        } satisfies ApiErrorResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    const rawMessage = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(
      JSON.stringify({
        error: 'Analysis Error',
        details: sanitizePublicErrorMessage(rawMessage),
      } satisfies ApiErrorResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleNodeReqRes(req: VercelRequest, res: VercelResponse) {
  // Enforce POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      error: 'Method Not Allowed',
      details: 'Only POST requests are supported.',
    } satisfies ApiErrorResponse);
  }

  try {
    const body = (req.body || {}) as Partial<AnalysisRequest>;
    const response = await executeAnalysis(body as AnalysisRequest);
    return res.status(200).json(response);
  } catch (err: unknown) {
    if (err instanceof ValidationError) {
      const errorTitle = err.message.split(':')[0] || 'Bad Request';
      return res.status(400).json({
        error: errorTitle,
        details: err.message,
      } satisfies ApiErrorResponse);
    }
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return res.status(500).json({
      error: 'Analysis Error',
      details: message,
    } satisfies ApiErrorResponse);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleWebRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleWebRequest(request);
}

export default async function handler(
  req: VercelRequest | Request,
  res?: VercelResponse
) {
  if (
    !res ||
    typeof (res as any).status !== 'function' ||
    (typeof Request !== 'undefined' && req instanceof Request) ||
    typeof (req as any).json === 'function'
  ) {
    return handleWebRequest(req as Request);
  }
  return handleNodeReqRes(req as VercelRequest, res as VercelResponse);
}
