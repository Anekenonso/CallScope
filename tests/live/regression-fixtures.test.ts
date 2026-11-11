import { describe, it, expect } from 'vitest';
import handler from '../../api/analyse';
import type { VercelRequest, VercelResponse } from '../../src/types/vercel';
import type { AnalysisResponse } from '../../src/types/analysis';

function createMockReqRes(body: unknown) {
  let statusCode = 200;
  let jsonBody: unknown = null;
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

describe('Regression Fixtures: Live On-Chain End-to-End Analysis', () => {
  it('analyzes ENS Ethereum proposal with grantRole, identifying PROPOSER_ROLE and yielding review_recommended', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes({
      network: 'ethereum',
      governorAddress: '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
      proposalId: '77767899528494238518019756391533686963875234067646094287125791110488147463806',
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);

    const body = getBody();
    expect(body.network).toBe('ethereum');
    expect(body.assessment).toBe('review_recommended');
    expect(body.proposal.id).toBe('77767899528494238518019756391533686963875234067646094287125791110488147463806');
    expect(body.proposal.description).toContain('Security Council');

    // Executable actions
    expect(body.actions).toHaveLength(1);
    const action = body.actions[0]!;
    expect(action.decoded).toBe(true);
    expect(action.functionName).toBe('grantRole');
    expect(action.selector).toBe('0x2f2ff15d');

    // Findings
    expect(body.findings.length).toBeGreaterThanOrEqual(1);
    const roleFinding = body.findings.find((f) => f.id.startsWith('SENSITIVE_GRANT_ROLE'));
    expect(roleFinding).toBeDefined();
    expect(roleFinding?.severity).toBe('high');
    expect(roleFinding?.title).toContain('PROPOSER_ROLE');
    expect(roleFinding?.description.toLowerCase()).toContain('0x2acbf518b3759f6e1fa163294eda55bf1d0ae051');
    expect(roleFinding?.verified).toBe(true);

    // Consistency
    expect(body.descriptionConsistency.status).toBe('consistent');

    // Evidence links
    expect(body.evidence.length).toBeGreaterThanOrEqual(2);
  }, 45_000);

  it('analyzes Unlock Base proposal with six ERC-20 transfers preserving order and argument values', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes({
      network: 'base',
      governorAddress: '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9',
      proposalId: '27419154582993156392805749742953507877176483681373228046916881327937839104508',
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);

    const body = getBody();
    expect(body.network).toBe('base');
    expect(body.actions).toHaveLength(6);

    for (let i = 0; i < 6; i++) {
      const act = body.actions[i]!;
      expect(act.index).toBe(i);
      expect(act.decoded).toBe(true);
      expect(act.functionName).toBe('transfer');
      expect(act.selector).toBe('0xa9059cbb');
      expect(act.args).toHaveLength(2);
      expect(act.args?.[0]?.value).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(BigInt(act.args?.[1]?.value || '0')).toBeGreaterThan(0n);
    }

    // First action transfers 400 USDC (400000000)
    expect(body.actions[0]?.args?.[1]?.value).toBe('400000000');

    // Verify non-maliciousness: transfers are not marked as critical/malicious
    const hasCriticalOwnershipOrUpgrade = body.findings.some((f) =>
      f.id.startsWith('SENSITIVE_UPGRADE') || f.id.startsWith('SENSITIVE_TRANSFER_OWNERSHIP')
    );
    expect(hasCriticalOwnershipOrUpgrade).toBe(false);
  }, 45_000);
});
