import servCatalog from '../../eval/serv-model-catalog.json';

export const VALID_SERV_MODELS = [
  'serv-swift',
  'serv-standard',
  'serv-pro',
  'serv-ultra',
] as const;

export type ValidServModel = (typeof VALID_SERV_MODELS)[number];

export interface ServModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  rawInput: number;
  rawOutput: number;
}

export interface ServModelMetadata {
  modelId: ValidServModel;
  displayName: string;
  contextWindow: string;
  maxOutput: string;
  pricing: ServModelPricing;
}

/**
 * Validate that all supported models exist in the saved catalog
 */
const catalogModelMap = new Map<string, (typeof servCatalog.items)[number]>();
for (const item of servCatalog.items) {
  catalogModelMap.set(item.modelId.toLowerCase(), item);
}

/**
 * Resolves the configured OpenServ SERV model from SERV_MODEL env var.
 * Validates against eval/serv-model-catalog.json.
 * Throws at startup on unknown model IDs.
 */
export function resolveServModel(envModel?: string): ValidServModel {
  const modelToResolve = (envModel || process.env.SERV_MODEL || 'serv-swift').trim().toLowerCase();

  if (!VALID_SERV_MODELS.includes(modelToResolve as ValidServModel)) {
    throw new Error(
      `Invalid SERV_MODEL "${modelToResolve}". Must be one of: ${VALID_SERV_MODELS.join(
        ', '
      )}. Validated against eval/serv-model-catalog.json (fetched ${servCatalog.fetchedAt}).`
    );
  }

  const catalogEntry = catalogModelMap.get(modelToResolve);
  if (!catalogEntry) {
    throw new Error(
      `SERV_MODEL "${modelToResolve}" not found in OpenServ model catalog (eval/serv-model-catalog.json).`
    );
  }

  return modelToResolve as ValidServModel;
}

/**
 * Get pricing and specs for a valid SERV model
 */
export function getServModelMetadata(model: ValidServModel): ServModelMetadata {
  const catalogEntry = catalogModelMap.get(model);
  const rawInput = catalogEntry?.pricing?.input ?? 125;
  const rawOutput = catalogEntry?.pricing?.output ?? 650;

  // Raw catalog units: 125 represents $0.125 / 1M tokens ($0.000000125/token)
  // or $1.25/1M tokens ($0.00000125/token)
  return {
    modelId: model,
    displayName: catalogEntry?.displayName || model,
    contextWindow: catalogEntry?.specs?.contextWindow || '200K',
    maxOutput: catalogEntry?.specs?.maxOutput || '8K',
    pricing: {
      rawInput,
      rawOutput,
      inputPerMillion: rawInput / 1000,
      outputPerMillion: rawOutput / 1000,
    },
  };
}
