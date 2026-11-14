import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeUsageSpend,
  recordSpend,
  getTrackedSpend,
  resetTrackedSpend,
  checkBudgetAvailability,
  getStoredPinnedReview,
  SERV_PRICING,
  DOLPHIN_PRICING,
} from '../../server/budget';

describe('Server Budget & Spend Protection', () => {
  beforeEach(() => {
    resetTrackedSpend();
    delete process.env.AI_PAUSED;
    delete process.env.SERV_DAILY_CAP_USD;
    delete process.env.DOLPHIN_DAILY_CAP_USD;
  });

  it('correctly calculates spend from reported token usage', () => {
    // 10,000 prompt tokens + 2,000 completion tokens on serv-swift
    // prompt: 10,000 * (0.125 / 1M) = $0.00125
    // completion: 2,000 * (0.650 / 1M) = $0.00130
    // total = $0.00255
    const servSpend = computeUsageSpend('serv', 'serv-swift', {
      prompt_tokens: 10_000,
      completion_tokens: 2_000,
    });
    expect(servSpend).toBeCloseTo(0.00255, 6);

    // Dolphin Lighthouse DeepSeek pricing ($0.14 / 1M prompt, $0.28 / 1M completion)
    const dolphinSpend = computeUsageSpend('dolphin', 'deepseek-ai/DeepSeek-V4.1-Flash', {
      prompt_tokens: 10_000,
      completion_tokens: 2_000,
    });
    expect(dolphinSpend).toBeCloseTo(0.00196, 6);
  });

  it('tracks spend cumulatively and respects daily caps', () => {
    expect(getTrackedSpend('serv')).toBe(0);
    recordSpend('serv', 0.50);
    recordSpend('serv', 0.75);
    expect(getTrackedSpend('serv')).toBe(1.25);

    process.env.SERV_DAILY_CAP_USD = '1.00';
    const status = checkBudgetAvailability('serv');
    expect(status.allowed).toBe(false);
    expect(status.reason).toContain('SERV daily spend cap reached');
    expect(status.reason).toContain('baseline still works');
  });

  it('enforces manual AI_PAUSED kill switch', () => {
    process.env.AI_PAUSED = 'true';
    const servStatus = checkBudgetAvailability('serv');
    expect(servStatus.allowed).toBe(false);
    expect(servStatus.reason).toBe('AI review paused, baseline still works.');

    const dolphinStatus = checkBudgetAvailability('dolphin');
    expect(dolphinStatus.allowed).toBe(false);
    expect(dolphinStatus.reason).toBe('AI review paused, baseline still works.');
  });

  it('serves stored real outputs for pinned proposals', () => {
    const ensId = '77767899528494238518019756391533686963875234067646094287125791110488147463806';
    const stored = getStoredPinnedReview(ensId);
    expect(stored).not.toBeNull();
    expect(stored?.serv.status).toBe('ok');
    expect(stored?.serv.summary).toContain('Recorded live on 2026-11-14');
    expect(stored?.dolphin.status).toBe('ok');
    expect(stored?.dolphin.questions).toBeDefined();
    expect(stored?.dolphin.questions?.length).toBeGreaterThan(0);
  });
});
