import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPPORTED_NETWORKS } from '../server/chain/networks.ts';

const README_PATH = resolve(process.cwd(), 'README.md');

function runChecks() {
  if (!existsSync(README_PATH)) {
    console.error('FAIL: README.md not found.');
    process.exit(1);
  }

  const content = readFileSync(README_PATH, 'utf-8');
  const errors: string[] = [];

  // 1. Verify no unresolved placeholder strings
  if (content.includes('<repository-url>')) {
    errors.push('README contains unresolved placeholder: <repository-url>');
  }

  // 2. Verify Base RPC configuration
  const expectedBaseRpc = SUPPORTED_NETWORKS.base.defaultRpcUrl;
  if (!content.includes(expectedBaseRpc)) {
    errors.push(`README missing expected Base default RPC URL: ${expectedBaseRpc}`);
  }
  if (content.includes('base.gateway.tenderly.co')) {
    errors.push('README contains deprecated Tenderly Base RPC url');
  }

  // 3. Verify Ethereum RPC configuration
  const expectedEthRpc = SUPPORTED_NETWORKS.ethereum.defaultRpcUrl;
  if (!content.includes(expectedEthRpc)) {
    errors.push(`README missing expected Ethereum default RPC URL: ${expectedEthRpc}`);
  }

  // 4. Verify Fixture addresses and proposal IDs
  const ensGov = '0x323A76393544d5ecca80cd6ef2A560C6a395b7E3';
  const ensId = '77767899528494238518019756391533686963875234067646094287125791110488147463806';
  const unlockGov = '0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9';
  const unlockId = '27419154582993156392805749742953507877176483681373228046916881327937839104508';

  if (!content.includes(ensGov) || !content.includes(ensId)) {
    errors.push('README missing verified ENS fixture parameters');
  }
  if (!content.includes(unlockGov) || !content.includes(unlockId)) {
    errors.push('README missing verified Unlock fixture parameters');
  }

  // 5. Verify test count claim is not obsolete (must not claim only 80 tests)
  if (content.includes('80+ automated tests')) {
    errors.push('README contains obsolete test count claim (80+ automated tests)');
  }

  if (errors.length > 0) {
    console.error('❌ README consistency check failed with the following discrepancies:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('✅ README consistency check passed. All constants, RPCs, and fixtures match code.');
}

runChecks();
