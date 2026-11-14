import type { AnalysisResponse, SupportedNetwork } from '../src/types/analysis';

export const SCHEMA_VERSION = 'v2';

export function getCacheMode(): 'kv' | 'memory' {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(kvUrl && kvToken) ? 'kv' : 'memory';
}

export interface CachedEntry {
  data: AnalysisResponse;
  expiresAt: number;
}

// In-memory LRU cache map with max items cap
const inMemoryCache = new Map<string, CachedEntry>();
const MAX_CACHE_SIZE = 200;

export function buildCacheKey(
  network: SupportedNetwork,
  governorAddress: string,
  proposalId: string
): string {
  return `${network.toLowerCase()}:${governorAddress.toLowerCase()}:${proposalId}:${SCHEMA_VERSION}`;
}

/**
 * Retrieve cached analysis result from Vercel KV/Upstash or in-memory LRU
 */
export async function getProposalCache(key: string): Promise<AnalysisResponse | null> {
  const now = Date.now();

  // 1. Try Vercel KV / Upstash REST if configured
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${kvToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.result) {
          const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
          return parsed as AnalysisResponse;
        }
      }
    } catch {
      // Fall through to in-memory
    }
  }

  // 2. Fall back to in-memory LRU
  const entry = inMemoryCache.get(key);
  if (!entry) return null;

  if (now > entry.expiresAt) {
    inMemoryCache.delete(key);
    return null;
  }

  // Refresh LRU order
  inMemoryCache.delete(key);
  inMemoryCache.set(key, entry);
  return entry.data;
}

/**
 * Store analysis result into cache with TTL in seconds
 */
export async function setProposalCache(
  key: string,
  data: AnalysisResponse,
  ttlSeconds: number
): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000;

  // 1. Try Vercel KV / Upstash REST if configured
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/${encodeURIComponent(key)}?ex=${ttlSeconds}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kvToken}` },
        body: JSON.stringify(data),
      });
    } catch {
      // Fall through to in-memory
    }
  }

  // 2. Manage in-memory LRU bounds
  if (inMemoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = inMemoryCache.keys().next().value;
    if (oldestKey) inMemoryCache.delete(oldestKey);
  }

  inMemoryCache.set(key, { data, expiresAt });
}

// In-memory rate limiting map
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

export function checkIpRateLimit(clientIp: string): { isLimited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = ipRateLimitMap.get(clientIp);

  if (!record || now > record.resetAt) {
    ipRateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { isLimited: false, retryAfterSeconds: 0 };
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { isLimited: true, retryAfterSeconds: retryAfter };
  }

  return { isLimited: false, retryAfterSeconds: 0 };
}

export function clearMemoryCache(): void {
  inMemoryCache.clear();
  ipRateLimitMap.clear();
}

