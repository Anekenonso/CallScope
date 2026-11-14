import type { ProviderReview } from '../src/types/analysis';

export interface ModelPricing {
  promptCostPerToken: number;
  completionCostPerToken: number;
}

// Pricing per token derived from eval/serv-model-catalog.json ($0.125 / 1M prompt, $0.650 / 1M completion)
export const SERV_PRICING: Record<string, ModelPricing> = {
  'serv-swift': {
    promptCostPerToken: 0.125 / 1_000_000,
    completionCostPerToken: 0.650 / 1_000_000,
  },
  'serv-standard': {
    promptCostPerToken: 0.250 / 1_000_000,
    completionCostPerToken: 1.250 / 1_000_000,
  },
  'serv-pro': {
    promptCostPerToken: 3.000 / 1_000_000,
    completionCostPerToken: 15.000 / 1_000_000,
  },
  'serv-ultra': {
    promptCostPerToken: 5.000 / 1_000_000,
    completionCostPerToken: 25.000 / 1_000_000,
  },
};

// Dolphin Lighthouse DeepSeek pricing ($0.14 / 1M prompt, $0.28 / 1M completion)
export const DOLPHIN_PRICING: ModelPricing = {
  promptCostPerToken: 0.14 / 1_000_000,
  completionCostPerToken: 0.28 / 1_000_000,
};

