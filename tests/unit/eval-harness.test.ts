import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EVAL_FIXTURES,
  scoreFixtureContribution,
  runEvaluationHarness,
  generateMarkdownReport,
} from '../../eval/sponsor-contribution';
import type { AnalysisResponse } from '../../src/types/analysis';

describe('Phase F: Sponsor Contribution Evaluation Harness', () => {
  it('defines all four canonical evaluation fixtures covering all three outcomes', () => {
    expect(EVAL_FIXTURES.length).toBe(4);
    const ids = EVAL_FIXTURES.map((f) => f.id);
    expect(ids).toContain('ens-ep-6-50');
    expect(ids).toContain('unlock-transfers');
    expect(ids).toContain('synthetic-clean-grant');
    expect(ids).toContain('synthetic-opaque-multisig');

    const cleanFixture = EVAL_FIXTURES.find((f) => f.isClean);
    expect(cleanFixture).toBeDefined();
    expect(cleanFixture?.id).toBe('synthetic-clean-grant');
  });

  it('correctly calculates metrics and enforces tool grounding and 100% outcome invariance', () => {
    const fixture = EVAL_FIXTURES[0]; // ENS
    const mockPhase1: AnalysisResponse = {
      assessment: 'review_recommended',
      network: 'ethereum',
      governorAddress: fixture.governorAddress,
      proposal: {
        id: fixture.proposalId,
        description: 'Test proposal description with cannot propose',
        status: 'Executed',
      },
      actions: [
        {
          index: 0,
          target: '0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7',
          value: '0',
          signature: '',
          selector: '0x2f2ff15d',
          decoded: true,
          rawCalldata: '0x2f2ff15d',
        },
      ],
      findings: [
        {
          id: 'PRIVILEGED_ROLE_GRANT',
          severity: 'high',
          title: 'Privileged Role Granted',
          description: 'Grants PROPOSER_ROLE',
          whyItMatters: 'Can schedule actions',
          verified: true,
        },
      ],
      descriptionConsistency: {
        status: 'inconsistent',
        explanation: 'Contradiction between cancel claim and proposer role',
      },
      reviews: {
        serv: { status: 'not_configured' },
        dolphin: { status: 'not_configured' },
      },
      limitations: [],
      evidence: [],
    };

    const mockPhase2 = {
      serv: {
        provider: 'serv',
        status: 'ok' as const,
        summary: 'Detected contradiction in proposing power.',
        items: [
          {
            kind: 'contradiction' as const,
            issue: 'Description asserts cannot propose, but PROPOSER_ROLE grants schedule() power.',
            evidenceId: 'tool-call-1',
            evidence: 'get_action(0) confirms grantRole(PROPOSER_ROLE)',
            actionRef: 0,
          },
        ],
      },
      dolphin: {
        provider: 'dolphin',
        status: 'ok' as const,
        summary: 'Generated attack scenario.',
        scenarios: [
          {
            id: 'scenario-1',
            title: 'Rogue Proposal Scheduling',
            preconditions: ['Council holds PROPOSER_ROLE'],
            steps: [{ actionRef: 0, description: 'Calls schedule()' }],
            impact: 'Unauthorized execution',
            severityHint: 'high' as const,
            rebuttalStatus: 'not_refuted' as const,
          },
        ],
      },
    };

    const scorecard = scoreFixtureContribution(fixture, mockPhase1, mockPhase2, 100, 200);

    expect(scorecard.isInvariant).toBe(true);
    expect(scorecard.assessmentPhase1).toBe('review_recommended');
    expect(scorecard.servContradictionsDetected).toBe(1);
    expect(scorecard.servToolGroundingPct).toBe(100);
    expect(scorecard.dolphinRebuttalSurvivalPct).toBe(100);
    expect(scorecard.dolphinHallucinationPct).toBe(0);
  });

  it('runs the full simulated evaluation harness hermetically offline and generates valid summary', async () => {
    const summary = await runEvaluationHarness(false);

    expect(summary.mode).toBe('simulated');
    expect(summary.fixturesEvaluated).toBe(4);
    expect(summary.deterministicInvariancePct).toBe(100);
    expect(summary.servAggregate.toolGroundingPct).toBe(100);
    expect(summary.servAggregate.falsePositiveRateOnCleanPct).toBe(0);
    expect(summary.dolphinAggregate.hallucinationRatePct).toBe(0);

    const report = generateMarkdownReport(summary);
    expect(report).toContain('[SIMULATED EVALUATION]');
    expect(report).toContain('100% INVARIANT');
  });

  it('verifies that package.json defines all eval scripts', () => {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    expect(pkg.scripts.eval).toBe('node --experimental-strip-types eval/sponsor-contribution.ts');
    expect(pkg.scripts['eval:sim']).toBe('node --experimental-strip-types eval/sponsor-contribution.ts --mode=sim');
    expect(pkg.scripts['eval:live']).toBe('node --experimental-strip-types eval/sponsor-contribution.ts --mode=live');
  });

  it('verifies that evaluation reports exist and contain verified evidence', () => {
    const reportPath = resolve(process.cwd(), 'docs/evidence/phase-f-eval-results.md');
    const rawPath = resolve(process.cwd(), 'docs/evidence/raw/phase-f-eval-raw.json');

    expect(existsSync(reportPath)).toBe(true);
    expect(existsSync(rawPath)).toBe(true);

    const reportContent = readFileSync(reportPath, 'utf8');
    expect(reportContent).toContain('100% INVARIANT');
    expect(reportContent).toContain('ENS EP 6.50');
    expect(reportContent).toContain('[SYNTHETIC] Clean Grant');
  });
});
