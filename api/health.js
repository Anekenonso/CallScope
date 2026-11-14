const SCHEMA_VERSION = "v2";
function getCacheMode() {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(kvUrl && kvToken) ? "kv" : "memory";
}
const fetchedAt = "2026-11-14T05:08:10.412Z";
const items = [
  {
    modelId: "claude-fable-5",
    displayName: "Claude Fable 5",
    provider: "anthropic",
    pricing: {
      input: 1300,
      output: 6500,
      cachedInput: 130,
      cacheWrite5mInput: 1500,
      cacheWrite1hInput: 2400
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: false
    },
    modality: [
      "text"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-fable-5-1",
    displayName: "Claude Fable 5.1",
    provider: "anthropic",
    pricing: {
      input: 1200,
      output: 6e3,
      cachedInput: 30,
      cacheWrite5mInput: 1500,
      cacheWrite1hInput: 2400
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-fable-5-2",
    displayName: "Claude Fable 5.2",
    provider: "anthropic",
    pricing: {
      input: 1e3,
      output: 5e3,
      cachedInput: 25,
      cacheWrite5mInput: 1250,
      cacheWrite1hInput: 2e3
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-haiku-4.5",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    pricing: {
      input: 125,
      output: 650,
      cachedInput: 13,
      cacheWrite5mInput: 150,
      cacheWrite1hInput: 240
    },
    specs: {
      contextWindow: "200K",
      maxOutput: "8K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-opus-4.6",
    displayName: "Claude Opus 4.6",
    provider: "anthropic",
    pricing: {
      input: 650,
      output: 3250,
      cachedInput: 65,
      cacheWrite5mInput: 750,
      cacheWrite1hInput: 1200
    },
    specs: {
      contextWindow: "200K",
      maxOutput: "32K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-opus-4.7",
    displayName: "Claude Opus 4.7",
    provider: "anthropic",
    pricing: {
      input: 650,
      output: 3250,
      cachedInput: 65,
      cacheWrite5mInput: 750,
      cacheWrite1hInput: 1200
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-opus-4.8",
    displayName: "Claude Opus 4.8",
    provider: "anthropic",
    pricing: {
      input: 650,
      output: 3250,
      cachedInput: 65,
      cacheWrite5mInput: 750,
      cacheWrite1hInput: 1200
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-opus-5",
    displayName: "Claude Opus 5",
    provider: "anthropic",
    pricing: {
      input: 600,
      output: 3e3,
      cachedInput: 60,
      cacheWrite5mInput: 750,
      cacheWrite1hInput: 1200
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-opus-5.5",
    displayName: "Claude Opus 5.5",
    provider: "anthropic",
    pricing: {
      input: 480,
      output: 2400,
      cachedInput: 24,
      cacheWrite5mInput: 600,
      cacheWrite1hInput: 960
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-sonnet-4.6",
    displayName: "Claude Sonnet 4.6",
    provider: "anthropic",
    pricing: {
      input: 400,
      output: 2e3,
      cachedInput: 40,
      cacheWrite5mInput: 450,
      cacheWrite1hInput: 720
    },
    specs: {
      contextWindow: "200K",
      maxOutput: "16K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-sonnet-5",
    displayName: "Claude Sonnet 5",
    provider: "anthropic",
    pricing: {
      input: 260,
      output: 1300,
      cachedInput: 26,
      cacheWrite5mInput: 300,
      cacheWrite1hInput: 480
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "64K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "claude-sonnet-5.5",
    displayName: "Claude Sonnet 5.5",
    provider: "anthropic",
    pricing: {
      input: 240,
      output: 1200,
      cachedInput: 24,
      cacheWrite5mInput: 300,
      cacheWrite1hInput: 480
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "google",
    pricing: {
      input: 40,
      output: 350,
      cachedInput: 4
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "64K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "audio",
      "file",
      "video"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "gemini-3-flash-preview",
    displayName: "Gemini 3 Flash Preview",
    provider: "google",
    pricing: {
      input: 60,
      output: 400,
      cachedInput: 6
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "64K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file",
      "audio",
      "video"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "gemini-3.1-flash-lite",
    displayName: "Gemini 3.1 Flash Lite",
    provider: "google",
    pricing: {
      input: 30,
      output: 180,
      cachedInput: 3
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "64K",
      reasoning: false
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro Preview",
    provider: "google",
    pricing: {
      input: 250,
      output: 1600,
      cachedInput: 25
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "64K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file",
      "audio",
      "video"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    provider: "google",
    pricing: {
      input: 195,
      output: 1200,
      cachedInput: 20
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "64K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file",
      "audio",
      "video"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "gemini-3.5-flash-lite",
    displayName: "Gemini 3.5 Flash Lite",
    provider: "google",
    pricing: {
      input: 40,
      output: 300,
      cachedInput: 4
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "64K",
      reasoning: false
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "gemini-3.6-flash",
    displayName: "Gemini 3.6 Flash",
    provider: "google",
    pricing: {
      input: 100,
      output: 450,
      cachedInput: 10
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "64K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "gemini-3.7-flash",
    displayName: "Gemini 3.7 Flash",
    provider: "google",
    pricing: {
      input: 100,
      output: 450,
      cachedInput: 10
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "64K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "gemini-3.8-flash",
    displayName: "Gemini 3.8 Flash",
    provider: "google",
    pricing: {
      input: 100,
      output: 450,
      cachedInput: 10
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "64K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "gpt-6-astra",
    displayName: "GPT 6 Astra",
    provider: "openai",
    pricing: {
      input: 1200,
      output: 6e3,
      cachedInput: 120
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "gpt-5.4",
    displayName: "GPT-5.4",
    provider: "openai",
    pricing: {
      input: 325,
      output: 2e3,
      cachedInput: 33
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "gpt-5.4-mini",
    displayName: "GPT-5.4 Mini",
    provider: "openai",
    pricing: {
      input: 100,
      output: 600,
      cachedInput: 10
    },
    specs: {
      contextWindow: "400K",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "gpt-5.4-nano",
    displayName: "GPT-5.4 Nano",
    provider: "openai",
    pricing: {
      input: 25,
      output: 160,
      cachedInput: 3
    },
    specs: {
      contextWindow: "128K",
      maxOutput: "16K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "gpt-5.5",
    displayName: "GPT-5.5",
    provider: "openai",
    pricing: {
      input: 650,
      output: 3900,
      cachedInput: 65
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "gpt-5.6-luna",
    displayName: "GPT-5.6 Luna",
    provider: "openai",
    pricing: {
      input: 25,
      output: 150,
      cachedInput: 3
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: false
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    provider: "openai",
    pricing: {
      input: 525,
      output: 2500,
      cachedInput: 50
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: false
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "gpt-5.6-terra",
    displayName: "GPT-5.6 Terra",
    provider: "openai",
    pricing: {
      input: 250,
      output: 1500,
      cachedInput: 25
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: false
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "gpt-6-luna",
    displayName: "GPT-6-Luna",
    provider: "openai",
    pricing: {
      input: 13,
      output: 65,
      cachedInput: 2
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "gpt-6-sol",
    displayName: "GPT-6-Sol",
    provider: "openai",
    pricing: {
      input: 260,
      output: 1300,
      cachedInput: 25
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "gpt-6.1-sol",
    displayName: "GPT-6.1 Sol",
    provider: "openai",
    pricing: {
      input: 240,
      output: 1200,
      cachedInput: 12
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "128K",
      reasoning: true
    },
    modality: [
      "text",
      "image"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "serv-mini",
    displayName: "serv-mini",
    provider: "serv",
    pricing: {
      input: 100,
      output: 600
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "16K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "serv-nano",
    displayName: "serv-nano",
    provider: "serv",
    pricing: {
      input: 25,
      output: 175
    },
    specs: {
      contextWindow: "128K",
      maxOutput: "16K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "serv-pro",
    displayName: "serv-pro",
    provider: "serv",
    pricing: {
      input: 450,
      output: 2500
    },
    specs: {
      contextWindow: "1M",
      maxOutput: "100K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "responses"
    ]
  },
  {
    modelId: "serv-standard",
    displayName: "serv-standard",
    provider: "serv",
    pricing: {
      input: 375,
      output: 2e3,
      cacheWrite5mInput: 450,
      cacheWrite1hInput: 720
    },
    specs: {
      contextWindow: "200K",
      maxOutput: "16K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "serv-swift",
    displayName: "serv-swift",
    provider: "serv",
    pricing: {
      input: 125,
      output: 650
    },
    specs: {
      contextWindow: "200K",
      maxOutput: "8K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  },
  {
    modelId: "serv-ultra",
    displayName: "serv-ultra",
    provider: "serv",
    pricing: {
      input: 650,
      output: 3250
    },
    specs: {
      contextWindow: "200K",
      maxOutput: "32K",
      reasoning: true
    },
    modality: [
      "text",
      "image",
      "file"
    ],
    endpoints: [
      "chatCompletions",
      "messages"
    ]
  }
];
const servCatalog = {
  fetchedAt,
  items
};
const VALID_SERV_MODELS = [
  "serv-swift",
  "serv-standard",
  "serv-pro",
  "serv-ultra"
];
const catalogModelMap = /* @__PURE__ */ new Map();
for (const item of servCatalog.items) {
  catalogModelMap.set(item.modelId.toLowerCase(), item);
}
function resolveServModel(envModel) {
  const modelToResolve = (envModel || process.env.SERV_MODEL || "serv-swift").trim().toLowerCase();
  if (!VALID_SERV_MODELS.includes(modelToResolve)) {
    throw new Error(
      `Invalid SERV_MODEL "${modelToResolve}". Must be one of: ${VALID_SERV_MODELS.join(
        ", "
      )}. Validated against eval/serv-model-catalog.json (fetched ${servCatalog.fetchedAt}).`
    );
  }
  const catalogEntry = catalogModelMap.get(modelToResolve);
  if (!catalogEntry) {
    throw new Error(
      `SERV_MODEL "${modelToResolve}" not found in OpenServ model catalog (eval/serv-model-catalog.json).`
    );
  }
  return modelToResolve;
}
function getHealthData() {
  const servKey = process.env.SERV_API_KEY;
  const dolphinKey = process.env.DOLPHIN_API_KEY;
  let servModel = "serv-swift";
  try {
    servModel = resolveServModel();
  } catch {
    servModel = "serv-swift (unresolved)";
  }
  const dolphinModel = process.env.DOLPHIN_MODEL || "deepseek-ai/DeepSeek-V4.1-Flash";
  const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.BUILD_SHA || "local";
  return {
    status: "ok",
    cacheMode: getCacheMode(),
    servConfigured: Boolean(servKey && servKey.trim().length > 0),
    servModel,
    dolphinConfigured: Boolean(dolphinKey && dolphinKey.trim().length > 0),
    dolphinModel,
    schemaVersion: SCHEMA_VERSION,
    buildSha
  };
}
async function handler(req, res) {
  const isWebStandard = typeof Request !== "undefined" && req instanceof Request;
  const data = getHealthData();
  if (isWebStandard) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0"
      }
    });
  }
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json(data);
}
const GET = handler;
export {
  GET,
  handler as default,
  getHealthData
};
