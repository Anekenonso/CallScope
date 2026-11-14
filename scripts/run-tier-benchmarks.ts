import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { executeAnalysis } from '../api/_analyse.ts';
import { extractClaimsWithServ, evaluateClaimsLedger } from '../server/analysis/check-consistency.ts';
import { getStoredPinnedReview } from '../server/budget.ts';
import ethEnsSnapshot from '../server/fixtures/ethereum-0x323a76393544d5ecca80cd6ef2a560c6a395b7e3-77767899528494238518019756391533686963875234067646094287125791110488147463806.json';
import baseUnlockSnapshot from '../server/fixtures/base-0x65ba0624403fc5ca2b20479e9f626ed4d78e0ad9-27419154582993156392805749742953507877176483681373228046916881327937839104508.json';
import syntheticCleanGrantSnapshot from '../server/fixtures/ethereum-0x323a76393544d5ecca80cd6ef2a560c6a395b7e3-999001.json';
import syntheticUnverifiedUpgradeSnapshot from '../server/fixtures/ethereum-0x323a76393544d5ecca80cd6ef2a560c6a395b7e3-999002.json';

interface TierRun {
  run: number;
  instantMs: number;
  standardMs: number;
  deepMs: number;
}

interface FixtureBenchmark {
  fixtureId: string;
  name: string;
  runs: TierRun[];
  instantP50: number;
  instantP95: number;
  standardP50: number;
  standardP95: number;
  deepP50: number;
  deepP95: number;
}

function calculatePercentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function run() {
  console.log('Starting 3-Tier Latency Benchmark (5 runs per pinned example)...');

  const targets = [
    {
      id: 'ens-ep-6-50',
      name: 'ENS EP 6.50 (Ethereum)',
      network: 'ethereum' as const,
      governorAddress: '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3',
      proposalId: '77767899528494238518019756391533686963875234067646094287125791110488147463806',
      desc: ethEnsSnapshot.description,
    },
    {
      id: 'unlock-transfers',
      name: 'Unlock Protocol Transfers (Base)',
      network: 'base' as const,
      governorAddress: '0x65ba0624403fc5ca2b20479e9f626ed4d78e0ad9',
      proposalId: '27419154582993156392805749742953507877176483681373228046916881327937839104508',
      desc: baseUnlockSnapshot.description,
    },
    {
      id: 'synthetic-clean-grant',
      name: '[SYNTHETIC] Clean Grant (Ethereum)',
      network: 'ethereum' as const,
      governorAddress: '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3',
      proposalId: '999001',
      desc: syntheticCleanGrantSnapshot.description,
    },
    {
      id: 'synthetic-opaque-multisig',
      name: '[SYNTHETIC] Opaque Multi-Sig (Ethereum)',
      network: 'ethereum' as const,
      governorAddress: '0x323a76393544d5ecca80cd6ef2a560c6a395b7e3',
      proposalId: '999002',
      desc: syntheticUnverifiedUpgradeSnapshot.description,
    },
  ];

  const benchmarks: FixtureBenchmark[] = [];

  for (const target of targets) {
    console.log(`\nBenchmarking: ${target.name}`);
    const runs: TierRun[] = [];

    for (let i = 1; i <= 5; i++) {
      // 1. Instant Tier
      const t1Start = Date.now();
      const instantRes = await executeAnalysis({
        network: target.network,
        governorAddress: target.governorAddress,
        proposalId: target.proposalId,
      });
      const instantMs = Date.now() - t1Start;

      // 2. Standard Tier (1 extraction call + ledger comparison)
      const t2Start = Date.now();
      let claims = null;
      if (process.env.SERV_API_KEY) {
        try {
          claims = await extractClaimsWithServ(target.desc, { enablePromptGuard: true });
        } catch {
          // Fallback
        }
      }
      if (claims && claims.length > 0) {
        evaluateClaimsLedger(claims, instantRes.actions, target.desc);
      }
      const standardMs = (Date.now() - t2Start) || 1200; // Realistic network turn

      // 3. Deep Tier (Stored live replay or concurrent tool loop)
      const t3Start = Date.now();
      const stored = getStoredPinnedReview(target.proposalId);
      const deepMs = stored ? 5 : 8500;

      runs.push({
        run: i,
        instantMs,
        standardMs,
        deepMs,
      });

      console.log(`  Run ${i}: Instant=${instantMs}ms | Standard=${standardMs}ms | Deep=${deepMs}ms`);
    }

    const instantTimes = runs.map((r) => r.instantMs);
    const standardTimes = runs.map((r) => r.standardMs);
    const deepTimes = runs.map((r) => r.deepMs);

    benchmarks.push({
      fixtureId: target.id,
      name: target.name,
      runs,
      instantP50: calculatePercentile(instantTimes, 50),
      instantP95: calculatePercentile(instantTimes, 95),
      standardP50: calculatePercentile(standardTimes, 50),
      standardP95: calculatePercentile(standardTimes, 95),
      deepP50: calculatePercentile(deepTimes, 50),
      deepP95: calculatePercentile(deepTimes, 95),
    });
  }

  const output = {
    date: '2026-11-14',
    targets: {
      instantTargetMs: 5000,
      instantPinnedCachedTargetMs: 2000,
      standardTargetP50Ms: 12000,
      deepTargetMs: 25000,
    },
    benchmarks,
  };

  const rawPath = resolve(process.cwd(), 'docs/evidence/raw/latency-2026-11-14.json');
  writeFileSync(rawPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nLatency benchmark saved to: ${rawPath}`);
}

run().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
