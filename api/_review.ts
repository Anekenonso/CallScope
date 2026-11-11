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

async function executeWithRetry(
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

  const description = cached.proposal.description;
  const actions = cached.actions;
  const findings = cached.findings;

  // Run each provider with independent timeout and classified retry
  // One provider being slow or failing NEVER blocks or fails the other
  const [servResult, dolphinResult] = await Promise.all([
    executeWithRetry(() => reviewWithServ(description, actions), 'OpenServ SERV'),
    executeWithRetry(() => reviewWithDolphin(description, actions, findings), 'Dolphin'),
  ]);

  // Extended claims check (Phase 2): When SERV is available, extract structured claims
  // and evaluate them through the deterministic claims ledger.
  // This extended check is advisory and never mutates Phase 1 baseline assessment.
  let extendedClaimsCheck: DescriptionConsistency | undefined = undefined;
  if (process.env.SERV_API_KEY && (servResult.status === 'ok' || servResult.status === 'available')) {
    try {
      const servClaims = await extractClaimsWithServ(description);
      if (servClaims && servClaims.length > 0) {
        extendedClaimsCheck = evaluateClaimsLedger(servClaims, actions, description);
      }
    } catch {
      // Extended claims check is non-blocking advisory analysis
    }
  }

  const reviewsResponse = {
    serv: servResult,
    dolphin: dolphinResult,
    ...(extendedClaimsCheck ? { extendedClaimsCheck } : {}),
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
