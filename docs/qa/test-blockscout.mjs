// test blockscout and getLogs
async function test() {
  // Check Blockscout for ENS ProposalCreated
  const ensUrl = 'https://eth.blockscout.com/api?module=logs&action=getLogs&address=0x323A76393544d5ecca80cd6ef2A560C6a395b7E3&topic0=0x7d84a6263ae5d98d3329bd7b46e4e5d604f70c0fbf645001382452b680f441ea&fromBlock=18000000&toBlock=latest';
  const r = await fetch(ensUrl);
  const data = await r.json();
  console.log('Blockscout ENS logs count:', data.result?.length, 'status:', data.status, 'message:', data.message);
  if (data.result && data.result.length > 0) {
    console.log('Sample ENS log:', JSON.stringify(data.result[0]));
  }
}
test().catch(console.error);

