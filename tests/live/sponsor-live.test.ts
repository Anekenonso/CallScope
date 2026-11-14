import { describe, it, expect } from 'vitest';
import { reviewWithServ } from '../../server/providers/serv';
import { reviewWithDolphin } from '../../server/providers/dolphin';
import type { ProposalAction, Finding } from '../../src/types/analysis';

describe('Live Sponsor Provider Verification (T5.9)', () => {
  const minimalActions: ProposalAction[] = [
    {
      index: 0,
      target: '0x0000000000000000000000000000000000000001',
      value: '0',
      rawCalldata: '0x',
      decoded: false,
      signature: '',
      selector: '0x',
    },
  ];

  const minimalFindings: Finding[] = [
    {
      id: 'TEST_FINDING',
      severity: 'low',
      title: 'Test Finding',
      description: 'Minimal verification test finding.',
      verified: true,
      whyItMatters: 'Verification test artifact.',
    },
  ];

  it.skipIf(!process.env.SERV_API_KEY)(
    'runs minimal live authenticated call to OpenServ SERV when key configured',
    async () => {
      const review = await reviewWithServ(
        'Proposal to perform a routine maintenance update.',
        minimalActions
      );

      console.log('Live SERV Review Result Status:', review.status);
      if (review.error) {
        console.log('Live SERV Error Message:', review.error);
      } else {
        console.log('Live SERV Summary:', review.summary);
        console.log('Live SERV Findings Count:', review.findings?.length ?? 0);
      }

      // When API key is configured, assert valid authenticated response
      expect(['ok', 'available']).toContain(review.status);
      expect(typeof review.summary).toBe('string');
      expect((review.summary ?? '').length).toBeGreaterThan(10);
      expect(Array.isArray(review.findings)).toBe(true);
    },
    45000
  );

  it.skipIf(!process.env.DOLPHIN_API_KEY)(
    'runs minimal live authenticated call to Dolphin when key configured',
    async () => {
      const review = await reviewWithDolphin(
        'Proposal to perform a routine maintenance update.',
        minimalActions,
        minimalFindings
      );

      console.log('Live Dolphin Review Result Status:', review.status);
      if (review.error) {
        console.log('Live Dolphin Error Message:', review.error);
      } else {
        console.log('Live Dolphin Summary:', review.summary);
        console.log('Live Dolphin Findings Count:', review.findings?.length ?? 0);
      }

      // When API key is configured, assert valid authenticated response
      expect(['ok', 'available']).toContain(review.status);
      expect(typeof review.summary).toBe('string');
      expect((review.summary ?? '').length).toBeGreaterThan(10);
      expect(Array.isArray(review.findings)).toBe(true);
    },
    45000
  );
});
