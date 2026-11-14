import { z } from 'zod';
import { isAddress } from 'viem';
import { resolveServModel } from '../providers/serv-model';

// 1. API Request Boundaries Schemas
export const AnalysisRequestSchema = z.object({
  network: z.enum(['ethereum', 'base'], {
    errorMap: () => ({ message: 'Network must be either "ethereum" or "base"' }),
  }),
  governorAddress: z
    .string()
    .refine((val) => isAddress(val.trim()), {
      message: 'Must be a valid 40-character hexadecimal Ethereum address',
    })
    .optional(),
  proposalId: z
    .string()
    .regex(/^\d+$/, { message: 'Proposal ID must be a non-empty decimal integer string' })
    .optional(),
  txHashOrUrl: z.string().optional(),
  reverifyLive: z.boolean().optional(),
}).refine(
  (data) => (data.governorAddress && data.proposalId) || data.txHashOrUrl,
  {
    message: 'Must provide either governorAddress + proposalId OR txHashOrUrl',
    path: ['input'],
  }
);

export type ValidatedAnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

export const ReviewRequestSchema = z.object({
  network: z.enum(['ethereum', 'base'], {
    errorMap: () => ({ message: 'Network must be either "ethereum" or "base"' }),
  }),
  governorAddress: z.string().refine((val) => isAddress(val.trim()), {
    message: 'governorAddress is required and must be a valid 40-character hexadecimal address',
  }),
  proposalId: z
    .string()
    .regex(/^\d+$/, { message: 'proposalId is required and must be a decimal integer string' }),
  tier: z.enum(['standard', 'deep']).optional(),
  reverifyLive: z.boolean().optional(),
  useStoredReviews: z.boolean().optional(),
});

export type ValidatedReviewRequest = z.infer<typeof ReviewRequestSchema>;

// 2. Provider Output Schemas
export const ReviewItemSchema = z.object({
  kind: z.enum(['supported', 'unsupported_claim', 'risk', 'contradiction', 'note']),
  issue: z.string(),
  actionRef: z.number().int().nonnegative().optional(),
  findingRef: z.string().optional(),
  evidence: z.string().optional(),
  evidenceId: z.string().optional(),
  claimRef: z.string().optional(),
});

export const AttackScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  preconditions: z.array(z.string()),
  steps: z.array(
    z.object({
      actionRef: z.number().int().nonnegative().optional(),
      description: z.string(),
    })
  ),
  impact: z.string(),
  severityHint: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  rebuttalStatus: z.enum(['not_refuted', 'refuted_by_data', 'needs_human']),
  refutedBy: z.string().optional(),
});

export const ProviderReviewSchema = z.object({
  provider: z.string().optional(),
  status: z.enum([
    'ok',
    'available',
    'pending',
    'not_configured',
    'rate_limited',
    'timed_out',
    'auth_error',
    'upstream_error',
    'validation_error',
    'error',
    'guard_blocked',
  ]),
  summary: z.string().optional(),
  items: z.array(ReviewItemSchema).optional(),
  findings: z.array(z.string()).optional(),
  scenarios: z.array(AttackScenarioSchema).optional(),
  questions: z.array(z.string()).optional(),
  modelReturned: z.string().optional(),
  error: z.string().optional(),
  reason: z.string().optional(),
  tier: z.enum(['instant', 'standard', 'deep']).optional(),
  attempts: z.number().int().positive().optional(),
  durationMs: z.number().nonnegative().optional(),
});

export type ValidatedProviderReview = z.infer<typeof ProviderReviewSchema>;

// 3. Environment Startup Validation Schema
export const EnvStartupSchema = z.object({
  SERV_MODEL: z.string().optional(),
  SERV_API_KEY: z.string().optional(),
  DOLPHIN_API_KEY: z.string().optional(),
  AI_PAUSED: z.enum(['true', 'false']).optional(),
  SERV_DAILY_CAP_USD: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'SERV_DAILY_CAP_USD must be a positive number',
    })
    .optional(),
  DOLPHIN_DAILY_CAP_USD: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'DOLPHIN_DAILY_CAP_USD must be a positive number',
    })
    .optional(),
});

export class RequestValidationError extends Error {
  errors: { field: string; message: string }[];
  constructor(message: string, errors: { field: string; message: string }[]) {
    super(message);
    this.name = 'RequestValidationError';
    this.errors = errors;
  }
}

/**
 * Validate incoming /api/analyse request payload using Zod
 */
export function validateAnalysisRequest(body: unknown): ValidatedAnalysisRequest {
  const result = AnalysisRequestSchema.safeParse(body);
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => ({
      field: e.path.join('.') || 'body',
      message: e.message,
    }));
    throw new RequestValidationError('Invalid analysis request payload', errorDetails);
  }
  return result.data;
}

/**
 * Validate incoming /api/review request payload using Zod
 */
export function validateReviewRequest(body: unknown): ValidatedReviewRequest {
  const result = ReviewRequestSchema.safeParse(body);
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => ({
      field: e.path.join('.') || 'body',
      message: e.message,
    }));
    throw new RequestValidationError('Invalid review request payload', errorDetails);
  }
  return result.data;
}

/**
 * Validate server environment at startup using Zod and SERV model catalog
 */
export function validateEnvStartup(env: NodeJS.ProcessEnv = process.env): {
  servModel: string;
  isAiPaused: boolean;
  servDailyCapUsd?: number;
  dolphinDailyCapUsd?: number;
} {
  const parseResult = EnvStartupSchema.safeParse(env);
  if (!parseResult.success) {
    const msg = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Environment startup validation failed: ${msg}`);
  }

  // Model catalog validation (throws if model is invalid)
  const servModel = resolveServModel(env.SERV_MODEL);

  const isAiPaused = env.AI_PAUSED === 'true';
  const servDailyCapUsd = env.SERV_DAILY_CAP_USD ? parseFloat(env.SERV_DAILY_CAP_USD) : undefined;
  const dolphinDailyCapUsd = env.DOLPHIN_DAILY_CAP_USD ? parseFloat(env.DOLPHIN_DAILY_CAP_USD) : undefined;

  return {
    servModel,
    isAiPaused,
    servDailyCapUsd,
    dolphinDailyCapUsd,
  };
}
