import { describe, it, expect } from 'vitest';
import handler from '../../api/analyse';
import type { VercelRequest, VercelResponse } from '../../src/types/vercel';
import type { AnalysisResponse } from '../../src/types/analysis';

function createMockReqRes(body: unknown) {
  let statusCode = 200;
  let jsonBody: any = null;
  const headers: Record<string, string | string[]> = {};

  const req = {
    method: 'POST',
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
    getBody: () => jsonBody as AnalysisResponse,
  };
}

describe('Task 1: Pinned snapshots, Re-verify live, and Tx Hash inputs', () => {
  it('ENS Ethereum fixture succeeds via pinned snapshot', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes({
      network: 'ethereum',
      governorAddress: '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
      proposalId: '77767899528494238518019756391533686963875234067646094287125791110488147463806',
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);
    const body = getBody();
    expect(body.network).toBe('ethereum');
    expect(body.proposal.eventSource).toContain('pinned snapshot');
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].functionName).toBe('grantRole');
  });

  it('Unlock Base fixture succeeds via pinned snapshot', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes({
      network: 'base',
      governorAddress: '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9',
      proposalId: '27419154582993156392805749742953507877176483681373228046916881327937839104508',
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);
    const body = getBody();
    expect(body.network).toBe('base');
    expect(body.proposal.eventSource).toContain('pinned snapshot');
    expect(body.actions).toHaveLength(6);
  });

  it('txHashOrUrl input analyzes proposal without manual governor or proposalId input', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes({
      txHashOrUrl: 'https://etherscan.io/tx/0x76eefae46df65ef44d7bf95f4a0fd7cc7f0628fd684cc0074d59f1173cddef90',
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);
    const body = getBody();
    expect(body.network).toBe('ethereum');
    expect(body.proposal.eventSource).toContain('live tx receipt');
    expect(body.governorAddress.toLowerCase()).toBe('0x323a76393544d5ecca80cd6ef2a560c6a395b7e3');
    expect(body.actions).toHaveLength(1);
  });

  it('re-verify live toggle executes live lookup and reports either success or stage-tagged error', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes({
      network: 'ethereum',
      governorAddress: '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
      proposalId: '77767899528494238518019756391533686963875234067646094287125791110488147463806',
      reverifyLive: true,
    });

    await handler(req, res);
    const status = getStatus();
    const body = getBody() as any;
    if (status === 200) {
      expect(body.proposal.eventSource).toContain('live RPC');
    } else {
      expect(status).toBe(500);
      expect(body.stageTagged).toBeDefined();
      expect(body.stageTagged.stage).toBe('event_lookup');
    }
  });
});

