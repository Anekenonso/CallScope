import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  evaluateScenarioRebuttal,
  reviewWithDolphin,
} from '../../server/providers/dolphin';
import { computeReviewerAgreement } from '../../src/lib/reviewer-agreement';
import type {
  ProposalAction,
  Finding,
  AttackScenario,
  ProviderReview,
  DescriptionConsistency,
} from '../../src/types/analysis';

describe('Task 7: Dolphin Adversarial Attack Scenarios & Engine Rebuttal Loop', () => {
  const mockActions: ProposalAction[] = [
    {
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
        summary: 'can schedule and cancel on TimelockController',
        sourceOrigin: 'verified_source',
      },
      recipientProfile: {
        type: 'contract',
        isVerified: true,
        deployedDaysBefore: 12,
        deployedTimestamp: 1783713622,
        summary: 'Recipient: contract, verified',
      },
    },
  ];

  const restrictedCancelOnlyActions: ProposalAction[] = [
    {
      ...mockActions[0],
      roleCapability: {
        status: 'resolved',
        capabilities: [{ fn: 'cancel()', gatedBy: 'CANCELLER_ROLE' }],
        summary: 'can only cancel on TimelockController',
        sourceOrigin: 'verified_source',
      },
    },
  ];

  const mockFindings: Finding[] = [
    {
      id: 'admin_role_granted',
      title: 'Privileged Role Granted',
      description: 'Proposer role granted on TimelockController',
      severity: 'medium',
      whyItMatters: 'Enables proposal queueing',
      verified: true,
    },
  ];

  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Deterministic Engine Rebuttal Loop (evaluateScenarioRebuttal)', () => {
    it('refutes scenario when actionRef is invalid or out of bounds', () => {
      const scenario: Partial<AttackScenario> = {
        id: 'sc-1',
        title: 'Exploit non-existent action',
        steps: [{ actionRef: 99, description: 'Invoke ghost action' }],
      };

      const result = evaluateScenarioRebuttal(scenario, mockActions, mockFindings);
      expect(result.rebuttalStatus).toBe('refuted_by_data');
      expect(result.refutedBy).toContain('Action reference #99 does not exist');
    });

    it('refutes scenario when findingRef does not exist in deterministic findings', () => {
      const scenario: Partial<AttackScenario> = {
        id: 'sc-2',
        title: 'Exploit hallucinated finding',
        steps: [{ findingRef: 'ghost_finding_id', description: 'Leverage fake bug' }],
      };

      const result = evaluateScenarioRebuttal(scenario, mockActions, mockFindings);
      expect(result.rebuttalStatus).toBe('refuted_by_data');
      expect(result.refutedBy).toContain('does not exist in deterministic findings');
    });

    it('refutes scenario claiming treasury drain when action transfers 0 native wei', () => {
      const scenario: Partial<AttackScenario> = {
        id: 'sc-3',
        title: 'Direct Treasury Ether Drain',
        steps: [{ actionRef: 0, description: 'Steal ether from treasury' }],
        impact: 'Treasury funds completely drained',
      };

      const result = evaluateScenarioRebuttal(scenario, mockActions, mockFindings);
      expect(result.rebuttalStatus).toBe('refuted_by_data');
      expect(result.refutedBy).toContain('transfers 0 native wei and invokes "grantRole"');
    });

    it('refutes scenario claiming arbitrary scheduling when contract source restricts role to cancel() only', () => {
      const scenario: Partial<AttackScenario> = {
        id: 'sc-4',
        title: 'Queue Malicious Transaction via Schedule',
        steps: [{ actionRef: 0, description: 'Call schedule() to queue exploit' }],
      };

      const result = evaluateScenarioRebuttal(scenario, restrictedCancelOnlyActions, mockFindings);
      expect(result.rebuttalStatus).toBe('refuted_by_data');
      expect(result.refutedBy).toContain('role is strictly limited to cancel()');
    });

    it('does not refute (substantiates) scenario when verified capabilities confirm schedule() power', () => {
      const scenario: Partial<AttackScenario> = {
        id: 'sc-5',
        title: 'Unauthorized Proposal Scheduling',
        steps: [{ actionRef: 0, description: 'Invoke schedule() on Timelock' }],
      };

      const result = evaluateScenarioRebuttal(scenario, mockActions, mockFindings);
      expect(result.rebuttalStatus).toBe('not_refuted');
      expect(result.refutedBy).toContain('role has schedule() capability');
    });

    it('classifies scenario as needs_human when it relies on off-chain multisig key compromise or collusion', () => {
      const scenario: Partial<AttackScenario> = {
        id: 'sc-6',
        title: 'Signer Collusion Attack',
        preconditions: ['Compromised multisig keys', '5 of 8 signers collude off-chain'],
        steps: [{ actionRef: 0, description: 'Signers vote to approve malicious proposal' }],
        impact: 'Governance capture via key theft',
      };

      const result = evaluateScenarioRebuttal(scenario, mockActions, mockFindings);
      expect(result.rebuttalStatus).toBe('needs_human');
      expect(result.refutedBy).toContain('relies on off-chain governance assumptions');
    });
  });

  describe('Dolphin Review Provider Scenario Generation', () => {
    it('parses up to 3 attack scenarios and processes each through the rebuttal loop', async () => {
      process.env.DOLPHIN_API_KEY = 'test-dolphin-key';

      const mockDolphinResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                summary: 'Dolphin adversarial analysis: Identified 2 potential attack vectors.',
                scenarios: [
                  {
                    id: 'sc-1',
                    title: 'Schedule Malicious Timelock Queue',
                    preconditions: ['Contract caller invokes schedule'],
                    steps: [{ actionRef: 0, description: 'Call schedule()' }],
                    impact: 'Queues arbitrary timelock transaction',
                    severityHint: 'high',
                  },
                  {
                    id: 'sc-2',
                    title: 'Theft of Native Ether',
                    steps: [{ actionRef: 0, description: 'Drain eth from contract' }],
                    impact: 'Complete drain of contract balance',
                    severityHint: 'critical',
                  },
                ],
                items: [
                  {
                    kind: 'risk',
                    issue: 'Timelock delay allows 2-day window for cancellation',
                    actionRef: 0,
                  },
                ],
              }),
            },
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockDolphinResponse,
      } as any);

      const review = await reviewWithDolphin('Proposal description', mockActions, mockFindings);

      expect(review.status).toBe('ok');
      expect(review.scenarios).toBeDefined();
      expect(review.scenarios).toHaveLength(2);

      // Scenario 1: schedule is confirmed on Timelock -> not_refuted
      expect(review.scenarios![0].rebuttalStatus).toBe('not_refuted');
      expect(review.scenarios![0].refutedBy).toContain('role has schedule() capability');

      // Scenario 2: ETH drain on grantRole action with 0 wei -> refuted_by_data
      expect(review.scenarios![1].rebuttalStatus).toBe('refuted_by_data');
      expect(review.scenarios![1].refutedBy).toContain('transfers 0 native wei');

      // Items capped and validated
      expect(review.items).toHaveLength(1);
      expect(review.items![0].actionRef).toBe(0);
    });
  });

  describe('Reviewer Agreement Strip States with Scenarios', () => {
    it('reports "agree" (clean) when engine is clean, SERV has no contradictions, and Dolphin scenarios are refuted', () => {
      const serv: ProviderReview = {
        provider: 'serv',
        status: 'ok',
        summary: 'All claims match actions.',
        items: [{ kind: 'supported', issue: 'Valid grant' }],
      };

      const dolphin: ProviderReview = {
        provider: 'dolphin',
        status: 'ok',
        summary: 'Proposed attack scenarios disproved by engine.',
        scenarios: [
          {
            id: 'sc-1',
            title: 'Drain Ether',
            preconditions: [],
            steps: [],
            impact: 'Drain',
            rebuttalStatus: 'refuted_by_data',
            refutedBy: 'Refuted by 0 ETH transfer',
          },
        ],
      };

      const agreement = computeReviewerAgreement('no_significant_issue_detected', serv, dolphin);
      expect(agreement.status).toBe('agree');
      expect(agreement.headline).toBe('Reviewers agree');
      expect(agreement.stances[0].verdict).toBe('clear');
      expect(agreement.stances[1].verdict).toBe('clear');
      expect(agreement.stances[2].verdict).toBe('clear');
    });

    it('reports "disagree" when engine is clean but Dolphin identifies an unrefuted attack scenario', () => {
      const serv: ProviderReview = {
        provider: 'serv',
        status: 'ok',
        summary: 'Description text matches calldata.',
        items: [{ kind: 'supported', issue: 'Valid' }],
      };

      const dolphin: ProviderReview = {
        provider: 'dolphin',
        status: 'ok',
        summary: 'Unrefuted hazard detected.',
        scenarios: [
          {
            id: 'sc-1',
            title: 'Schedule Malicious Action',
            preconditions: [],
            steps: [{ actionRef: 0 }],
            impact: 'Unauthorized proposal queueing',
            rebuttalStatus: 'not_refuted',
            refutedBy: 'Role grants schedule capability',
          },
        ],
      };

      const agreement = computeReviewerAgreement('no_significant_issue_detected', serv, dolphin);
      expect(agreement.status).toBe('disagree');
      expect(agreement.headline).toContain('Reviewers disagree');
      expect(agreement.stances[0].verdict).toBe('clear');
      expect(agreement.stances[2].verdict).toBe('flagged');
      expect(agreement.stances[2].label).toContain('1 unrefuted attack scenario(s)');
    });

    it('reports "agree" (flagged) when engine recommends review, SERV flags contradiction, and Dolphin flags risk', () => {
      const serv: ProviderReview = {
        provider: 'serv',
        status: 'ok',
        items: [{ kind: 'contradiction', issue: 'Description denies proposal power but calldata grants PROPOSER_ROLE' }],
      };

      const dolphin: ProviderReview = {
        provider: 'dolphin',
        status: 'ok',
        scenarios: [
          {
            id: 'sc-1',
            title: 'Proposal Scheduling',
            preconditions: [],
            steps: [],
            impact: 'Timelock exploit',
            rebuttalStatus: 'not_refuted',
            refutedBy: 'Confirmed schedule power',
          },
        ],
      };

      const extendedConsistency: DescriptionConsistency = {
        status: 'inconsistent',
        explanation: 'Contradiction in claims ledger',
      };

      const agreement = computeReviewerAgreement('review_recommended', serv, dolphin, extendedConsistency);
      expect(agreement.status).toBe('agree');
      expect(agreement.stances[0].verdict).toBe('flagged');
      expect(agreement.stances[1].verdict).toBe('flagged');
      expect(agreement.stances[2].verdict).toBe('flagged');
    });

    it('reports "single_available" when both sponsors are unconfigured', () => {
      const serv: ProviderReview = {
        provider: 'serv',
        status: 'not_configured',
      };
      const dolphin: ProviderReview = {
        provider: 'dolphin',
        status: 'not_configured',
      };

      const agreement = computeReviewerAgreement('no_significant_issue_detected', serv, dolphin);
      expect(agreement.status).toBe('single_available');
      expect(agreement.headline).toContain('Deterministic engine authoritative');
    });
  });
});