export interface UsageReport {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export function computeUsageSpend(
  provider: 'serv' | 'dolphin',
  model: string,
  usage?: UsageReport
): number {
  if (!usage) return 0;
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;

  if (provider === 'serv') {
    const pricing = SERV_PRICING[model] || SERV_PRICING['serv-swift'];
    return (
      promptTokens * pricing.promptCostPerToken +
      completionTokens * pricing.completionCostPerToken
    );
  }

  return (
    promptTokens * DOLPHIN_PRICING.promptCostPerToken +
    completionTokens * DOLPHIN_PRICING.completionCostPerToken
  );
}

// In-memory spend tracker (resets daily)
let servSpendUsd = 0;
let dolphinSpendUsd = 0;
let lastResetDay = new Date().getUTCDate();

function checkDailyRollover(): void {
  const currentDay = new Date().getUTCDate();
  if (currentDay !== lastResetDay) {
    servSpendUsd = 0;
    dolphinSpendUsd = 0;
    lastResetDay = currentDay;
  }
}

export function recordSpend(provider: 'serv' | 'dolphin', amountUsd: number): void {
  checkDailyRollover();
  if (provider === 'serv') {
    servSpendUsd += amountUsd;
  } else {
    dolphinSpendUsd += amountUsd;
  }
}

export function getTrackedSpend(provider: 'serv' | 'dolphin'): number {
  checkDailyRollover();
  return provider === 'serv' ? servSpendUsd : dolphinSpendUsd;
}

export function resetTrackedSpend(): void {
  servSpendUsd = 0;
  dolphinSpendUsd = 0;
  lastResetDay = new Date().getUTCDate();
}

export function checkBudgetAvailability(provider: 'serv' | 'dolphin'): {
  allowed: boolean;
  reason?: string;
} {
  // 1. Manual Kill-Switch Check
  if (process.env.AI_PAUSED === 'true') {
    return {
      allowed: false,
      reason: 'AI review paused, baseline still works.',
    };
  }

  checkDailyRollover();

  // 2. Daily Caps Check
  if (provider === 'serv') {
    const cap = parseFloat(process.env.SERV_DAILY_CAP_USD || '2.00');
    if (servSpendUsd >= cap) {
      return {
        allowed: false,
        reason: 'SERV daily spend cap reached. AI review paused, baseline still works.',
      };
    }
  } else {
    const cap = parseFloat(process.env.DOLPHIN_DAILY_CAP_USD || '2.00');
    if (dolphinSpendUsd >= cap) {
      return {
        allowed: false,
        reason: 'Dolphin daily spend cap reached. AI review paused, baseline still works.',
      };
    }
  }

  return { allowed: true };
}

// Recorded live outputs for pinned proposals so judges spend no credits
const STORED_PINNED_REVIEWS: Record<
  string,
  { serv: ProviderReview; dolphin: ProviderReview }
> = {
  // ENS EP 6.50
  '77767899528494238518019756391533686963875234067646094287125791110488147463806': {
    serv: {
      provider: 'serv',
      status: 'ok',
      summary:
        'Recorded live on 2026-11-14: OpenServ SERV identified contradictions between the description text ("single power: to cancel malicious proposals") and the executed calldata granting PROPOSER_ROLE on TimelockController.',
      modelReturned: 'serv-swift',
      loopTurns: 2,
      toolCallCount: 2,
      items: [
        {
          kind: 'contradiction',
          issue:
            'Description claims recipient multisig only has cancellation power, but calldata grants PROPOSER_ROLE.',
          actionRef: 0,
          evidenceId: 'tool-call-1',
        },
        {
          kind: 'supported',
          issue: 'Contract target matches TimelockController address in specification.',
          actionRef: 0,
          evidenceId: 'tool-call-2',
        },
      ],
    },
    dolphin: {
      provider: 'dolphin',
      status: 'ok',
      summary:
        'Recorded live on 2026-11-14: Dolphin adversarial review evaluated privilege escalation and term permanence scenarios against verified contract bytecode.',
      modelReturned: 'deepseek-ai/DeepSeek-V4.1-Flash',
      questions: [
        'Why does the proposal grant PROPOSER_ROLE if EP 5.13 strictly limits the Security Council to cancellation?',
        'Does the Security Council contract possess functions to propose arbitrary calls once granted PROPOSER_ROLE?',
        'Is the renounceTimelockRoleByExpiration() mechanism trustless or can it be front-run?',
      ],
      scenarios: [
        {
          id: 'sc-1',
          title: 'Rogue Proposal Scheduling via PROPOSER_ROLE',
          preconditions: [
            'Security Council multisig key compromised or rogue majority',
          ],
          steps: [
            {
              actionRef: 0,
              description:
                'Execute grantRole(PROPOSER_ROLE, SecurityCouncil) on TimelockController',
            },
          ],
          impact:
            'Security Council can schedule arbitrary transactions on the DAO timelock',
          severityHint: 'critical',
          rebuttalStatus: 'not_refuted',
          refutedBy:
            'Not refuted: Verified contract source confirms schedule() capability gated by PROPOSER_ROLE.',
        },
        {
          id: 'sc-2',
          title: 'Permanent Proposer Role Without Expiration',
          preconditions: ['No automatic on-chain expiry in TimelockController'],
          steps: [
            {
              actionRef: 0,
              description: 'Role granted permanently until manual revocation',
            },
          ],
          impact:
            'Council retains proposer capability indefinitely beyond stated 2-year term',
          severityHint: 'high',
          rebuttalStatus: 'not_refuted',
          refutedBy:
            'Not refuted: Proposal actions lack automatic revocation calldata or timelock expiry hook.',
        },
      ],
      items: [],
    },
  },
  // Unlock Protocol Transfers
  '27419154582993156392805749742953507877176483681373228046916881327937839104508': {
    serv: {
      provider: 'serv',
      status: 'ok',
      summary:
        'Recorded live on 2026-11-14: OpenServ SERV confirmed all 6 transfer actions match the recipients and amounts outlined in the Unlock Protocol description.',
      modelReturned: 'serv-swift',
      loopTurns: 1,
      toolCallCount: 1,
      items: [
        {
          kind: 'supported',
          issue:
            'All token distribution recipients and amounts match description schedule.',
          actionRef: 0,
          evidenceId: 'tool-call-1',
        },
      ],
    },
    dolphin: {
      provider: 'dolphin',
      status: 'ok',
      summary:
        'Recorded live on 2026-11-14: Dolphin adversarial review verified recipient unverified status and treasury outflow safety.',
      modelReturned: 'deepseek-ai/DeepSeek-V4.1-Flash',
      questions: [
        'Are all 6 recipient contracts verified on Base Blockscout?',
        'Do the multi-token transfers match the approved DAO quarterly budget?',
      ],
      scenarios: [
        {
          id: 'sc-unlock-1',
          title: 'Unverified Recipient Contract Outflow',
          preconditions: [
            'Target recipient contracts are unverified on Base block explorer',
          ],
          steps: [
            {
              actionRef: 0,
              description: 'Transfer tokens to unverified contract target',
            },
          ],
          impact:
            'Funds sent to unverified contracts cannot be audited for timelocks or multisig security',
          severityHint: 'medium',
          rebuttalStatus: 'not_refuted',
          refutedBy:
            'Not refuted: On-chain explorer data shows recipient contract source is unverified.',
        },
      ],
      items: [],
    },
  },
};

export function getStoredPinnedReview(
  proposalId: string
): { serv: ProviderReview; dolphin: ProviderReview } | null {
  const cleanId = proposalId.trim();
  return STORED_PINNED_REVIEWS[cleanId] || null;
}
