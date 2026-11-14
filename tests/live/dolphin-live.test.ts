import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'fs';
import { reviewWithDolphin } from '../../server/providers/dolphin';
import type { ProposalAction, Finding } from '../../src/types/analysis';

describe('Phase D: Dolphin Live Probe & Rebuttal Loop', () => {
  const sampleDescription = `# [Executable] Establishing a new Security Council
## Abstract
This proposal establishes the new ENS Security Council based on the results of EP 6.50 “Election of the New ENS DAO Security Council”. The term will last two years, until 16 July 2028.

## Motivation
The Security Council was originally established in EP 5.13 as a 4-of-8 multisig with a single power: to cancel malicious proposals made to ENS DAO. It cannot propose, amend, or initiate any governance action. Its term was two years, ending 24 July 2026.

## Specification
A single call to the DAO’s TimelockController, granting PROPOSER_ROLE to Blockful’s Security Council contract.`;

  const ensAction: ProposalAction = {
    index: 0,
    target: '0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7',
    targetName: 'TimelockController',
    value: '0',
    signature: 'grantRole(bytes32,address)',
    selector: '0x2f2ff15d',
    decoded: true,
    functionName: 'grantRole',
    rawCalldata: '0x2f2ff15db09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc10000000000000000000000002acbf518b3759f6e1fa163294eda55bf1d0ae051',
    args: [
      {
        name: 'role',
        type: 'bytes32',
        value: '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1',
      },
      {
        name: 'account',
        type: 'address',
        value: '0x2acBf518b3759f6e1fA163294eda55bF1d0ae051',
      },
    ],
    roleCapability: {
      status: 'resolved',
      capabilities: [
        { fn: 'schedule()', gatedBy: 'PROPOSER_ROLE' },
        { fn: 'cancel()', gatedBy: 'PROPOSER_ROLE' },
      ],
      summary: 'can schedule and cancel on TimelockController (per verified source)',
      sourceOrigin: 'verified_source',
    },
    recipientProfile: {
      type: 'contract',
      isVerified: true,
      deployedDaysBefore: 12,
      deployedTimestamp: 1783713622,
      summary: 'Recipient: contract, verified',
    },
  };

  const ensFindings: Finding[] = [
    {
      id: 'PRIVILEGE_GRANT',
      severity: 'high',
      title: 'Critical privilege grant: PROPOSER_ROLE',
      description: 'Grants PROPOSER_ROLE to 0x2acb... -> can schedule and cancel on TimelockController (per verified source). Recipient: contract, verified',
      whyItMatters: 'PROPOSER_ROLE grants the ability to schedule arbitrary governance operations through the TimelockController.',
      verified: true,
    },
  ];

  it.skipIf(!process.env.DOLPHIN_API_KEY)(
    'generates adversarial scenarios and applies deterministic rebuttal loop on ENS EP 6.50',
    async () => {
      const start = Date.now();
      const review = await reviewWithDolphin(sampleDescription, [ensAction], ensFindings);
      const durationMs = Date.now() - start;

      console.log('Dolphin Review Status:', review.status);
      console.log('Dolphin Summary:', review.summary);
      console.log('Scenarios Count:', review.scenarios?.length);
      console.log('Items Count:', review.items?.length);
      console.log('Duration (ms):', durationMs);

      expect(['ok', 'available']).toContain(review.status);
      expect(typeof review.summary).toBe('string');
      expect((review.summary ?? '').length).toBeGreaterThan(10);
      expect(review.scenarios).toBeDefined();
      expect(review.scenarios!.length).toBeGreaterThan(0);
      expect(review.scenarios!.length).toBeLessThanOrEqual(3);

      // Verify each scenario has undergone the deterministic rebuttal loop
      for (const sc of review.scenarios!) {
        console.log(`- Scenario [${sc.severityHint}]: ${sc.title}`);
        console.log(`  Rebuttal Status: ${sc.rebuttalStatus}`);
        console.log(`  Engine Audit: ${sc.refutedBy}`);
        expect(['refuted_by_data', 'not_refuted', 'needs_human']).toContain(sc.rebuttalStatus);
        expect(typeof sc.refutedBy).toBe('string');
      }

      // Verify items cap and reference integrity
      expect(review.items!.length).toBeLessThanOrEqual(3);
      for (const item of review.items!) {
        console.log(`- Item [${item.kind}]: ${item.issue}`);
        const hasValidRef =
          (item.actionRef !== undefined && item.actionRef >= 0 && item.actionRef < 1) ||
          item.findingRef !== undefined;
        expect(hasValidRef).toBe(true);
      }

      // Save raw evidence
      const evidence = {
        timestamp: new Date().toISOString(),
        endpoint: process.env.DOLPHIN_ENDPOINT || 'https://lighthouse.dphn.ai/run/text-v/v1/chat/completions',
        model: process.env.DOLPHIN_MODEL || 'deepseek-ai/DeepSeek-V4.1-Flash',
        durationMs,
        review,
      };

      writeFileSync(
        'docs/evidence/raw/phase-d-dolphin-probe.json',
        JSON.stringify(evidence, null, 2),
        'utf8'
      );
      console.log('Wrote evidence to docs/evidence/raw/phase-d-dolphin-probe.json');
    },
    60000
  );
});

