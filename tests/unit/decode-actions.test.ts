import { describe, it, expect, vi } from 'vitest';
import {
  decodeProposalActions,
  formatArgValue,
} from '../../server/analysis/decode-actions';
import {
  detectProxyImplementation,
  EIP1967_IMPLEMENTATION_SLOT,
} from '../../server/analysis/resolve-abi';
import {
  toFunctionSelector,
  parseAbiItem,
  encodeFunctionData,
  parseAbi,
} from 'viem';

describe('formatArgValue', () => {
  it('formats bigints as strings', () => {
    expect(formatArgValue(12345678901234567890n)).toBe('12345678901234567890');
  });

  it('formats booleans, strings and numbers', () => {
    expect(formatArgValue(true)).toBe('true');
    expect(formatArgValue(false)).toBe('false');
    expect(formatArgValue('0x123')).toBe('0x123');
    expect(formatArgValue(42)).toBe('42');
  });

  it('formats arrays recursively', () => {
    expect(formatArgValue([1n, 2n, 'hello'])).toBe('[1, 2, hello]');
  });

  it('formats null and undefined gracefully', () => {
    expect(formatArgValue(null)).toBe('');
    expect(formatArgValue(undefined)).toBe('');
  });
});

describe('Proxy implementation detection', () => {
  it('detects EIP-1967 proxy implementation from storage slot', async () => {
    const mockImplAddress = '0x1234567890123456789012345678901234567890';
    const mockStorage = `0x000000000000000000000000${mockImplAddress.slice(2).toLowerCase()}`;

    const mockClient = {
      getStorageAt: vi.fn(async ({ slot }: { slot: string }) => {
        if (slot === EIP1967_IMPLEMENTATION_SLOT) {
          return mockStorage;
        }
        return '0x0000000000000000000000000000000000000000000000000000000000000000';
      }),
      getCode: vi.fn(async () => '0x608060405234801561001057600080fd5b50'),
    } as any;

    const result = await detectProxyImplementation(
      mockClient,
      '0x0000000000000000000000000000000000000001'
    );

    expect(result.isProxy).toBe(true);
    expect(result.implementationAddress?.toLowerCase()).toBe(mockImplAddress.toLowerCase());
  });

  it('returns false when proxy storage slots are empty', async () => {
    const mockClient = {
      getStorageAt: vi.fn(async () => '0x0000000000000000000000000000000000000000000000000000000000000000'),
    } as any;

    const result = await detectProxyImplementation(
      mockClient,
      '0x0000000000000000000000000000000000000001'
    );

    expect(result.isProxy).toBe(false);
    expect(result.implementationAddress).toBeUndefined();
  });
});

describe('Action decoding', () => {
  const erc20Abi = parseAbi([
    'function transfer(address to, uint256 amount) returns (bool)',
  ]);

  it('validates array lengths and rejects mismatched arrays', async () => {
    const mockClient = {} as any;

    await expect(
      decodeProposalActions({
        network: 'ethereum',
        targets: ['0x1111111111111111111111111111111111111111'],
        values: [0n, 100n], // Length mismatch
        signatures: [''],
        calldatas: ['0x'],
        client: mockClient,
      })
    ).rejects.toThrow(/lengths do not match/);
  });

  it('decodes legacy signature with argument-only calldata', async () => {
    const mockClient = {} as any;
    const recipient = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B';
    const amount = 5000000000000000000n;

    // Encoded arguments without 4-byte selector
    const fullData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, amount],
    });
    const argOnlyCalldata = `0x${fullData.slice(10)}` as `0x${string}`;

    const result = await decodeProposalActions({
      network: 'ethereum',
      targets: ['0x2222222222222222222222222222222222222222'],
      values: [0n],
      signatures: ['transfer(address,uint256)'],
      calldatas: [argOnlyCalldata],
      client: mockClient,
    });

    expect(result.actions).toHaveLength(1);
    const action = result.actions[0]!;
    expect(action.decoded).toBe(true);
    expect(action.functionName).toBe('transfer');
    expect(action.selector).toBe(toFunctionSelector(parseAbiItem('function transfer(address,uint256)')));
    expect(action.args).toHaveLength(2);
    expect(action.args?.[0]?.value.toLowerCase()).toBe(recipient.toLowerCase());
    expect(action.args?.[1]?.value).toBe(amount.toString());
  });

  it('decodes legacy signature when calldata already includes selector', async () => {
    const mockClient = {} as any;
    const recipient = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B';
    const amount = 1000n;

    const fullData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, amount],
    });

    const result = await decodeProposalActions({
      network: 'ethereum',
      targets: ['0x2222222222222222222222222222222222222222'],
      values: [0n],
      signatures: ['transfer(address,uint256)'],
      calldatas: [fullData],
      client: mockClient,
    });

    expect(result.actions).toHaveLength(1);
    const action = result.actions[0]!;
    expect(action.decoded).toBe(true);
    expect(action.functionName).toBe('transfer');
    expect(action.args?.[0]?.value.toLowerCase()).toBe(recipient.toLowerCase());
    expect(action.args?.[1]?.value).toBe(amount.toString());
  });

  it('preserves raw calldata and marks undecoded when ABI is unavailable', async () => {
    const target = '0x3333333333333333333333333333333333333333';
    const rawCalldata = '0x12345678abcdef0123456789';

    // Mock client where target has bytecode but no verified ABI available
    const mockClient = {
      getCode: vi.fn(async () => '0x608060405234801561001057600080fd5b50'),
      getStorageAt: vi.fn(async () => '0x0000000000000000000000000000000000000000000000000000000000000000'),
    } as any;

    const result = await decodeProposalActions({
      network: 'ethereum',
      targets: [target],
      values: [1000000000000000000n],
      signatures: [''],
      calldatas: [rawCalldata as any],
      client: mockClient,
    });

    expect(result.actions).toHaveLength(1);
    const action = result.actions[0]!;
    expect(action.decoded).toBe(false);
    expect(action.rawCalldata).toBe(rawCalldata);
    expect(action.selector).toBe('0x12345678');
    expect(action.value).toBe('1000000000000000000');
    expect(action.decodeError).toBeDefined();
    expect(result.limitations).toHaveLength(1);
    expect(result.limitations[0]).toContain(target);
  });

  it('preserves order of multiple mixed actions', async () => {
    const mockClient = {
      getCode: vi.fn(async () => '0x60806040'),
      getStorageAt: vi.fn(async () => '0x0000000000000000000000000000000000000000000000000000000000000000'),
    } as any;

    const recipient = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B';
    const calldata0 = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, 100n],
    });

    const result = await decodeProposalActions({
      network: 'ethereum',
      targets: [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ],
      values: [0n, 50n],
      signatures: ['transfer(address,uint256)', ''],
      calldatas: [calldata0, '0xdeadbeef00000000000000000000000000000000000000000000000000000000'],
      client: mockClient,
    });

    expect(result.actions).toHaveLength(2);
    expect(result.actions[0]?.index).toBe(0);
    expect(result.actions[0]?.decoded).toBe(true);
    expect(result.actions[0]?.functionName).toBe('transfer');

    expect(result.actions[1]?.index).toBe(1);
    expect(result.actions[1]?.decoded).toBe(false);
    expect(result.actions[1]?.selector).toBe('0xdeadbeef');
  });
});
