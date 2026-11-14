import { beforeAll, afterAll } from 'vitest';
import recordings from '../server/fixtures/hermetic-recordings.json';

const realFetch = globalThis.fetch;

beforeAll(() => {
  // Global outbound fetch interceptor: blocks any unmocked external requests
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const url = new URL(urlStr, 'http://localhost');

    // Localhost / in-memory requests are allowed
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return realFetch(input, init);
    }

    // Replay recorded RPC requests for Ethereum & Base
    if (
      url.hostname.includes('rpc') ||
      url.hostname.includes('tenderly') ||
      url.hostname.includes('publicnode') ||
      url.hostname.includes('base.org')
    ) {
      let body: any = {};
      try {
        body = init?.body ? JSON.parse(init.body as string) : {};
      } catch {
        body = {};
      }

      const method = body.method;
      const isBase = url.hostname.includes('base');
      const chainConfig = isBase ? recordings.rpc['8453'] : recordings.rpc['1'];

      if (method === 'eth_chainId') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: chainConfig.chainId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'eth_getCode') {
        const addr = (body.params?.[0] || '').toLowerCase();
        const contract = (chainConfig.contracts as any)[addr];
        const code = contract?.code || '0x';
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: code }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'eth_getStorageAt') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: '0x0000000000000000000000000000000000000000000000000000000000000000',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'eth_call') {
        const data = (body.params?.[0]?.data || '').toLowerCase();

        // decimals() -> 6
        if (data.startsWith('0x313ce567')) {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: '0x0000000000000000000000000000000000000000000000000000000000000006',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // symbol() -> "USDbC"
        if (data.startsWith('0x95d89b41')) {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000055553446243000000000000000000000000000000000000000000000000000000',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Governor proposal state -> 7 (Executed)
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: '0x0000000000000000000000000000000000000000000000000000000000000007',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'eth_getBlockByNumber') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { timestamp: '0x65ba0624', number: '0x1000' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Replay recorded Blockscout smart contract responses
    if (url.hostname.includes('blockscout.com')) {
      const isBase = url.hostname.includes('base');
      const networkPrefix = isBase ? 'base' : 'ethereum';
      const addressMatch = url.pathname.match(/0x[a-fA-F0-9]{40}/i);
      if (addressMatch) {
        const addr = addressMatch[0].toLowerCase();
        const key = `${networkPrefix}:${addr}`;
        const match = (recordings.blockscout as any)[key];
        if (match) {
          return new Response(JSON.stringify(match), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify({ status: '0', message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Replay Sourcify files
    if (url.hostname.includes('sourcify.dev')) {
      return new Response(JSON.stringify({ files: [] }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Throw on unmocked outbound network requests
    throw new Error(
      `[Hermetic Test Violation] Outbound network fetch blocked during offline test: ${urlStr}`
    );
  };
});

afterAll(() => {
  globalThis.fetch = realFetch;
});
