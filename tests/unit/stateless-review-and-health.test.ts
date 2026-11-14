import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getHealthData } from '../../api/_health';
import reviewHandler from '../../api/_review';
import { classifyProviderError } from '../../server/providers/openai-compatible';
import { getProposalCache, buildCacheKey, SCHEMA_VERSION } from '../../server/cache';

describe('Task 1: Stateless-Safe Review Endpoint & Health Check', () => {
  const originalFetch = global.fetch;
  const savedEnv = {
    SERV_API_KEY: process.env.SERV_API_KEY,
    DOLPHIN_API_KEY: process.env.DOLPHIN_API_KEY,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  };

  const cleanEnv = () => {
    delete process.env.SERV_API_KEY;
    delete process.env.DOLPHIN_API_KEY;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  };

  beforeEach(() => {
    cleanEnv();
    global.fetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ status: '0', message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    cleanEnv();
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v !== undefined) {
        process.env[k] = v;
      }
    }
  });

  describe('GET /api/health', () => {
    it('returns memory cacheMode and unconfigured sponsors when keys are absent', () => {
      delete process.env.KV_REST_API_URL;
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.SERV_API_KEY;
      delete process.env.DOLPHIN_API_KEY;

      const health = getHealthData();
      expect(health.status).toBe('ok');
      expect(health.cacheMode).toBe('memory');
      expect(health.servConfigured).toBe(false);
      expect(health.dolphinConfigured).toBe(false);
      expect(health.schemaVersion).toBe(SCHEMA_VERSION);
      expect(typeof health.buildSha).toBe('string');
    });

    it('returns kv cacheMode and configured flags when env vars are present', () => {
      process.env.KV_REST_API_URL = 'https://fake-kv.vercel-storage.com';
      process.env.KV_REST_API_TOKEN = 'fake-token';
      process.env.SERV_API_KEY = 'serv-secret-key';
      process.env.DOLPHIN_API_KEY = 'dolphin-secret-key';

      const health = getHealthData();
      expect(health.cacheMode).toBe('kv');
      expect(health.servConfigured).toBe(true);
      expect(health.dolphinConfigured).toBe(true);
    });
  });

  describe('POST /api/review Stateless Recomputation on Cache Miss', () => {
    it('recomputes deterministic analysis on cache miss for pinned proposal and returns reviews', async () => {
      // ENS EP 6.50 proposal
      const governorAddress = '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3';
      const proposalId = '77767899528494238518019756391533686963875234067646094287125791110488147463806';

      const req = new Request('http://localhost/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: 'ethereum',
          governorAddress,
          proposalId,
        }),
      });

      const res = (await reviewHandler(req)) as Response;
      expect(res.status).toBe(200);

      const json = (await res.json()) as { serv: any; dolphin: any };
      expect(json.serv).toBeDefined();
      expect(json.dolphin).toBeDefined();
      expect(json.serv.status).toBe('not_configured');
      expect(json.dolphin.status).toBe('not_configured');

      // Verify that recomputed proposal is now stored in cache
      const cacheKey = buildCacheKey('ethereum', governorAddress, proposalId);
      const cached = await getProposalCache(cacheKey);
      expect(cached).not.toBeNull();
      expect(cached?.proposal.id).toBe(proposalId);
    });

    it('rejects invalid network or addresses with 400', async () => {
      const req = new Request('http://localhost/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: 'solana',
          governorAddress: '0x123',
          proposalId: '1',
        }),
      });

      const res = (await reviewHandler(req)) as Response;
      expect(res.status).toBe(400);
    });
  });

  describe('Provider Error Classification & Retry Policy', () => {
    it('classifies 401/402 as non-retryable auth_error', () => {
      const err = new Error('Authentication failed (401): invalid key');
      const c = classifyProviderError(err);
      expect(c.status).toBe('auth_error');
      expect(c.errorClass).toBe('auth_error');
      expect(c.retryable).toBe(false);
    });

    it('classifies 429 as retryable rate_limited', () => {
      const err = new Error('Rate limit exceeded (429): Quota exceeded');
      const c = classifyProviderError(err);
      expect(c.status).toBe('rate_limited');
      expect(c.errorClass).toBe('rate_limited');
      expect(c.retryable).toBe(true);
    });

    it('classifies timeout as retryable timed_out', () => {
      const err = new Error('Request timed out after 15000ms');
      const c = classifyProviderError(err);
      expect(c.status).toBe('timed_out');
      expect(c.errorClass).toBe('timed_out');
      expect(c.retryable).toBe(true);
    });

    it('classifies injection safety blocks as non-retryable guard_blocked', () => {
      const err = new Error('Violation: serv_prompt_guard flagged injection attempt');
      const c = classifyProviderError(err);
      expect(c.status).toBe('guard_blocked');
      expect(c.errorClass).toBe('guard_blocked');
      expect(c.retryable).toBe(false);
    });

    it('classifies json schema errors as non-retryable schema_invalid', () => {
      const err = new Error('Failed to parse structured JSON output from provider response');
      const c = classifyProviderError(err);
      expect(c.status).toBe('schema_invalid');
      expect(c.errorClass).toBe('schema_invalid');
      expect(c.retryable).toBe(false);
    });

    it('classifies 500 as retryable upstream_error', () => {
      const err = new Error('Provider server error (502): Bad gateway');
      const c = classifyProviderError(err);
      expect(c.status).toBe('upstream_error');
      expect(c.errorClass).toBe('upstream_error');
      expect(c.retryable).toBe(true);
    });
  });
});

