import type { VercelRequest, VercelResponse } from '../src/types/vercel';
import { getCacheMode, SCHEMA_VERSION } from '../server/cache';
import { resolveServModel } from '../server/providers/serv-model';
import { validateEnvStartup } from '../server/validation/request-schemas';

export interface HealthResponse {
  status: 'ok';
  cacheMode: 'kv' | 'memory';
  servConfigured: boolean;
  servModel: string;
  dolphinConfigured: boolean;
  dolphinModel: string;
  schemaVersion: string;
  buildSha: string;
  envValid: boolean;
  isAiPaused: boolean;
}

export function getHealthData(): HealthResponse {
  const servKey = process.env.SERV_API_KEY;
  const dolphinKey = process.env.DOLPHIN_API_KEY;
  let servModel = 'serv-swift';
  let envValid = true;
  let isAiPaused = process.env.AI_PAUSED === 'true';

  try {
    const startup = validateEnvStartup();
    servModel = startup.servModel;
    isAiPaused = startup.isAiPaused;
  } catch {
    envValid = false;
    try {
      servModel = resolveServModel();
    } catch {
      servModel = 'serv-swift (unresolved)';
    }
  }

  const dolphinModel = process.env.DOLPHIN_MODEL || 'deepseek-ai/DeepSeek-V4.1-Flash';
  const buildSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.BUILD_SHA ||
    'local';

  return {
    status: 'ok',
    cacheMode: getCacheMode(),
    servConfigured: Boolean(servKey && servKey.trim().length > 0),
    servModel,
    dolphinConfigured: Boolean(dolphinKey && dolphinKey.trim().length > 0),
    dolphinModel,
    schemaVersion: SCHEMA_VERSION,
    buildSha,
    envValid,
    isAiPaused,
  };
}

export default async function handler(req: VercelRequest | Request, res?: VercelResponse) {
  const isWebStandard = typeof Request !== 'undefined' && req instanceof Request;
  const data = getHealthData();

  if (isWebStandard) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  res!.setHeader('Cache-Control', 'no-store, max-age=0');
  return res!.status(200).json(data);
}

export const GET = handler;

