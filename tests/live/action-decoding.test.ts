import { describe, it, expect } from 'vitest';
import { createChainClient } from '../../server/chain/rpc-client';
import { retrieveProposalCreatedEvent } from '../../server/chain/proposal-events';
import { decodeProposalActions } from '../../server/analysis/decode-actions';

describe('Live chain integration: Action decoding for ENS & Unlock', () => {
  it('decodes the ENS Ethereum grantRole action', async () => {
    const network = 'ethereum';
    const governorAddress = '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3';
    const proposalId = '77767899528494238518019756391533686963875234067646094287125791110488147463806';

    const client = createChainClient(network);
    const event = await retrieveProposalCreatedEvent(client, network, governorAddress, proposalId);

    const { actions } = await decodeProposalActions({
      network,
      targets: event.targets,
      values: event.values,
      signatures: event.signatures,
      calldatas: event.calldatas,
      client,
    });

    expect(actions).toHaveLength(1);
    const action = actions[0]!;
    expect(action.index).toBe(0);
    expect(action.decoded).toBe(true);
    expect(action.functionName).toBe('grantRole');
    expect(action.selector).toBe('0x2f2ff15d');
    expect(action.args).toHaveLength(2);
    expect(action.args?.[0]?.value).toBe('0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1');
    expect(action.args?.[1]?.value.toLowerCase()).toBe('0x2acbf518b3759f6e1fa163294eda55bf1d0ae051');
  }, 45_000);

  it('decodes all six Unlock Base transfer actions and preserves order', async () => {
    const network = 'base';
    const governorAddress = '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9';
    const proposalId = '27419154582993156392805749742953507877176483681373228046916881327937839104508';

    const client = createChainClient(network);
    const event = await retrieveProposalCreatedEvent(client, network, governorAddress, proposalId);

    const { actions } = await decodeProposalActions({
      network,
      targets: event.targets,
      values: event.values,
      signatures: event.signatures,
      calldatas: event.calldatas,
      client,
    });

    expect(actions).toHaveLength(6);

    for (let i = 0; i < 6; i++) {
      const action = actions[i]!;
      expect(action.index).toBe(i);
      expect(action.decoded).toBe(true);
      expect(action.functionName).toBe('transfer');
      expect(action.selector).toBe('0xa9059cbb');
      expect(action.args).toHaveLength(2);
      expect(action.args?.[0]?.value).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(BigInt(action.args?.[1]?.value || '0')).toBeGreaterThan(0n);
    }

    // Verify first action amount: 400 USDC (400000000)
    expect(actions[0]?.args?.[1]?.value).toBe('400000000');
  }, 45_000);
});
