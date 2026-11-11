import type { VercelRequest, VercelResponse } from '../src/types/vercel';
import type { ProviderReview, SupportedNetwork } from '../src/types/analysis';
import { getProposalCache, setProposalCache, buildCacheKey, checkIpRateLimit } from '../server/cache';
import { reviewWithServ } from '../server/providers/serv';
import { reviewWithDolphin } from '../server/providers/dolphin';
import { isSupportedNetwork } from '../server/chain/networks';
import { isAddress } from 'viem';

async function runWithOneRetry<T>(
  fn: () => Promise<T>,
  fallbackValue: T
): Promise<T> {
  try {
    return await fn();
  } catch {
    // Retry once
    try {
      return await fn();
    } catch {
      return fallbackValue;
    }
  }
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
  const cached = await getProposalCache(cacheKey);

  // Security guard: If deterministic analysis is not yet cached, prompt must not accept raw client actions
  if (!cached) {
    const err = {
      error: 'Proposal Not Analyzed',
      message: 'Deterministic analysis must be computed before requesting sponsor reviews.',
    };
    return isWebStandard ? new Response(JSON.stringify(err), { status: 404 }) : res!.status(404).json(err);
  }

  const description = cached.proposal.description;
  const actions = cached.actions;
  const findings = cached.findings;

  // Run each provider with independent timeout and 1 retry
  // One provider being slow or failing NEVER blocks or fails the other
  const [servResult, dolphinResult] = await Promise.all([
    runWithOneRetry(
      () => reviewWithServ(description, actions),
      { status: 'error', error: 'SERV review timed out or failed after retry.' } as ProviderReview
    ),
    runWithOneRetry(
      () => reviewWithDolphin(description, actions, findings),
      { status: 'error', error: 'Dolphin review timed out or failed after retry.' } as ProviderReview
    ),
  ]);

  const reviewsResponse = {
    serv: servResult,
    dolphin: dolphinResult,
  };

  // Update cached proposal with reviews
  cached.reviews = reviewsResponse;
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
