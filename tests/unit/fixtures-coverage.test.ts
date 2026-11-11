import { describe, it, expect } from 'vitest';
import { executeAnalysis } from '../../api/analyse.js';

describe('Demo Fixtures Coverage Across All Three Outcomes (Task 10)', () => {
  it('exhibits "review_recommended" on ENS EP 6.50', async () => {
    const res = await executeAnalysis({
      network: 'ethereum',
      governorAddress: '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
      proposalId: '77767899528494238518019756391533686963875234067646094287125791110488147463806',
      reverifyLive: false,
    });

    expect(res.assessment).toBe('review_recommended');
    expect(res.proposal.eventSource).toContain('pinned snapshot');
    expect(res.findings.length).toBeGreaterThan(0);
    expect(res.findings.some((f) => f.title.includes('PROPOSER_ROLE'))).toBe(true);
  });

  it('exhibits "no_significant_issue_detected" on [SYNTHETIC] Clean Grant (999001)', async () => {
    const res = await executeAnalysis({
      network: 'ethereum',
      governorAddress: '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
      proposalId: '999001',
      reverifyLive: false,
    });

    expect(res.assessment).toBe('no_significant_issue_detected');
    expect(res.proposal.description).toContain('[SYNTHETIC]');
    expect(res.actions.length).toBe(1);
    expect(res.actions[0].decoded).toBe(true);
    expect(res.findings.length).toBe(0);
    expect(res.descriptionConsistency.status).toBe('consistent');
  });

  it('exhibits "analysis_incomplete" on [SYNTHETIC] Opaque Multi-Sig (999002)', async () => {
    const res = await executeAnalysis({
      network: 'ethereum',
      governorAddress: '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
      proposalId: '999002',
      reverifyLive: false,
    });

    expect(res.assessment).toBe('analysis_incomplete');
    expect(res.proposal.description).toContain('[SYNTHETIC]');
    expect(res.actions.length).toBe(1);
    expect(res.actions[0].decoded).toBe(false);
    expect(res.findings.some((f) => f.id.includes('SAFE_WRAPPER_OPAQUE'))).toBe(true);
  });
});
