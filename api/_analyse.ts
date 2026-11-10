import type { VercelRequest, VercelResponse } from '../src/types/vercel';
import type { AnalysisRequest, AnalysisResponse, ApiErrorResponse, EvidenceItem, ProviderReview } from '../src/types/analysis';
import { createChainClient, verifyNetworkChainId, validateGovernorContract } from '../server/chain/rpc-client';
import { retrieveProposalCreatedEvent, readGovernorProposalState } from '../server/chain/proposal-events';
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

function isRateLimited(clientIp: string): boolean {
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

/**
 * Core analysis engine pipeline that executes end-to-end analysis on a proposal
 */
export async function executeAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  const { network, governorAddress, proposalId } = request;

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

  // 1. Create client and verify network
  const client = createChainClient(network);
  await verifyNetworkChainId(network, client);

  // 2. Validate Governor contract
  const validGovernor = await validateGovernorContract(client, governorAddress, network);

  // 3. Retrieve ProposalCreated event
  const event = await retrieveProposalCreatedEvent(client, network, validGovernor, trimmedProposalId);

  // 4. Read current proposal state
  const state = await readGovernorProposalState(client, validGovernor, trimmedProposalId);

  // 5. Decode proposal actions
  const { actions, limitations } = await decodeProposalActions({
    network,
    targets: event.targets,
    values: event.values,
    signatures: event.signatures,
    calldatas: event.calldatas,
    client,
  });

  // 6. Run deterministic security checks
  const findings = detectFindings(actions);

  // 7. Check consistency between proposal description and executable actions
  const descriptionConsistency = checkDescriptionActionConsistency(event.description, actions);

  // 8. Build final deterministic assessment
  const assessment = buildAssessment({
    actions,
    findings,
    consistency: descriptionConsistency,
    limitations,
  });

  // 9. Run sponsor advisory reviews with a bounded total execution time (max 12s)
  // Sponsor failures are completely isolated and never invalidate deterministic analysis
  const sponsorTimeoutPromise = new Promise<{ serv: ProviderReview; dolphin: ProviderReview }>(
    (resolve) => {
      setTimeout(() => {
        resolve({
          serv: { status: 'error', error: 'SERV review timed out' },
          dolphin: { status: 'error', error: 'Dolphin review timed out' },
        });
      }, 12_000);
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
      description: act.isProxy && act.implementation
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
}

async function handleWebRequest(request: Request): Promise<Response> {
  // Enforce POST
  if (request.method !== 'POST') {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'GET' && url.searchParams.get('diag') === 'true') {
      const diagStart = Date.now();
      const baseConfig = SUPPORTED_NETWORKS.base;
      const ethConfig = SUPPORTED_NETWORKS.ethereum;
      const baseRpcEnv = Boolean(process.env[baseConfig.envRpcKey]);
      const ethRpcEnv = Boolean(process.env[ethConfig.envRpcKey]);
      const servKeyEnv = Boolean(process.env.SERV_API_KEY);
      const dolphinKeyEnv = Boolean(process.env.DOLPHIN_API_KEY);

      const ethClient = createChainClient('ethereum');
      const baseClient = createChainClient('base');
      let ethLatency = -1;
      let baseLatency = -1;
      let baseError: string | null = null;

      try {
        const t0 = Date.now();
        await ethClient.getBlockNumber();
        ethLatency = Date.now() - t0;
      } catch {
        ethLatency = -1;
      }

      try {
        const t1 = Date.now();
        await baseClient.getBlockNumber();
        baseLatency = Date.now() - t1;
      } catch (e: any) {
        baseError = sanitizePublicErrorMessage(e?.message || 'base error');
      }

      return new Response(
        JSON.stringify({
          env: {
            baseRpcConfigured: baseRpcEnv,
            ethRpcConfigured: ethRpcEnv,
            servConfigured: servKeyEnv,
            dolphinConfigured: dolphinKeyEnv,
          },
          rpc: {
            ethLatencyMs: ethLatency,
            baseLatencyMs: baseLatency,
            baseError,
          },
          totalMs: Date.now() - diagStart,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

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

  // Enforce payload size limit (max 64KB)
  const bodyString = JSON.stringify(req.body || '');
  if (bodyString.length > 65_536) {
    return res.status(413).json({
      error: 'Payload Too Large',
      details: 'Request body exceeds maximum allowed size (64KB).',
    } satisfies ApiErrorResponse);
  }

  // Lightweight IP rate limiting
  const forwarded = req.headers?.['x-forwarded-for'];
  const clientIp =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ||
    (req as any).socket?.remoteAddress ||
    '127.0.0.1';

  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      details: 'Rate limit exceeded. Please wait before submitting additional proposals.',
    } satisfies ApiErrorResponse);
  }

  try {
    const body = (req.body || {}) as any;
    if (body && body.diag) {
      const diagStart = Date.now();
      const baseConfig = SUPPORTED_NETWORKS.base;
      const ethConfig = SUPPORTED_NETWORKS.ethereum;
      const baseRpcEnv = Boolean(process.env[baseConfig.envRpcKey]);
      const ethRpcEnv = Boolean(process.env[ethConfig.envRpcKey]);
      const servKeyEnv = Boolean(process.env.SERV_API_KEY);
      const dolphinKeyEnv = Boolean(process.env.DOLPHIN_API_KEY);

      const ethClient = createChainClient('ethereum');
      const baseClient = createChainClient('base');
      let ethLatency = -1;
      let baseLatency = -1;
      let baseError: string | null = null;

      try {
        const t0 = Date.now();
        await ethClient.getBlockNumber();
        ethLatency = Date.now() - t0;
      } catch {
        ethLatency = -1;
      }

      try {
        const t1 = Date.now();
        await baseClient.getBlockNumber();
        baseLatency = Date.now() - t1;
      } catch (e: any) {
        baseError = sanitizePublicErrorMessage(e?.message || 'base error');
      }

      return res.status(200).json({
        env: {
          baseRpcConfigured: baseRpcEnv,
          ethRpcConfigured: ethRpcEnv,
          servConfigured: servKeyEnv,
          dolphinConfigured: dolphinKeyEnv,
        },
        rpc: {
          ethLatencyMs: ethLatency,
          baseLatencyMs: baseLatency,
          baseError,
        },
        totalMs: Date.now() - diagStart,
      });
    }

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
    const rawMessage = err instanceof Error ? err.message : 'Internal Server Error';
    return res.status(500).json({
      error: 'Analysis Error',
      details: sanitizePublicErrorMessage(rawMessage),
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
