export interface OpenAiCompatibleOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface OpenAiCompletionResponse {
  id?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
}

/**
 * Execute a bounded, timeout-enforced request to an OpenAI-compatible completion endpoint
 */
export async function callOpenAiCompatible(
  options: OpenAiCompatibleOptions
): Promise<string> {
  const {
    endpoint,
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    maxTokens = 800,
    temperature = 0.1,
    timeoutMs = 15_000,
  } = options;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('API key is not configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
        'User-Agent': 'Callscope/1.0 (DAO Proposal Analysis Tool)',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errorJson = (await res.json()) as OpenAiCompletionResponse;
        if (errorJson?.error?.message) {
          errMsg = `${errMsg}: ${errorJson.error.message}`;
        }
      } catch {
        // ignore json parse error on error response
      }

      if (res.status === 401) {
        throw new Error(`Authentication failed (401): ${errMsg}`);
      }
      if (res.status === 402) {
        throw new Error(`Payment required / insufficient credits (402): ${errMsg}`);
      }
      if (res.status === 429) {
        throw new Error(`Rate limit exceeded (429): ${errMsg}`);
      }
      if (res.status >= 500) {
        throw new Error(`Provider server error (${res.status}): ${errMsg}`);
      }
      throw new Error(`Provider request failed (${res.status}): ${errMsg}`);
    }

    const data = (await res.json()) as OpenAiCompletionResponse;
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Provider returned empty content response');
    }

    return content.trim();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract and parse JSON from a model's text output, stripping markdown code blocks if present
 */
export function extractStructuredJson<T>(rawContent: string): T {
  let cleaned = rawContent.trim();

  // Strip markdown code fences if wrapped (e.g. ```json ... ```)
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(jsonBlockRegex);
  if (match && match[1]) {
    cleaned = match[1].trim();
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Failed to parse structured JSON output from provider response: ${rawContent.slice(0, 100)}...`);
  }
}

