import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { executeAnalysis } from '../api/_analyse.ts';

interface ProposalEntry {
  id: string;
  network: 'ethereum' | 'base';
  governor: string;
  proposalId: string;
  title: string;
  txHash?: string;
}

interface ProposalResult {
  id: string;
  network: string;
  title: string;
  success: boolean;
  latencyMs: number;
  targetsCount: number;
  actionsCount: number;
  error?: string;
}

function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function run() {
  console.log('Running Instant Tier Success Table on 25 Governance Proposals...\n');

  const catalogRaw = readFileSync(resolve(process.cwd(), 'eval/proposals.json'), 'utf8');
  const catalog = JSON.parse(catalogRaw);
  const proposals: ProposalEntry[] = catalog.proposals;

  const results: ProposalResult[] = [];

  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];
    const tStart = Date.now();
    try {
      const res = await executeAnalysis({
        network: p.network,
        governorAddress: p.governor,
        proposalId: p.proposalId,
      });
      const latencyMs = Date.now() - tStart;
      results.push({
        id: p.id,
        network: p.network,
        title: p.title,
        success: true,
        latencyMs,
        targetsCount: res.actions.length,
        actionsCount: res.actions.length,
      });
      console.log(`[${i + 1}/${proposals.length}] ✓ ${p.id} (${p.network}) - ${latencyMs}ms | ${res.actions.length} actions`);
    } catch (err: any) {
      const latencyMs = Date.now() - tStart;
      const errorMsg = err?.message || 'Lookup failed';
      results.push({
        id: p.id,
        network: p.network,
        title: p.title,
        success: false,
        latencyMs,
        targetsCount: 0,
        actionsCount: 0,
        error: errorMsg.slice(0, 100),
      });
      console.log(`[${i + 1}/${proposals.length}] ✗ ${p.id} (${p.network}) - ${latencyMs}ms | Error: ${errorMsg.slice(0, 60)}`);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const completionRatePct = (successCount / results.length) * 100;
  const latencies = results.map((r) => r.latencyMs);
  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);

  const rawEvidence = {
    evaluatedAt: new Date().toISOString(),
    totalProposals: results.length,
    successCount,
    completionRatePct,
    latencyP50Ms: p50,
    latencyP95Ms: p95,
    results,
  };

  const rawPath = resolve(process.cwd(), 'docs/evidence/raw/proposals-success-2026-11-14.json');
  writeFileSync(rawPath, JSON.stringify(rawEvidence, null, 2), 'utf8');
  console.log(`\nRaw evidence saved to: ${rawPath}`);

  // Markdown Summary
  let md = `# Instant Tier Success & Completion Rate Benchmark

**Date:** 2026-11-14  
**Evaluated Set:** 25 Governance Proposals across Ethereum and Base  
**Raw Evidence:** [\`docs/evidence/raw/proposals-success-2026-11-14.json\`](file:///docs/evidence/raw/proposals-success-2026-11-14.json)  
**Completion Rate:** **${completionRatePct.toFixed(1)}%** (${successCount}/${results.length})  
**Latency (p50 / p95):** **${p50} ms / ${p95} ms**  

---

## Proposal Evaluation Summary

| # | ID | Network | Title | Status | Latency | Actions Decoded |
|---|---|---|---|---|---|---|
`;

  results.forEach((r, idx) => {
    md += `| ${idx + 1} | \`${r.id}\` | ${r.network} | ${r.title} | ${r.success ? '✓ Complete' : '✗ ' + (r.error || 'Failed')} | ${r.latencyMs} ms | ${r.actionsCount} |\n`;
  });

  const mdPath = resolve(process.cwd(), 'docs/instant-success-table.md');
  writeFileSync(mdPath, md, 'utf8');
  console.log(`Markdown report saved to: ${mdPath}`);
}

run().catch((err) => {
  console.error('Fatal error during success table benchmark:', err);
  process.exit(1);
});
