import { describe, it, expect } from 'vitest';
import { createChainClient, validateGovernorContract, verifyNetworkChainId } from '../../server/chain/rpc-client';
import { retrieveProposalCreatedEvent, readGovernorProposalState } from '../../server/chain/proposal-events';

describe('Live chain integration: ENS & Unlock proposals', () => {
  it('retrieves ENS Ethereum proposal event and state', async () => {
    const network = 'ethereum';
    const governorAddress = '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3';
    const proposalId = '77767899528494238518019756391533686963875234067646094287125791110488147463806';

    const client = createChainClient(network);
    await verifyNetworkChainId(network, client);
    const validatedGovernor = await validateGovernorContract(client, governorAddress, network);
    expect(validatedGovernor).toBe(governorAddress);

    const event = await retrieveProposalCreatedEvent(client, network, validatedGovernor, proposalId);
    expect(event.proposalId).toBe(proposalId);
    expect(event.targets.length).toBeGreaterThan(0);
    expect(event.values.length).toBe(event.targets.length);
    expect(event.signatures.length).toBe(event.targets.length);
    expect(event.calldatas.length).toBe(event.targets.length);
    expect(event.description).toContain('Security Council');

    const state = await readGovernorProposalState(client, validatedGovernor, proposalId);
    expect(['Executed', 'Succeeded', 'Queued', 'Active', 'Pending', 'Defeated']).toContain(state);
  }, 30_000);

  it('retrieves Unlock Base proposal event and state', async () => {
    const network = 'base';
    const governorAddress = '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9';
    const proposalId = '27419154582993156392805749742953507877176483681373228046916881327937839104508';

    const client = createChainClient(network);
    await verifyNetworkChainId(network, client);
    const validatedGovernor = await validateGovernorContract(client, governorAddress, network);
    expect(validatedGovernor).toBe(governorAddress);

    const event = await retrieveProposalCreatedEvent(client, network, validatedGovernor, proposalId);
    expect(event.proposalId).toBe(proposalId);
    expect(event.targets.length).toBe(6);
    expect(event.values.length).toBe(6);
    expect(event.signatures.length).toBe(6);
    expect(event.calldatas.length).toBe(6);

    const state = await readGovernorProposalState(client, validatedGovernor, proposalId);
    expect(['Executed', 'Succeeded', 'Queued', 'Active', 'Pending', 'Defeated']).toContain(state);
  }, 30_000);
});

