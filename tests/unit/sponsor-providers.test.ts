import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reviewWithServ, SERV_ENDPOINT } from '../../server/providers/serv';
import { reviewWithDolphin, DOLPHIN_ENDPOINT } from '../../server/providers/dolphin';
import {
  callOpenAiCompatible,
  extractStructuredJson,
} from '../../server/providers/openai-compatible';
import type { ProposalAction, Finding } from '../../src/types/analysis';

describe('callOpenAiCompatible helper', () => {
  it('throws error when apiKey is missing', async () => {
    await expect(
      callOpenAiCompatible({
        endpoint: SERV_ENDPOINT,
        apiKey: '',
        model: 'test-model',
        systemPrompt: 'System',
        userPrompt: 'User',
      })
    ).rejects.toThrow('API key is not configured');
  });

  it('sends correct headers and body format', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Test response' } }],
      }),
    } as any);

    const result = await callOpenAiCompatible({
      endpoint: DOLPHIN_ENDPOINT,
      apiKey: 'test-key',
      model: 'test-model',
      systemPrompt: 'System',
      userPrompt: 'User',
    });

    expect(result).toBe('Test response');
    expect(fetchSpy).toHaveBeenCalledWith(
      DOLPHIN_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });
});

describe('extractStructuredJson', () => {
  it('parses direct JSON strings', () => {
    const raw = '{"summary": "All actions match.", "findings": ["Finding 1"]}';
    const parsed = extractStructuredJson<{ summary: string; findings: string[] }>(raw);
    expect(parsed.summary).toBe('All actions match.');
    expect(parsed.findings).toHaveLength(1);
  });

  it('strips markdown ```json ... ``` code fences', () => {
    const raw = '```json\n{"summary": "Markdown wrapped.", "findings": []}\n```';
    const parsed = extractStructuredJson<{ summary: string; findings: string[] }>(raw);
    expect(parsed.summary).toBe('Markdown wrapped.');
  });

  it('throws descriptive error on malformed JSON', () => {
    const raw = 'This is not JSON at all';
    expect(() => extractStructuredJson(raw)).toThrow(/Failed to parse structured JSON/);
  });
});

describe('OpenServ SERV provider adapter', () => {
  const dummyActions: ProposalAction[] = [
    {
      index: 0,
      target: '0x1111111111111111111111111111111111111111',
      value: '0',
      signature: 'grantRole(bytes32,address)',
      selector: '0x2f2ff15d',
      decoded: true,
      functionName: 'grantRole',
      rawCalldata: '0x2f2ff15d...',
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

  it('returns not_configured when SERV_API_KEY is missing', async () => {
    delete process.env.SERV_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await reviewWithServ('Test description', dummyActions);
    expect(result.status).toBe('not_configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handles successful SERV chat completion', async () => {
    process.env.SERV_API_KEY = 'test-serv-key';

    const mockResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              summary: 'SERV: Actions match proposal claims.',
              findings: ['Verified permission grant to multisig.'],
            }),
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as any);

    const result = await reviewWithServ('Test description', dummyActions);
    expect(result.status).toBe('available');
    expect(result.summary).toBe('SERV: Actions match proposal claims.');
    expect(result.findings).toContain('Verified permission grant to multisig.');
  });

  it('handles 401 Unauthorized from SERV', async () => {
    process.env.SERV_API_KEY = 'invalid-serv-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    } as any);

    const result = await reviewWithServ('Test description', dummyActions);
    expect(result.status).toBe('error');
    expect(result.error).toContain('401');
  });

  it('handles 402 Payment Required / Out of Credits from SERV', async () => {
    process.env.SERV_API_KEY = 'valid-key-no-credits';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 402,
      json: async () => ({ error: { message: 'Insufficient balance' } }),
    } as any);

    const result = await reviewWithServ('Test description', dummyActions);
    expect(result.status).toBe('error');
    expect(result.error).toContain('402');
  });

  it('handles 429 Rate Limit from SERV', async () => {
    process.env.SERV_API_KEY = 'rate-limited-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    } as any);

    const result = await reviewWithServ('Test description', dummyActions);
    expect(result.status).toBe('error');
    expect(result.error).toContain('429');
  });

  it('handles 500 / 503 Provider Server Error', async () => {
    process.env.SERV_API_KEY = 'server-error-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'Service Unavailable' } }),
    } as any);

    const result = await reviewWithServ('Test description', dummyActions);
    expect(result.status).toBe('error');
    expect(result.error).toContain('503');
  });

  it('handles malformed JSON output from model', async () => {
    process.env.SERV_API_KEY = 'test-serv-key';

    const mockResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'I cannot provide JSON right now, sorry.',
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as any);

    const result = await reviewWithServ('Test description', dummyActions);
    expect(result.status).toBe('error');
    expect(result.error).toContain('Failed to parse structured JSON');
  });
});

describe('Dolphin provider adapter', () => {
  const dummyActions: ProposalAction[] = [
    {
      index: 0,
      target: '0x1111111111111111111111111111111111111111',
      value: '0',
      signature: 'transfer(address,uint256)',
      selector: '0xa9059cbb',
      decoded: true,
      functionName: 'transfer',
      rawCalldata: '0xa9059cbb...',
    },
  ];

  const dummyFindings: Finding[] = [];

  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns not_configured when DOLPHIN_API_KEY is missing', async () => {
    delete process.env.DOLPHIN_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await reviewWithDolphin('Test description', dummyActions, dummyFindings);
    expect(result.status).toBe('not_configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handles successful Dolphin chat completion', async () => {
    process.env.DOLPHIN_API_KEY = 'test-dolphin-key';

    const mockResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              summary: 'Dolphin: No secondary governance risks identified.',
              findings: ['Standard transfer within expected operational parameters.'],
            }),
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as any);

    const result = await reviewWithDolphin('Test description', dummyActions, dummyFindings);
    expect(result.status).toBe('available');
    expect(result.summary).toContain('No secondary governance risks identified');
    expect(result.findings).toHaveLength(1);
  });

  it('handles 401 Unauthorized from Dolphin', async () => {
    process.env.DOLPHIN_API_KEY = 'invalid-dolphin-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid credentials' } }),
    } as any);

    const result = await reviewWithDolphin('Test description', dummyActions, dummyFindings);
    expect(result.status).toBe('error');
    expect(result.error).toContain('401');
  });

  it('handles timeout gracefully', async () => {
    process.env.DOLPHIN_API_KEY = 'test-key';

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    );

    const result = await reviewWithDolphin('Test description', dummyActions, dummyFindings);
    expect(result.status).toBe('error');
    expect(result.error).toContain('timed out');
  });
});
