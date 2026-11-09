import { describe, it, expect, vi } from 'vitest';
import {
  getNetworkConfig,
  getRpcUrl,
  isSupportedNetwork,
} from '../../server/chain/networks';
import {
  verifyNetworkChainId,
  validateGovernorContract,
} from '../../server/chain/rpc-client';
import {
  parseProposalCreatedLog,
  PROPOSAL_STATE_MAP,
  PROPOSAL_CREATED_TOPIC0,
} from '../../server/chain/proposal-events';
import { encodeAbiParameters, toHex, type Log, type PublicClient } from 'viem';

describe('server/chain/networks', () => {
  it('correctly configures Ethereum Mainnet (chain 1)', () => {
    const config = getNetworkConfig('ethereum');
    expect(config.chainId).toBe(1);
    expect(config.id).toBe('ethereum');
    expect(config.defaultRpcUrl).toContain('http');
  });

  it('correctly configures Base Mainnet (chain 8453)', () => {
    const config = getNetworkConfig('base');
    expect(config.chainId).toBe(8453);
    expect(config.id).toBe('base');
    expect(config.defaultRpcUrl).toContain('http');
  });

  it('identifies supported networks', () => {
    expect(isSupportedNetwork('ethereum')).toBe(true);
    expect(isSupportedNetwork('base')).toBe(true);
    expect(isSupportedNetwork('arbitrum')).toBe(false);
  });

  it('respects environment variable overrides for RPC URL', () => {
    const originalEnv = process.env.ETHEREUM_RPC_URL;
    process.env.ETHEREUM_RPC_URL = 'https://custom-rpc.example.com';
    expect(getRpcUrl('ethereum')).toBe('https://custom-rpc.example.com');
    if (originalEnv) {
      process.env.ETHEREUM_RPC_URL = originalEnv;
    } else {
      delete process.env.ETHEREUM_RPC_URL;
    }
  });
});

describe('server/chain/rpc-client validation', () => {
  it('verifies matching chainId without throwing', async () => {
    const mockClient = {
      getChainId: vi.fn().mockResolvedValue(1),
    } as unknown as PublicClient;

    await expect(verifyNetworkChainId('ethereum', mockClient)).resolves.toBeUndefined();
  });

  it('throws on chainId mismatch', async () => {
    const mockClient = {
      getChainId: vi.fn().mockResolvedValue(5),
    } as unknown as PublicClient;

    await expect(verifyNetworkChainId('ethereum', mockClient)).rejects.toThrow(
      'Chain ID mismatch for ethereum'
    );
  });

  it('throws on invalid address format', async () => {
    const mockClient = {} as unknown as PublicClient;
    await expect(
      validateGovernorContract(mockClient, '0xinvalid', 'ethereum')
    ).rejects.toThrow('Invalid EVM address format');
  });

  it('throws when address has no bytecode', async () => {
    const mockClient = {
      getCode: vi.fn().mockResolvedValue('0x'),
    } as unknown as PublicClient;

    await expect(
      validateGovernorContract(
        mockClient,
        '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
        'ethereum'
      )
    ).rejects.toThrow('does not contain contract bytecode');
  });

  it('returns checksummed address when bytecode is present', async () => {
    const mockClient = {
      getCode: vi.fn().mockResolvedValue('0x608060405234801561001057600080fd5b50'),
    } as unknown as PublicClient;

    const result = await validateGovernorContract(
      mockClient,
      '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3',
      'ethereum'
    );
    expect(result).toBe('0x323A76393544d5ecca80cd6ef2A560C6a395b7E3');
  });
});

