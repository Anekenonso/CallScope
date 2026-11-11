export interface OpenAiCompatibleOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  responseFormat?: { type: string; [key: string]: unknown };
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
    const requestBody: Record<string, unknown> = {
      model: model || 'serv-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: maxTokens,
      temperature,
    };
    if (options.responseFormat) {
      requestBody.response_format = options.responseFormat;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
        'User-Agent': 'Callscope/1.0 (DAO Proposal Analysis Tool)',
      },
      body: JSON.stringify(requestBody),
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

      if (res.status === 401 || res.status === 403) {
        throw new Error(`Authentication failed or access denied (${res.status}): ${errMsg}`);
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
    const message = data?.choices?.[0]?.message;
    let content = message?.content;

    // Handle reasoning models (e.g. DeepSeek) where JSON might be present in reasoning output
    if ((typeof content !== 'string' || content.trim().length === 0) && message) {
      const rawMsg = message as Record<string, unknown>;
      const reasoning = rawMsg.reasoning || rawMsg.reasoning_content;
      if (typeof reasoning === 'string' && reasoning.trim().length > 0) {
        const jsonMatch = reasoning.match(/\{[\s\S]*"summary"[\s\S]*\}/);
        if (jsonMatch) {
          content = jsonMatch[0];
        }
      }
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
      if (data?.choices?.[0]?.finish_reason === 'length') {
        throw new Error('Provider exhausted token limit during reasoning without generating content');
      }
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

/**
 * Classify provider errors into exact typed states with retryability indications
 */
export function classifyProviderError(err: unknown): {
  status: 'not_configured' | 'rate_limited' | 'timed_out' | 'auth_error' | 'guard_blocked' | 'schema_invalid' | 'upstream_error';
  errorClass: 'not_configured' | 'rate_limited' | 'timed_out' | 'auth_error' | 'guard_blocked' | 'schema_invalid' | 'upstream_error';
  reason: string;
  retryable: boolean;
} {
  const message = err instanceof Error ? err.message : String(err || 'Unknown error');
  const lower = message.toLowerCase();

  if (
    lower.includes('not configured') ||
    lower.includes('api key is not configured') ||
    lower.includes('api key is missing')
  ) {
    return {
      status: 'not_configured',
      errorClass: 'not_configured',
      reason: 'API key is not configured in server environment.',
      retryable: false,
    };
  }

  if (
    lower.includes('401') ||
    lower.includes('402') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('access denied') ||
    lower.includes('authentication failed') ||
    lower.includes('payment required') ||
    lower.includes('insufficient credits')
  ) {
    return {
      status: 'auth_error',
      errorClass: 'auth_error',
      reason: 'Authentication failed or insufficient credits (HTTP 401/402/403).',
      retryable: false,
    };
  }

  if (lower.includes('429') || lower.includes('rate limit')) {
    return {
      status: 'rate_limited',
      errorClass: 'rate_limited',
      reason: 'Provider API rate limit reached (HTTP 429). Retry after cooldown.',
      retryable: true,
    };
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted') ||
    lower.includes('aborterror')
  ) {
    return {
      status: 'timed_out',
      errorClass: 'timed_out',
      reason: 'Provider request timed out before receiving completion.',
      retryable: true,
    };
  }

  if (
    lower.includes('prompt_guard') ||
    lower.includes('guard_blocked') ||
    lower.includes('safety guard') ||
    lower.includes('injection attempt')
  ) {
    return {
      status: 'guard_blocked',
      errorClass: 'guard_blocked',
      reason: 'Proposal text triggered provider prompt injection safety guard.',
      retryable: false,
    };
  }

  if (lower.includes('schema') || lower.includes('json parse') || lower.includes('unexpected token') || lower.includes('failed to parse structured json')) {
    return {
      status: 'schema_invalid',
      errorClass: 'schema_invalid',
      reason: 'Provider returned output that did not match the expected JSON schema.',
      retryable: false,
    };
  }

  return {
    status: 'upstream_error',
    errorClass: 'upstream_error',
    reason: `Provider server or network error: ${message}`,
    retryable: true,
  };
}

