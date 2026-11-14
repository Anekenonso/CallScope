import type { VercelRequest, VercelResponse } from '../src/types/vercel';
import type { ProviderReview, SupportedNetwork, DescriptionConsistency } from '../src/types/analysis';
import { getProposalCache, setProposalCache, buildCacheKey, checkIpRateLimit } from '../server/cache';
import { reviewWithServ } from '../server/providers/serv';
import { reviewWithDolphin } from '../server/providers/dolphin';
import { classifyProviderError } from '../server/providers/openai-compatible';
import { executeAnalysis, sanitizePublicErrorMessage } from './_analyse';
import { isSupportedNetwork } from '../server/chain/networks';
import { extractClaimsWithServ, evaluateClaimsLedger } from '../server/analysis/check-consistency';
import { isAddress } from 'viem';
import { getStoredPinnedReview, checkBudgetAvailability } from '../server/budget';

export async function executeWithRetry(
  providerFn: () => Promise<ProviderReview>,
  providerName: string
): Promise<ProviderReview> {
  const maxAttempts = 2;
  let attempts = 0;
  let lastReview: ProviderReview | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const review = await providerFn();
      review.attempts = attempts;
      if (review.status === 'ok' || review.status === 'available') {
        return review;
      }
      lastReview = review;
      if (!review.retryable || attempt === maxAttempts) {
        return review;
      }
      const jitter = Math.floor(Math.random() * 200) + 150;
      await new Promise((r) => setTimeout(r, jitter));
    } catch (err: unknown) {
      const classification = classifyProviderError(err);
      lastReview = {
        provider: providerName,
        status: classification.status,
        errorClass: classification.errorClass,
        reason: classification.reason,
        retryable: classification.retryable,
        error: classification.reason,
        attempts,
      };
      if (!classification.retryable || attempt === maxAttempts) {
        return lastReview;
      }
      const jitter = Math.floor(Math.random() * 200) + 150;
      await new Promise((r) => setTimeout(r, jitter));
    }
  }

  return (
    lastReview || {
      provider: providerName,
      status: 'upstream_error',
      errorClass: 'upstream_error',
      reason: `${providerName} review failed after ${attempts} attempts.`,
      error: `${providerName} review failed after ${attempts} attempts.`,
      attempts,
    }
  );
}

