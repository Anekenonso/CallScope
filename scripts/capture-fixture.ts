import { createPublicClient, http, decodeEventLog, type Address, type Hex } from 'viem';
import { mainnet, base } from 'viem/chains';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PROPOSAL_CREATED_ABI = [
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      { name: 'proposalId', type: 'uint256', indexed: false },
      { name: 'proposer', type: 'address', indexed: false },
      { name: 'targets', type: 'address[]', indexed: false },
      { name: 'values', type: 'uint256[]', indexed: false },
      { name: 'signatures', type: 'string[]', indexed: false },
      { name: 'calldatas', type: 'bytes[]', indexed: false },
      { name: 'voteStart', type: 'uint256', indexed: false },
      { name: 'voteEnd', type: 'uint256', indexed: false },
      { name: 'description', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'proposer', type: 'address', indexed: false },
      { name: 'targets', type: 'address[]', indexed: false },
      { name: 'values', type: 'uint256[]', indexed: false },
      { name: 'signatures', type: 'string[]', indexed: false },
      { name: 'calldatas', type: 'bytes[]', indexed: false },
      { name: 'voteStart', type: 'uint256', indexed: false },
      { name: 'voteEnd', type: 'uint256', indexed: false },
      { name: 'description', type: 'string', indexed: false },
    ],
  },
] as const;

interface FixtureTarget {
  chain: 'ethereum' | 'base';
  rpcUrl: string;
  governor: Address;
  proposalId: string;
  txHash: Hex;
}

const TARGETS: FixtureTarget[] = [
  {
    chain: 'ethereum',
    rpcUrl: 'https://gateway.tenderly.co/public/mainnet',
    governor: '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3',
    proposalId: '77767899528494238518019756391533686963875234067646094287125791110488147463806',
    txHash: '0x76eefae46df65ef44d7bf95f4a0fd7cc7f0628fd684cc0074d59f1173cddef90',
  },
  {
    chain: 'base',
    rpcUrl: 'https://base-rpc.publicnode.com',
    governor: '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9',
    proposalId: '27419154582993156392805749742953507877176483681373228046916881327937839104508',
    txHash: '0xa7ba89ff0db229f6f00b01d9d5f006c1db8c0591ffba8c7cb1c6f6b5e0d5b385',
  },
];

async function capture() {
  const outDir = path.resolve(process.cwd(), 'server', 'fixtures');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const t of TARGETS) {
    console.log(`Fetching fixture for ${t.chain} proposal ${t.proposalId}...`);
    const chain = t.chain === 'ethereum' ? mainnet : base;
    const client = createPublicClient({ chain, transport: http(t.rpcUrl) });
    const receipt = await client.getTransactionReceipt({ hash: t.txHash });

    let foundEvent: any = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== t.governor.toLowerCase()) continue;
      for (const abiItem of PROPOSAL_CREATED_ABI) {
        try {
          const decoded = decodeEventLog({
            abi: [abiItem],
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'ProposalCreated') {
            const args = decoded.args as any;
            if (args.proposalId?.toString() === t.proposalId) {
              foundEvent = {
                chain: t.chain,
                governor: t.governor,
                proposalId: t.proposalId,
                proposer: args.proposer,
                targets: args.targets,
                values: args.values.map((v: bigint) => v.toString()),
                signatures: args.signatures,
                calldatas: args.calldatas,
                voteStart: (args.voteStart ?? 0n).toString(),
                voteEnd: (args.voteEnd ?? 0n).toString(),
                description: args.description ?? '',
                blockNumber: receipt.blockNumber.toString(),
                transactionHash: t.txHash,
              };
              break;
            }
          }
        } catch {}
      }
      if (foundEvent) break;
    }

    if (!foundEvent) {
      throw new Error(`Failed to extract ProposalCreated event for ${t.chain} ${t.proposalId}`);
    }

    const filename = `${t.chain}-${t.governor.toLowerCase()}-${t.proposalId}.json`;
    const filePath = path.join(outDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(foundEvent, null, 2), 'utf-8');
    console.log(`Saved fixture snapshot to ${filePath}`);
  }
}

capture().catch((err) => {
  console.error('Error capturing fixture:', err);
  process.exit(1);
});

