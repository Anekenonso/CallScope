import { describe, it, expect } from 'vitest';
import handler, { POST, GET } from '../../api/_analyse';
import type { VercelRequest, VercelResponse } from '../../src/types/vercel';

function createMockReqRes(method: string, body: unknown) {
  let statusCode = 200;
  let jsonBody: unknown = null;
  const headers: Record<string, string | string[]> = {};

  const req = {
    method,
    body,
  } as unknown as VercelRequest;

  const res = {
    setHeader(name: string, value: string | string[]) {
      headers[name] = value;
      return res;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: unknown) {
      jsonBody = data;
      return res;
    },
  } as unknown as VercelResponse;

  return {
    req,
    res,
    getStatus: () => statusCode,
    getBody: () => jsonBody,
    getHeaders: () => headers,
  };
}

describe('api/analyse handler', () => {
  it('rejects non-POST methods', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('GET', null);
    await handler(req, res);
    expect(getStatus()).toBe(405);
    expect(getBody()).toHaveProperty('error', 'Method Not Allowed');
  });

  it('rejects invalid network', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      network: 'optimism',
      governorAddress: '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
      proposalId: '1',
    });
    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getBody()).toHaveProperty('error', 'Invalid network');
  });

  it('rejects invalid governor address', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      network: 'ethereum',
      governorAddress: '0x123',
      proposalId: '1',
    });
    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getBody()).toHaveProperty('error', 'Invalid Governor address');
  });

  it('rejects non-numeric proposalId', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      network: 'ethereum',
      governorAddress: '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
      proposalId: 'abc',
    });
    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getBody()).toHaveProperty('error', 'Invalid proposal ID');
  });

  it('accepts valid input and returns typed response', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      network: 'ethereum',
      governorAddress: '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
      proposalId: '77767899528494238518019756391533686963875234067646094287125791110488147463806',
    });
    await handler(req, res);
    expect(getStatus()).toBe(200);
    const body = getBody() as Record<string, unknown>;
    expect(body).toHaveProperty('assessment', 'review_recommended');
    expect(body).toHaveProperty('network', 'ethereum');
    expect(body).toHaveProperty('governorAddress', '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3');
    expect(body).toHaveProperty('actions');
  }, 60_000);

  it('handles Web Standard Request via default handler', async () => {
    const webReq = new Request('https://callscope-five.vercel.app/api/analyse', {
      method: 'GET',
    });
    const webRes = (await handler(webReq)) as Response;
    expect(webRes.status).toBe(405);
    const body = await webRes.json();
    expect(body).toHaveProperty('error', 'Method Not Allowed');
  });

  it('handles Web Standard POST export with invalid input', async () => {
    const webReq = new Request('https://callscope-five.vercel.app/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        network: 'invalid-network',
        governorAddress: '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
        proposalId: '1',
      }),
    });
    const webRes = await POST(webReq);
    expect(webRes.status).toBe(400);
    const body = await webRes.json();
    expect(body).toHaveProperty('error', 'Invalid network');
  });
});