export default async function handler(req: VercelRequest | Request, res?: VercelResponse) {
  // Support both Node HTTP (req, res) and Web Standard (Request)
  const isWebStandard = typeof Request !== 'undefined' && req instanceof Request;

  if (req.method !== 'POST') {
    const errorBody = { error: 'Method Not Allowed', message: 'Use POST for proposal review.' };
    if (isWebStandard) {
      return new Response(JSON.stringify(errorBody), {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'POST' },
      });
    }
    return res!.status(405).setHeader('Allow', 'POST').json(errorBody);
  }

  // Rate limiting check
  const clientIp =
    (isWebStandard
      ? (req as Request).headers.get('x-forwarded-for')
      : (req as VercelRequest).headers['x-forwarded-for']) || '127.0.0.1';
  const ipStr = Array.isArray(clientIp) ? clientIp[0]! : clientIp.split(',')[0]!.trim();

  const rateCheck = checkIpRateLimit(ipStr);
  if (rateCheck.isLimited) {
    const errorBody = {
      error: 'Rate Limit Exceeded',
      message: 'Too many requests. Please wait a minute before analyzing another proposal.',
    };
    if (isWebStandard) {
      return new Response(JSON.stringify(errorBody), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfterSeconds) },
      });
    }
    return res!.status(429).setHeader('Retry-After', String(rateCheck.retryAfterSeconds)).json(errorBody);
  }

  // Parse body
  let body: any;
  if (isWebStandard) {
    try {
      body = await (req as Request).json();
    } catch {
      body = {};
    }
  } else {
    body = (req as VercelRequest).body || {};
  }

  const { network, governorAddress, proposalId } = body;

  if (!network || !isSupportedNetwork(network)) {
    const err = { error: 'Invalid network', message: 'Supported networks are "ethereum" and "base".' };
    return isWebStandard ? new Response(JSON.stringify(err), { status: 400 }) : res!.status(400).json(err);
  }

  if (!governorAddress || !isAddress(governorAddress)) {
    const err = { error: 'Invalid Governor address', message: 'Must be a valid 40-character hexadecimal address.' };
    return isWebStandard ? new Response(JSON.stringify(err), { status: 400 }) : res!.status(400).json(err);
  }

  if (!proposalId || typeof proposalId !== 'string') {
    const err = { error: 'Invalid proposal ID', message: 'Must be a valid decimal string.' };
    return isWebStandard ? new Response(JSON.stringify(err), { status: 400 }) : res!.status(400).json(err);
  }

  const cacheKey = buildCacheKey(network as SupportedNetwork, governorAddress, proposalId.trim());
  let cached = await getProposalCache(cacheKey);

  // Stateless-safe: On cache miss (e.g. distinct serverless instance), recompute the deterministic analysis server-side
  // from verified proposal identifiers. Prompt input NEVER accepts client-supplied actions or descriptions.
  if (!cached) {
    try {
      cached = await executeAnalysis({
        network: network as SupportedNetwork,
        governorAddress,
        proposalId: proposalId.trim(),
        txHashOrUrl: typeof body.txHashOrUrl === 'string' ? body.txHashOrUrl.trim() : undefined,
        reverifyLive: Boolean(body.reverifyLive),
      });
      await setProposalCache(cacheKey, cached, 300);
    } catch (recomputeErr: unknown) {
      const msg = recomputeErr instanceof Error ? recomputeErr.message : 'Recomputation failed';
      const err = {
        error: 'Analysis Error',
        message: `Failed to recompute proposal analysis on cache miss: ${sanitizePublicErrorMessage(msg)}`,
      };
      return isWebStandard ? new Response(JSON.stringify(err), { status: 500 }) : res!.status(500).json(err);
    }
  }

  const requestedTier = (body.tier === 'standard' ? 'standard' : 'deep') as 'standard' | 'deep';

  // 1. Check for stored real outputs on pinned proposals (when not reverifying live)
  // In test environment, only return stored outputs if explicitly requested (e.g. useStoredReviews: true)
  // so that unconfigured-keys tests can verify provider fallback behavior.
  const allowStored = process.env.NODE_ENV !== 'test' || Boolean(body.useStoredReviews);
  if (allowStored && !body.reverifyLive) {
    const stored = getStoredPinnedReview(proposalId);
    if (stored) {
      const respData = {
        serv: { ...stored.serv, tier: requestedTier },
        dolphin:
          requestedTier === 'deep'
            ? { ...stored.dolphin, tier: 'deep' }
            : {
                provider: 'Dolphin',
                status: 'available',
                summary:
                  'Adversarial execution scenarios and governance questions available in Deep review.',
                tier: 'standard',
              },
        tier: requestedTier,
        timings: { totalMs: 5 },
      };
      if (isWebStandard) {
        return new Response(JSON.stringify(respData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return res!.status(200).json(respData);
    }
  }

  // 2. Budget and kill-switch checks
  const servBudget = checkBudgetAvailability('serv');
  const dolphinBudget = checkBudgetAvailability('dolphin');

  const tReviewStart = Date.now();
  let tServExtractionMs = 0;
  let tServInvestigatorMs = 0;
  let tDolphinScenarioMs = 0;
  let tClaimsLedgerMs = 0;

  const description = cached.proposal.description;
  const actions = cached.actions;
  const findings = cached.findings;

  let servResult: ProviderReview;
  let dolphinResult: ProviderReview;
  let extendedClaimsCheck: DescriptionConsistency | undefined = undefined;

  if (requestedTier === 'standard') {
    // Standard Tier (auto after Instant):
    // ONE guarded SERV claim-extraction call, claims checked by deterministic comparators.
    // No multi-turn tool loop. No Dolphin call.
    const tExtractStart = Date.now();
    let servClaims = null;
    if (servBudget.allowed && process.env.SERV_API_KEY) {
      try {
        servClaims = await extractClaimsWithServ(description, { enablePromptGuard: true });
      } catch {
        // Fall back gracefully
      }
    }
    tServExtractionMs = Date.now() - tExtractStart;

    if (servClaims && servClaims.length > 0) {
      const tLedgerStart = Date.now();
      extendedClaimsCheck = evaluateClaimsLedger(servClaims, actions, description);
      tClaimsLedgerMs = Date.now() - tLedgerStart;
    }

    const claimCount = servClaims?.length ?? 0;
    const isOk = servClaims !== null;
    servResult = {
      provider: 'OpenServ SERV',
      status: !servBudget.allowed ? 'not_configured' : isOk ? 'ok' : (process.env.SERV_API_KEY ? 'available' : 'not_configured'),
      summary: !servBudget.allowed
        ? servBudget.reason
        : isOk
          ? `Standard Review: Extracted ${claimCount} claim(s) from proposal description; verified against deterministic on-chain actions.`
          : (process.env.SERV_API_KEY ? 'Standard review completed.' : 'OpenServ SERV API key not configured in environment.'),
      items: extendedClaimsCheck?.claims?.map((c) => ({
        kind: c.status === 'contradicted' ? 'contradiction' : c.status === 'verified' ? 'supported' : 'note',
        issue: `[${c.category.toUpperCase()}] "${c.quote}" — ${c.explanation || c.status}`,
        evidence: c.explanation,
        claimRef: c.id,
      })) || [],
      tier: 'standard',
      durationMs: tServExtractionMs,
      attempts: 1,
    };

    dolphinResult = {
      provider: 'Dolphin',
      status: !dolphinBudget.allowed ? 'not_configured' : (process.env.DOLPHIN_API_KEY ? 'available' : 'not_configured'),
      summary: !dolphinBudget.allowed ? dolphinBudget.reason : 'Adversarial execution scenarios and governance questions available in Deep review.',
      tier: 'standard',
    };
  } else {
    // Deep Tier (on click):
    // SERV investigator tool loop + Dolphin scenarios + questions run concurrently.
    let servClaimsPromise = Promise.resolve<any>(null);
    if (servBudget.allowed && process.env.SERV_API_KEY) {
      servClaimsPromise = extractClaimsWithServ(description, { enablePromptGuard: true }).catch(() => null);
    }

    const servToolPromise = servBudget.allowed
      ? executeWithRetry(() => reviewWithServ(description, actions), 'OpenServ SERV')
      : Promise.resolve<ProviderReview>({
          provider: 'OpenServ SERV',
          status: 'not_configured',
          summary: servBudget.reason,
        });

    const dolphinReviewPromise = dolphinBudget.allowed
      ? executeWithRetry(() => reviewWithDolphin(description, actions, findings), 'Dolphin')
      : Promise.resolve<ProviderReview>({
          provider: 'Dolphin',
          status: 'not_configured',
          summary: dolphinBudget.reason,
        });

    const tParallelStart = Date.now();
    const [servToolRes, dolphinRes, servClaims] = await Promise.all([
      servToolPromise,
      dolphinReviewPromise,
      servClaimsPromise,
    ]);
    const tParallelMs = Date.now() - tParallelStart;
    tServInvestigatorMs = tParallelMs;
    tDolphinScenarioMs = tParallelMs;

    servResult = { ...servToolRes, tier: 'deep' };
    dolphinResult = { ...dolphinRes, tier: 'deep' };

    if (servClaims && servClaims.length > 0) {
      extendedClaimsCheck = evaluateClaimsLedger(servClaims, actions, description);
    }
  }

  const reviewsResponse = {
    tier: requestedTier,
    serv: servResult,
    dolphin: dolphinResult,
    ...(extendedClaimsCheck ? { extendedClaimsCheck } : {}),
    timings: {
      servExtractionMs: tServExtractionMs,
      servInvestigatorMs: tServInvestigatorMs,
      dolphinScenarioMs: tDolphinScenarioMs,
      claimsLedgerMs: tClaimsLedgerMs,
      totalMs: Date.now() - tReviewStart,
    },
  };

  // Update cached proposal with reviews and extended claims check
  cached.reviews = reviewsResponse;
  if (extendedClaimsCheck) {
    cached.extendedConsistency = extendedClaimsCheck;
  }
  const ttl =
    cached.proposal.status === 'Executed' ||
      cached.proposal.status === 'Defeated' ||
      cached.proposal.status === 'Canceled' ||
      cached.proposal.status === 'Expired'
      ? 86400
      : cached.proposal.status === 'Active' || cached.proposal.status === 'Pending'
        ? 60
        : 300;
  await setProposalCache(cacheKey, cached, ttl);

  if (isWebStandard) {
    return new Response(JSON.stringify(reviewsResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return res!.status(200).json(reviewsResponse);
}

export const POST = handler;
