import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeWithRetry } from '../../api/_review';
import { reviewWithServ } from '../../server/providers/serv';
import { reviewWithDolphin } from '../../server/providers/dolphin';
import type { ProposalAction, Finding } from '../../src/types/analysis';

describe('Task 4: Classified Provider Retries with Backoff', () => {
  const originalFetch = global.fetch;
  const originalServKey = process.env.SERV_API_KEY;
  const originalDolphinKey = process.env.DOLPHIN_API_KEY;

  const mockAction: ProposalAction = {
    index: 0,
    target: '0x1111111111111111111111111111111111111111',
    value: '0',
    signature: 'transfer(address,uint256)',
    selector: '0xa9059cbb',
    decoded: true,
    functionName: 'transfer',
    rawCalldata: '0x',
  };

  const mockFinding: Finding = {
    id: 'FINDING-1',
    title: 'Privileged transfer',
    description: 'Transfers funds',
    severity: 'medium',
    verified: true,
    whyItMatters: 'Security implications',
  };

  beforeEach(() => {
    process.env.SERV_API_KEY = 'test-serv-key';
    process.env.DOLPHIN_API_KEY = 'test-dolphin-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalServKey) process.env.SERV_API_KEY = originalServKey;
    else delete process.env.SERV_API_KEY;
    if (originalDolphinKey) process.env.DOLPHIN_API_KEY = originalDolphinKey;
    else delete process.env.DOLPHIN_API_KEY;
  });

  it('retries once on rate limit (HTTP 429) then succeeds on second attempt (attempts: 2)', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'OpenServ review completed successfully.',
                  items: [{ kind: 'supported', issue: 'Valid transfer' }],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await executeWithRetry(() => reviewWithServ('test desc', [mockAction]), 'OpenServ SERV');

    expect(callCount).toBe(2);
    expect(result.status).toBe('ok');
    expect(result.attempts).toBe(2);
    expect(result.summary).toContain('OpenServ review completed');
  });

  it('never retries on authentication error (HTTP 401) and returns immediately with attempts: 1', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await executeWithRetry(() => reviewWithServ('test desc', [mockAction]), 'OpenServ SERV');

    expect(callCount).toBe(1);
    expect(result.status).toBe('auth_error');
    expect(result.errorClass).toBe('auth_error');
    expect(result.retryable).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it('never retries on access denied (HTTP 403) and returns attempts: 1', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify({ error: { message: 'Forbidden' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await executeWithRetry(() => reviewWithDolphin('test desc', [mockAction], [mockFinding]), 'Dolphin');

    expect(callCount).toBe(1);
    expect(result.status).toBe('auth_error');
    expect(result.retryable).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it('retries once on upstream server error (HTTP 500) and returns typed failure after 2 attempts', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify({ error: { message: 'Internal server error' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await executeWithRetry(() => reviewWithServ('test desc', [mockAction]), 'OpenServ SERV');

    expect(callCount).toBe(2);
    expect(result.status).toBe('upstream_error');
    expect(result.errorClass).toBe('upstream_error');
    expect(result.attempts).toBe(2);
    expect(result.reason).toContain('Provider server error (500)');
  });

  it('retries once on network timeout and records timed_out after 2 attempts', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    });

    const result = await executeWithRetry(() => reviewWithDolphin('test desc', [mockAction], [mockFinding]), 'Dolphin');

    expect(callCount).toBe(2);
    expect(result.status).toBe('timed_out');
    expect(result.errorClass).toBe('timed_out');
    expect(result.attempts).toBe(2);
  });

  it('never retries on invalid JSON schema and records schema_invalid with attempts: 1', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'This is plain text without any JSON structure at all.',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await executeWithRetry(() => reviewWithServ('test desc', [mockAction]), 'OpenServ SERV');

    expect(callCount).toBe(1);
    expect(result.status).toBe('schema_invalid');
    expect(result.errorClass).toBe('schema_invalid');
    expect(result.retryable).toBe(false);
    expect(result.attempts).toBe(1);
  });
});