describe('server/chain/proposal-events', () => {
  it('maps all 8 OpenZeppelin proposal states correctly', () => {
    expect(PROPOSAL_STATE_MAP[0]).toBe('Pending');
    expect(PROPOSAL_STATE_MAP[1]).toBe('Active');
    expect(PROPOSAL_STATE_MAP[2]).toBe('Canceled');
    expect(PROPOSAL_STATE_MAP[3]).toBe('Defeated');
    expect(PROPOSAL_STATE_MAP[4]).toBe('Succeeded');
    expect(PROPOSAL_STATE_MAP[5]).toBe('Queued');
    expect(PROPOSAL_STATE_MAP[6]).toBe('Expired');
    expect(PROPOSAL_STATE_MAP[7]).toBe('Executed');
  });

  it('parses valid unindexed ProposalCreated log and matches proposalId', () => {
    const data = encodeAbiParameters(
      [
        { name: 'proposalId', type: 'uint256' },
        { name: 'proposer', type: 'address' },
        { name: 'targets', type: 'address[]' },
        { name: 'values', type: 'uint256[]' },
        { name: 'signatures', type: 'string[]' },
        { name: 'calldatas', type: 'bytes[]' },
        { name: 'voteStart', type: 'uint256' },
        { name: 'voteEnd', type: 'uint256' },
        { name: 'description', type: 'string' },
      ],
      [
        100n,
        '0x1111111111111111111111111111111111111111',
        ['0x2222222222222222222222222222222222222222'],
        [0n],
        ['grantRole(bytes32,address)'],
        ['0x1234'],
        1000n,
        2000n,
        'Test Proposal Description',
      ]
    );

    const mockLog: Log = {
      address: '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
      blockHash: '0xabc',
      blockNumber: 123456n,
      data,
      logIndex: 0,
      removed: false,
      topics: [PROPOSAL_CREATED_TOPIC0],
      transactionHash: '0xdeadbeef',
      transactionIndex: 1,
    };

    const parsed = parseProposalCreatedLog(mockLog, '100');
    expect(parsed).not.toBeNull();
    expect(parsed?.proposalId).toBe('100');
    expect(parsed?.proposer).toBe('0x1111111111111111111111111111111111111111');
    expect(parsed?.targets).toEqual(['0x2222222222222222222222222222222222222222']);
    expect(parsed?.values).toEqual([0n]);
    expect(parsed?.signatures).toEqual(['grantRole(bytes32,address)']);
    expect(parsed?.calldatas).toEqual(['0x1234']);
    expect(parsed?.description).toBe('Test Proposal Description');
    expect(parsed?.transactionHash).toBe('0xdeadbeef');
  });

  it('parses indexed ProposalCreated log variant', () => {
    const data = encodeAbiParameters(
      [
        { name: 'proposer', type: 'address' },
        { name: 'targets', type: 'address[]' },
        { name: 'values', type: 'uint256[]' },
        { name: 'signatures', type: 'string[]' },
        { name: 'calldatas', type: 'bytes[]' },
        { name: 'voteStart', type: 'uint256' },
        { name: 'voteEnd', type: 'uint256' },
        { name: 'description', type: 'string' },
      ],
      [
        '0x1111111111111111111111111111111111111111',
        ['0x2222222222222222222222222222222222222222'],
        [1000n],
        [''],
        ['0xa9059cbb000000'],
        5000n,
        6000n,
        'Indexed Variant Proposal',
      ]
    );

    const mockLog: Log = {
      address: '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9',
      blockHash: '0xdef',
      blockNumber: 654321n,
      data,
      logIndex: 2,
      removed: false,
      topics: [PROPOSAL_CREATED_TOPIC0, toHex(200n, { size: 32 })],
      transactionHash: '0xbeefcafe',
      transactionIndex: 3,
    };

    const parsed = parseProposalCreatedLog(mockLog, '200');
    expect(parsed).not.toBeNull();
    expect(parsed?.proposalId).toBe('200');
    expect(parsed?.values).toEqual([1000n]);
  });

  it('returns null when proposalId does not match', () => {
    const data = encodeAbiParameters(
      [
        { name: 'proposalId', type: 'uint256' },
        { name: 'proposer', type: 'address' },
        { name: 'targets', type: 'address[]' },
        { name: 'values', type: 'uint256[]' },
        { name: 'signatures', type: 'string[]' },
        { name: 'calldatas', type: 'bytes[]' },
        { name: 'voteStart', type: 'uint256' },
        { name: 'voteEnd', type: 'uint256' },
        { name: 'description', type: 'string' },
      ],
      [
        999n,
        '0x1111111111111111111111111111111111111111',
        [],
        [],
        [],
        [],
        0n,
        0n,
        '',
      ]
    );

    const mockLog: Log = {
      address: '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
      blockHash: '0xabc',
      blockNumber: 123n,
      data,
      logIndex: 0,
      removed: false,
      topics: [PROPOSAL_CREATED_TOPIC0],
      transactionHash: '0x1',
      transactionIndex: 0,
    };

    const parsed = parseProposalCreatedLog(mockLog, '100');
    expect(parsed).toBeNull();
  });

  it('throws an error if action array lengths mismatch', () => {
    const data = encodeAbiParameters(
      [
        { name: 'proposalId', type: 'uint256' },
        { name: 'proposer', type: 'address' },
        { name: 'targets', type: 'address[]' },
        { name: 'values', type: 'uint256[]' },
        { name: 'signatures', type: 'string[]' },
        { name: 'calldatas', type: 'bytes[]' },
        { name: 'voteStart', type: 'uint256' },
        { name: 'voteEnd', type: 'uint256' },
        { name: 'description', type: 'string' },
      ],
      [
        500n,
        '0x1111111111111111111111111111111111111111',
        ['0x2222222222222222222222222222222222222222', '0x3333333333333333333333333333333333333333'],
        [0n], // Length 1 vs targets length 2
        ['', ''],
        ['0x', '0x'],
        0n,
        0n,
        'Mismatched arrays',
      ]
    );

    const mockLog: Log = {
      address: '0x323A76393544d5ecca80cd6ef2a560C6a395b7E3',
      blockHash: '0xabc',
      blockNumber: 123n,
      data,
      logIndex: 0,
      removed: false,
      topics: [PROPOSAL_CREATED_TOPIC0],
      transactionHash: '0x1',
      transactionIndex: 0,
    };

    expect(() => parseProposalCreatedLog(mockLog, '500')).toThrow(
      'Malformed ProposalCreated event: action array length mismatch'
    );
  });
});
