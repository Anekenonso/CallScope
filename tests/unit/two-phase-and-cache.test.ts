import { describe, it, expect } from 'vitest';
import {
  buildCacheKey,
  getProposalCache,
  setProposalCache,
  checkIpRateLimit,
  SCHEMA_VERSION,
} from '../../server/cache';
import { computeReviewerAgreement } from '../../src/lib/reviewer-agreement';
import type { AnalysisResponse } from '../../src/types/analysis';

describe('Task 6: Two-Phase Response, Cache, and Reviewer Agreement', () => {
  describe('Cache & Rate Limiting', () => {
    const mockResponse: AnalysisResponse = {
      assessment: 'no_significant_issue_detected',
      network: 'ethereum',
      governorAddress: '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3',
      proposal: {
        id: '123',
        description: 'Mock proposal',
        status: 'Active',
      },
      actions: [],
      findings: [],
      descriptionConsistency: {
        status: 'consistent',
        explanation: 'Consistent',
      },
      reviews: {
        serv: { status: 'pending' },
        dolphin: { status: 'pending' },
      },
      limitations: [],
      evidence: [],
    };

    it('buildCacheKey correctly normalizes chain, governor, and schemaVersion', () => {
      const key = buildCacheKey(
        'ethereum',
        '0x323A76393544D5ECCA80CD6EF2A560C6A395B7E3',
        '123'
      );
      expect(key).toBe(`ethereum:0x323a76393544d5ecca80cd6ef2a560c6a395b7e3:123:${SCHEMA_VERSION}`);
    });

    it('stores and retrieves items from in-memory cache', async () => {
      const key = buildCacheKey('ethereum', '0x1111111111111111111111111111111111111111', '999');
      await setProposalCache(key, mockResponse, 60);

      const cached = await getProposalCache(key);
      expect(cached).not.toBeNull();
      expect(cached?.proposal.id).toBe('123');
    });

    it('respects TTL expiration in cache', async () => {
      const key = buildCacheKey('ethereum', '0x2222222222222222222222222222222222222222', '888');
      // Set TTL of 0 seconds (immediately expired)
      await setProposalCache(key, mockResponse, -1);

      const cached = await getProposalCache(key);
      expect(cached).toBeNull();
    });

    it('tracks IP rate limits and triggers 429 when threshold exceeded', () => {
      const testIp = '192.168.1.100';
      // First 30 requests should succeed
      for (let i = 0; i < 30; i++) {
        const check = checkIpRateLimit(testIp);
        expect(check.isLimited).toBe(false);
      }

      // 31st request should be rate-limited
      const limitedCheck = checkIpRateLimit(testIp);
      expect(limitedCheck.isLimited).toBe(true);
      expect(limitedCheck.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('Reviewer Agreement Strip', () => {
    it('returns pending status when either reviewer is pending', () => {
      const agreement = computeReviewerAgreement(
        'review_recommended',
        { status: 'pending' },
        { status: 'available', items: [] }
      );
      expect(agreement.status).toBe('pending');
      expect(agreement.headline).toBe('Reviewer comparison pending...');
    });

    it('returns single_available when sponsor reviews are not configured or error', () => {
      const agreement = computeReviewerAgreement(
        'no_significant_issue_detected',
        { status: 'not_configured' },
        { status: 'error', error: 'Network error' }
      );
      expect(agreement.status).toBe('single_available');
      expect(agreement.headline).toContain('Deterministic engine authoritative');
    });

    it('returns agree when Engine and all available sponsors flag issues', () => {
      const agreement = computeReviewerAgreement(
        'review_recommended',
        {
          status: 'available',
          items: [{ kind: 'contradiction', issue: 'Stated role differs from calldata' }],
        },
        {
          status: 'available',
          items: [{ kind: 'risk', issue: 'High privileges granted to unverified target' }],
        }
      );
      expect(agreement.status).toBe('agree');
      expect(agreement.headline).toBe('Reviewers agree');
      expect(agreement.stances[0]?.verdict).toBe('flagged');
      expect(agreement.stances[1]?.verdict).toBe('flagged');
      expect(agreement.stances[2]?.verdict).toBe('flagged');
    });

    it('returns agree when Engine and all available sponsors detect no issues', () => {
      const agreement = computeReviewerAgreement(
        'no_significant_issue_detected',
        {
          status: 'available',
          items: [{ kind: 'supported', issue: 'All transfers match description' }],
        },
        {
          status: 'available',
          items: [{ kind: 'note', issue: 'Standard treasury distribution' }],
        }
      );
      expect(agreement.status).toBe('agree');
      expect(agreement.headline).toBe('Reviewers agree');
      expect(agreement.stances[0]?.verdict).toBe('clear');
      expect(agreement.stances[1]?.verdict).toBe('clear');
      expect(agreement.stances[2]?.verdict).toBe('clear');
    });

    it('returns disagree with human review needed when Engine finds no issues but sponsor flags a contradiction', () => {
      const agreement = computeReviewerAgreement(
        'no_significant_issue_detected',
        {
          status: 'available',
          items: [{ kind: 'contradiction', issue: 'Description claims 100 UNI but action sends 1000 UNI' }],
        },
        {
          status: 'available',
          items: [{ kind: 'supported', issue: 'Valid ABI call' }],
        }
      );
      expect(agreement.status).toBe('disagree');
      expect(agreement.headline).toBe('Reviewers disagree: human review needed');
      expect(agreement.stances[0]?.verdict).toBe('clear');
      expect(agreement.stances[1]?.verdict).toBe('flagged');
    });

    it('returns disagree when Engine flags review_recommended but sponsors find no issues', () => {
      const agreement = computeReviewerAgreement(
        'review_recommended',
        {
          status: 'available',
          items: [{ kind: 'supported', issue: 'All claims match' }],
        },
        {
          status: 'available',
          items: [{ kind: 'supported', issue: 'No issues found' }],
        }
      );
      expect(agreement.status).toBe('disagree');
      expect(agreement.headline).toBe('Reviewers disagree: human review needed');
    });
  });

  describe('Two-Phase Review API Endpoint (/api/review)', () => {
    it('executes sponsor reviews for valid proposal and stores reviews in cache', async () => {
      const handler = (await import('../../api/_review')).default;

      // Pinned ENS fixture
      const req = new Request('http://localhost/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: 'ethereum',
          governorAddress: '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3',
          proposalId: '77767899528494238518019756391533686963875234067646094287125791110488147463806',
        }),
      });

      const res = (await handler(req)) as Response;
      expect(res.status).toBe(200);
      const json = (await res.json()) as { serv: any; dolphin: any };
      expect(json.serv).toBeDefined();
      expect(json.dolphin).toBeDefined();
    });
  });
});
