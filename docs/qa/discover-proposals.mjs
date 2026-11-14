// docs/qa/discover-proposals.mjs
const ETH_RPCS = [
  'https://cloudflare-eth.com',
  'https://gateway.tenderly.co/public/mainnet',
  'https://ethereum-rpc.publicnode.com'
];
const BASE_RPCS = [
  'https://mainnet.base.org',
  'https://base-rpc.publicnode.com',
  'https://1rpc.io/base'
];

async function rpcCall(rpcs, method, params) {
  for (const url of rpcs) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;
      return data.result;
    } catch (e) {
      // try next
    }
  }
  throw new Error(`All RPCs failed for ${method}`);
}

async function main() {
  const ethBlock = parseInt(await rpcCall(ETH_RPCS, 'eth_blockNumber', []), 16);
  const baseBlock = parseInt(await rpcCall(BASE_RPCS, 'eth_blockNumber', []), 16);
  console.log(`Current ETH block: ${ethBlock}, Base block: ${baseBlock}`);

  const ethGovernors = [
    { name: 'ENS', address: '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3' },
    { name: 'Uniswap', address: '0x408ED6354d4973f66138C91495F2f2FCbd8724C3' },
    { name: 'Compound', address: '0xc0Da02939E1441F497fd74F78cE7Decb17B66529' }
  ];

  const baseGovernors = [
    { name: 'KnownFailing', address: '0x4cEeE1b6289624d381383C1Bb42B118d5f2c3274' },
    { name: 'Unlock', address: '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9' },
    { name: 'Seamless', address: '0x8768c789C6df8AF1a92d96dE823b4F80010Db294' }
  ];

  for (const g of ethGovernors) {
    try {
      const res = await rpcCall(ETH_RPCS, 'eth_call', [{ to: g.address, data: '0x4bf86a82' }, 'latest']);
      console.log(`ETH Governor ${g.name} (${g.address}): CLOCK_MODE=${res}`);
    } catch (e) {
      console.log(`ETH Governor ${g.name}: clock call failed: ${e.message}`);
    }
  }

  for (const g of baseGovernors) {
    try {
      const res = await rpcCall(BASE_RPCS, 'eth_call', [{ to: g.address, data: '0x4bf86a82' }, 'latest']);
      console.log(`Base Governor ${g.name} (${g.address}): CLOCK_MODE=${res}`);
    } catch (e) {
      console.log(`Base Governor ${g.name}: clock call failed: ${e.message}`);
    }
  }
}

main().catch(console.error);
