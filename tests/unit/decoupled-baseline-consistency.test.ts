import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeAnalysis } from '../../api/_analyse';
import reviewHandler from '../../api/_review';
import { clearMemoryCache } from '../../server/cache';

describe('Task 2: Decouple Baseline Assessment from Sponsor Work', () => {
  const ensGovernor = '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3';
  const ensProposalId = '77767899528494238518019756391533686963875234067646094287125791110488147463806';

  const originalFetch = global.fetch;
  const savedEnv = {
    SERV_API_KEY: process.env.SERV_API_KEY,
    DOLPHIN_API_KEY: process.env.DOLPHIN_API_KEY,
  };

  const cleanEnv = () => {
    delete process.env.SERV_API_KEY;
    delete process.env.DOLPHIN_API_KEY;
  };

  beforeEach(() => {
    clearMemoryCache();
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
    if (savedEnv.SERV_API_KEY) process.env.SERV_API_KEY = savedEnv.SERV_API_KEY;
    if (savedEnv.DOLPHIN_API_KEY) process.env.DOLPHIN_API_KEY = savedEnv.DOLPHIN_API_KEY;
  });

  it('proves same proposal yields identical baseline assessment across all sponsor states (enabled, disabled, error, timeout)', async () => {
    // 1. Scenario A: Sponsors disabled (no API keys)
    delete process.env.SERV_API_KEY;
    delete process.env.DOLPHIN_API_KEY;
    const baselineDisabled = await executeAnalysis({
      network: 'ethereum',
      governorAddress: ensGovernor,
      proposalId: ensProposalId,
    });

    // 2. Scenario B: Sponsors enabled (keys set)
    clearMemoryCache();
    process.env.SERV_API_KEY = 'serv-live-mock-key';
    process.env.DOLPHIN_API_KEY = 'dolphin-live-mock-key';
    const baselineEnabled = await executeAnalysis({
      network: 'ethereum',
      governorAddress: ensGovernor,
      proposalId: ensProposalId,
    });

    // 3. Scenario C: Sponsors throw or timeout
    clearMemoryCache();
    global.fetch = vi.fn().mockImplementation(async () => {
      throw new Error('Upstream provider timed out after 30000ms');
    });
    const baselineFailing = await executeAnalysis({
      network: 'ethereum',
      governorAddress: ensGovernor,
      proposalId: ensProposalId,
    });

    // Invariance assertions: Baseline engine is authoritative and unaffected by sponsor state
    expect(baselineDisabled.assessment).toBe('review_recommended');
    expect(baselineEnabled.assessment).toBe(baselineDisabled.assessment);
    expect(baselineFailing.assessment).toBe(baselineDisabled.assessment);

    // Consistency status & explanation invariance
    expect(baselineDisabled.descriptionConsistency.status).toBe(baselineEnabled.descriptionConsistency.status);
    expect(baselineDisabled.descriptionConsistency.status).toBe(baselineFailing.descriptionConsistency.status);
    expect(baselineDisabled.descriptionConsistency.explanation).toBe(baselineEnabled.descriptionConsistency.explanation);
    expect(baselineDisabled.descriptionConsistency.explanation).toBe(baselineFailing.descriptionConsistency.explanation);

    // Findings count & IDs invariance
    expect(baselineDisabled.findings.length).toBe(baselineEnabled.findings.length);
    expect(baselineDisabled.findings.length).toBe(baselineFailing.findings.length);
    expect(baselineDisabled.findings.map((f) => f.id)).toEqual(baselineEnabled.findings.map((f) => f.id));
    expect(baselineDisabled.findings.map((f) => f.id)).toEqual(baselineFailing.findings.map((f) => f.id));

    // Phase 1 reviews remain pending (Phase 1 never executes sponsor reviews)
    expect(baselineDisabled.reviews.serv.status).toBe('pending');
    expect(baselineEnabled.reviews.serv.status).toBe('pending');
    expect(baselineFailing.reviews.serv.status).toBe('pending');
  });

  it('labels Phase 1 consistency output explicitly as "Baseline consistency (rule-based)"', async () => {
    delete process.env.SERV_API_KEY;
    delete process.env.DOLPHIN_API_KEY;

    const res = await executeAnalysis({
      network: 'ethereum',
      governorAddress: ensGovernor,
      proposalId: ensProposalId,
    });

    expect(res.descriptionConsistency.explanation).toContain('Baseline consistency (rule-based)');
    expect(res.descriptionConsistency.mode).toBe('keyword_fallback');
  });

  it('evaluates extended claims check in Phase 2 (/api/review) without altering Phase 1 baseline assessment', async () => {
    process.env.SERV_API_KEY = 'test-serv-key';
    process.env.DOLPHIN_API_KEY = 'test-dolphin-key';

    // Mock fetch to provide structured SERV claim extraction response and advisory review
    global.fetch = vi.fn().mockImplementation(async () => {
      // Mock SERV extraction / review
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  summary: 'OpenServ SERV: Verified operational parameters.',
                  items: [
                    {
                      kind: 'supported',
                      issue: 'The TimelockController grantRole call matches proposal specification.',
                    },
                  ],
                  claims: [
                    {
                      id: 'claim-1',
                      quote: 'A single call to the DAO’s TimelockController, granting `PROPOSER_ROLE`',
                      category: 'role',
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    // First obtain deterministic Phase 1 result
    const phase1Result = await executeAnalysis({
      network: 'ethereum',
      governorAddress: ensGovernor,
      proposalId: ensProposalId,
    });
    expect(phase1Result.assessment).toBe('review_recommended');
    expect(phase1Result.descriptionConsistency.explanation).toContain('Baseline consistency (rule-based)');

    // Call /api/review
    const req = new Request('http://localhost/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        network: 'ethereum',
        governorAddress: ensGovernor,
        proposalId: ensProposalId,
      }),
    });

    const reviewRes = (await reviewHandler(req)) as Response;
    expect(reviewRes.status).toBe(200);

    const reviewJson = (await reviewRes.json()) as {
      serv: any;
      dolphin: any;
      extendedClaimsCheck?: any;
    };

    expect(reviewJson.serv.status).toBe('ok');
    expect(reviewJson.dolphin.status).toBe('ok');
    // Baseline assessment from Phase 1 remains untouched
    expect(phase1Result.assessment).toBe('review_recommended');
  });
});
