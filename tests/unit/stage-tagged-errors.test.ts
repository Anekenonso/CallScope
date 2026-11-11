import { describe, it, expect } from 'vitest';
import handler, { extractStageTaggedError, ValidationError } from '../../api/_analyse';
import { ProposalEventLookupError } from '../../server/chain/proposal-events';
import type { VercelRequest, VercelResponse } from '../../src/types/vercel';

function createMockReqRes(method: string, body: unknown) {
  let statusCode = 200;
  let jsonBody: any = null;
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

describe('Stage-tagged errors (Task 0)', () => {
  it('extractStageTaggedError correctly handles ValidationError', () => {
    const err = new ValidationError('Invalid network: must be either "ethereum" or "base".');
    const tagged = extractStageTaggedError(err);
    expect(tagged).toEqual({
      stage: 'input_validation',
      reason: 'validation_error',
      detail: 'Invalid network: must be either "ethereum" or "base".',
    });
  });

  it('extractStageTaggedError correctly handles ProposalEventLookupError', () => {
    const err = new ProposalEventLookupError({
      message: 'ProposalCreated event not found for proposal ID 27419154582993156392805749742953507877176483681373228046916881327937839104508 on Governor 0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9',
      via: 'rpc',
      reason: 'not_found',
      detail: 'ProposalCreated event not found in searched block range on Governor 0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9',
    });
    const tagged = extractStageTaggedError(err);
    expect(tagged.stage).toBe('event_lookup');
    expect(tagged.via).toBe('rpc');
    expect(tagged.reason).toBe('not_found');
    expect(tagged.detail).toContain('ProposalCreated event not found');
  });

  it('returns stageTagged in API response on validation failure', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      network: 'polygon',
      governorAddress: '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9',
      proposalId: '123',
    });
    await handler(req, res);
    expect(getStatus()).toBe(400);
    const body = getBody();
    expect(body).toHaveProperty('stageTagged');
    expect(body.stageTagged.stage).toBe('input_validation');
    expect(body.stageTagged.reason).toBe('validation_error');
  });

  it('returns stageTagged in API response when proposal event is missing', async () => {
    // Test with mock or real handler where event lookup throws
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      network: 'base',
      governorAddress: '0x0000000000000000000000000000000000000000',
      proposalId: '999999999999999999',
    });
    await handler(req, res);
    expect(getStatus()).toBe(500);
    const body = getBody();
    expect(body).toHaveProperty('stageTagged');
    expect(['governor_validation', 'event_lookup', 'network_verification']).toContain(body.stageTagged.stage);
  });
});

