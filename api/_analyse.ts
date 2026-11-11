import type { VercelRequest, VercelResponse } from '../src/types/vercel';
import type { AnalysisRequest, AnalysisResponse, ApiErrorResponse, EvidenceItem, ProviderReview, StageTaggedError, SupportedNetwork } from '../src/types/analysis';
import { getAddress, type Address } from 'viem';
import { createChainClient, verifyNetworkChainId, validateGovernorContract } from '../server/chain/rpc-client';
import { retrieveProposalCreatedEvent, retrieveProposalEventFromTxHash, readGovernorProposalState, ProposalEventLookupError, type DecodedProposalEvent } from '../server/chain/proposal-events';
import { getPinnedSnapshot } from '../server/chain/pinned-snapshots';
import { decodeProposalActions } from '../server/analysis/decode-actions';
import { detectFindings } from '../server/analysis/detect-findings';
import { checkDescriptionActionConsistency } from '../server/analysis/check-consistency';
import { buildAssessment } from '../server/analysis/build-assessment';
import { reviewWithServ } from '../server/providers/serv';
import { reviewWithDolphin } from '../server/providers/dolphin';
import {
  resolveRoleCapabilitiesFromSource,
  profileRecipient,
} from '../server/analysis/role-capabilities';
import {
  getProposalCache,
  setProposalCache,
  buildCacheKey,
  checkIpRateLimit,
} from '../server/cache';
import { SUPPORTED_NETWORKS } from '../server/chain/networks';
import { parseTxHashOrUrl } from '../src/lib/validation';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Sliding window rate limiter imported from cache.ts

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
  let effectiveNetwork: SupportedNetwork = request.network;
  let validGovernor: Address;
  let trimmedProposalId: string;
  let event: DecodedProposalEvent;
  let eventSource: string;
  let client: any;

  if (request.txHashOrUrl && request.txHashOrUrl.trim().length > 0) {
    const parsed = parseTxHashOrUrl(request.txHashOrUrl);
    if (!parsed) {
      throw new ValidationError('Invalid transaction hash or explorer URL.');
    }
    if (parsed.inferredNetwork) {
      effectiveNetwork = parsed.inferredNetwork;
    }
    if (!effectiveNetwork || (effectiveNetwork !== 'ethereum' && effectiveNetwork !== 'base')) {
      throw new ValidationError('Invalid network: must be either "ethereum" or "base".');
    }

    client = createChainClient(effectiveNetwork);
    await verifyNetworkChainId(effectiveNetwork, client);

    const txResult = await retrieveProposalEventFromTxHash(client, parsed.txHash);
    event = txResult.event;
    validGovernor = txResult.governorAddress;
    trimmedProposalId = txResult.proposalId;
    eventSource = `live tx receipt (block ${event.blockNumber})`;
  } else {
    const { network, governorAddress, proposalId } = request;

    if (!network || (network !== 'ethereum' && network !== 'base')) {
      throw new ValidationError('Invalid network: must be either "ethereum" or "base".');
    }
    effectiveNetwork = network;

    if (!governorAddress || !/^0x[a-fA-F0-9]{40}$/.test(governorAddress)) {
      throw new ValidationError('Invalid Governor address: must be a valid 20-byte EVM hex address.');
    }

    if (!proposalId || !/^\d+$/.test(proposalId.trim())) {
      throw new ValidationError('Invalid proposal ID: must be a valid non-empty decimal string.');
    }

    trimmedProposalId = proposalId.trim();

    // Check cache before RPC call unless reverifyLive is requested
    const cacheKey = buildCacheKey(effectiveNetwork, governorAddress, trimmedProposalId);
    if (!request.reverifyLive) {
      const cached = await getProposalCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const pinnedSnapshot = !request.reverifyLive
      ? getPinnedSnapshot(effectiveNetwork, governorAddress as Address, trimmedProposalId)
      : null;

    if (pinnedSnapshot) {
      event = pinnedSnapshot;
      eventSource = `pinned snapshot (block ${pinnedSnapshot.blockNumber})`;
      validGovernor = getAddress(governorAddress.trim());
      client = createChainClient(effectiveNetwork);
    } else {
      // 1. Create client and verify network
      client = createChainClient(effectiveNetwork);
      await verifyNetworkChainId(effectiveNetwork, client);

      // 2. Validate Governor contract
      validGovernor = await validateGovernorContract(client, governorAddress, effectiveNetwork);

      // 3. Retrieve ProposalCreated event
      const retrieval = await retrieveProposalCreatedEvent(
        client,
        effectiveNetwork,
        validGovernor,
        trimmedProposalId,
        { reverifyLive: request.reverifyLive }
      );
      event = retrieval;
      eventSource = retrieval.eventSource;
    }
  }

  // 4. Read current proposal state (gracefully fallback if offline / RPC unavailable)
  let state = 'Executed';
  try {
    const statePromise = readGovernorProposalState(client, validGovernor, trimmedProposalId);
    state = await Promise.race([
      statePromise,
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
  } catch {
    state = 'Executed';
  }

  // 5. Decode proposal actions
  const { actions, limitations } = await decodeProposalActions({
    network: effectiveNetwork,
    targets: event.targets,
    values: event.values,
    signatures: event.signatures,
    calldatas: event.calldatas,
    client,
  });

  // 5.5 Resolve role capabilities and recipient profiles for role actions
  for (const action of actions) {
    if (action.decoded && (action.functionName === 'grantRole' || action.functionName === 'revokeRole')) {
      const roleArg =
        action.args?.find((a) => a.name.toLowerCase().includes('role') || a.type === 'bytes32')?.value ||
        action.args?.[0]?.value ||
        '';
      const accountArg =
        action.args?.find((a) => a.name.toLowerCase().includes('account') || a.type === 'address')?.value ||
        action.args?.[1]?.value ||
        '';

      const targetAddr = (action.implementation || action.target) as Address;
      const roleCap = await resolveRoleCapabilitiesFromSource(
        effectiveNetwork,
        targetAddr,
        action.targetName || 'target contract',
        roleArg
      );
      action.roleCapability = roleCap;

      if (roleCap.status === 'unresolved') {
        const lim = `Action #${action.index + 1} to ${action.target}: Role capability unresolved; verified contract source code unavailable or unparseable.`;
        action.limitations = [...(action.limitations || []), lim];
        limitations.push(lim);
      }

      if (accountArg) {
        const proposalTs = event.voteStart ? Number(event.voteStart) : undefined;
        try {
          const profilePromise = profileRecipient(
            client,
            effectiveNetwork,
            accountArg,
            proposalTs
          );
          action.recipientProfile = await Promise.race([
            profilePromise,
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500)),
          ]);
        } catch {
          action.recipientProfile = {
            type: 'contract',
            isVerified: false,
            summary: `Recipient: ${accountArg.slice(0, 10)}... (profile timeout)`,
          };
        }
      }
    }
  }

  // 6. Run deterministic security checks
  const findings = detectFindings(actions);

  // 7. Check consistency between proposal description and executable actions
  // Phase 1 is strictly deterministic and rule-based; it never awaits or depends on sponsor LLMs.
  const descriptionConsistency = checkDescriptionActionConsistency(event.description, actions);

  // 8. Build final deterministic assessment
  const assessment = buildAssessment({
    actions,
    findings,
    consistency: descriptionConsistency,
    limitations,
  });

  // 9. Two-phase review architecture:
  // Deterministic result returns first and renders immediately.
  // Sponsor reviews load afterwards via a separate call (/api/review).
  // When SYNC_REVIEWS === 'true' (e.g. in offline unit tests), run reviews synchronously.
  let reviews: { serv: ProviderReview; dolphin: ProviderReview };
  if (process.env.SYNC_REVIEWS === 'true') {
    const sponsorTimeoutPromise = new Promise<{ serv: ProviderReview; dolphin: ProviderReview }>(
      (resolve) => {
        setTimeout(() => {
          resolve({
            serv: { status: 'error', error: 'SERV review timed out' },
            dolphin: { status: 'error', error: 'Dolphin review timed out' },
          });
        }, 18_000);
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

    reviews = await Promise.race([sponsorReviewsPromise, sponsorTimeoutPromise]);
  } else {
    reviews = {
      serv: { status: 'pending', summary: 'Loading OpenServ SERV advisory review...' },
      dolphin: { status: 'pending', summary: 'Loading Dolphin secondary review...' },
    };
  }

  // Evidence links
  const networkConfig = SUPPORTED_NETWORKS[effectiveNetwork];
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

  const responseData: AnalysisResponse = {
    assessment,
    network: effectiveNetwork,
    governorAddress: validGovernor,
    proposal: {
      id: trimmedProposalId,
      description: event.description,
      status: state,
      proposer: event.proposer,
      creationTransaction: event.transactionHash,
      blockNumber: event.blockNumber.toString(),
      eventSource,
    },
    actions,
    findings,
    descriptionConsistency,
    reviews,
    limitations,
    evidence,
  };

  // Cache response with TTL based on proposal status
  const finalCacheKey = buildCacheKey(effectiveNetwork, validGovernor, trimmedProposalId);
  const ttl = (state === 'Executed' || state === 'Defeated' || state === 'Canceled' || state === 'Expired')
    ? 86400
    : (state === 'Active' || state === 'Pending')
      ? 60
      : 300;
  await setProposalCache(finalCacheKey, responseData, ttl);

  return responseData;
}

export function extractStageTaggedError(err: unknown): StageTaggedError {
  if (err instanceof ProposalEventLookupError) {
    return {
      stage: err.stage,
      via: err.via,
      reason: err.reason,
      detail: err.detail,
    };
  }
  if (err instanceof ValidationError) {
    return {
      stage: 'input_validation',
      reason: 'validation_error',
      detail: err.message,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('network') || msg.includes('chain')) {
    return {
      stage: 'network_verification',
      via: 'rpc',
      reason: 'network_error',
      detail: sanitizePublicErrorMessage(msg),
    };
  }
  if (msg.includes('Governor') || msg.includes('contract')) {
    return {
      stage: 'governor_validation',
      via: 'rpc',
      reason: 'not_found',
      detail: sanitizePublicErrorMessage(msg),
    };
  }
  return {
    stage: 'event_lookup',
    reason: 'not_found',
    detail: sanitizePublicErrorMessage(msg),
  };
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

  const rateCheck = checkIpRateLimit(clientIp);
  if (rateCheck.isLimited) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        details: 'Rate limit exceeded. Please wait before submitting additional proposals.',
      } satisfies ApiErrorResponse),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfterSeconds),
        },
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
    const stageTagged = extractStageTaggedError(err);
    if (err instanceof ValidationError) {
      const errorTitle = err.message.split(':')[0] || 'Bad Request';
      return new Response(
        JSON.stringify({
          error: errorTitle,
          details: err.message,
          stageTagged,
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
        stageTagged,
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

  const rateCheck = checkIpRateLimit(clientIp);
  if (rateCheck.isLimited) {
    res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
    return res.status(429).json({
      error: 'Too Many Requests',
      details: 'Rate limit exceeded. Please wait before submitting additional proposals.',
    } satisfies ApiErrorResponse);
  }

  try {
    const body = (req.body || {}) as Partial<AnalysisRequest>;
    const response = await executeAnalysis(body as AnalysisRequest);
    return res.status(200).json(response);
  } catch (err: unknown) {
    const stageTagged = extractStageTaggedError(err);
    if (err instanceof ValidationError) {
      const errorTitle = err.message.split(':')[0] || 'Bad Request';
      return res.status(400).json({
        error: errorTitle,
        details: err.message,
        stageTagged,
      } satisfies ApiErrorResponse);
    }
    const rawMessage = err instanceof Error ? err.message : 'Internal Server Error';
    return res.status(500).json({
      error: 'Analysis Error',
      details: sanitizePublicErrorMessage(rawMessage),
      stageTagged,
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
