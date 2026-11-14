// docs/qa/run-api-tests.mjs
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://callscope-five.vercel.app';
const EVIDENCE_RAW_DIR = path.resolve('docs/qa/evidence/raw');
const RESULTS_PATH = path.resolve('docs/qa/results.json');
const SPEND_PATH = path.resolve('docs/qa/spend.md');
const PROPOSALS_PATH = path.resolve('docs/qa/proposals.json');

fs.mkdirSync(EVIDENCE_RAW_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(endpoint, payload, timeoutMs = 70000) {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const wallMs = Math.round(performance.now() - start);
    clearTimeout(timer);

    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { rawText: text.slice(0, 500) };
    }

    return {
      status: res.status,
      ok: res.ok,
      wallMs,
      body,
    };
  } catch (err) {
    const wallMs = Math.round(performance.now() - start);
    clearTimeout(timer);
    return {
      status: err.name === 'AbortError' ? 504 : 0,
      ok: false,
      wallMs,
      error: err.message,
      body: { error: err.name === 'AbortError' ? 'Client timed out after 70s' : err.message },
    };
  }
}

async function main() {
  const proposals = JSON.parse(fs.readFileSync(PROPOSALS_PATH, 'utf8'));
  const results = [];
  let servTotalSpend = 0;
  let dolphinTotalSpend = 0;
  const spendLog = [];

  console.log(`Starting Phase B1 API run on ${proposals.length} proposals at ${BASE_URL}...`);

  // 1. Initial 20 calls (Governor + ID)
  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];
    console.log(`[${i + 1}/${proposals.length}] Testing ${p.id} (${p.network} - ${p.title || p.proposalId})...`);

    const payload = {
      network: p.network,
      governorAddress: p.governor,
      proposalId: p.proposalId,
    };

    const run1 = await postJson('/api/analyse', payload);
    await sleep(3200);

    const record = {
      id: p.id,
      network: p.network,
      governor: p.governor,
      proposalId: p.proposalId,
      title: p.title,
      coldStatus: run1.status,
      coldWallMs: run1.wallMs,
      assessment: run1.body?.assessment?.outcome || null,
      errorStage: run1.body?.stageTagged?.stage || null,
      errorReason: run1.body?.stageTagged?.reason || run1.body?.error || null,
      timings: run1.body?.timings || null,
      actionCount: run1.body?.proposal?.actions?.length ?? null,
      rawBody: run1.body,
    };

    // Save raw evidence
    fs.writeFileSync(
      path.join(EVIDENCE_RAW_DIR, `${p.id}.json`),
      JSON.stringify({ request: payload, coldRun: run1 }, null, 2)
    );

    // 2. Measure cache on 6 selected cases (E1, E2, E3, B1, B2, B5)
    if (['E1', 'E2', 'E3', 'B1', 'B2', 'B5'].includes(p.id)) {
      console.log(`  Measuring cached repeat for ${p.id}...`);
      const repeatRun = await postJson('/api/analyse', payload);
      await sleep(3200);
      record.cachedStatus = repeatRun.status;
      record.cachedWallMs = repeatRun.wallMs;

      // Update raw evidence with repeat run
      const existing = JSON.parse(fs.readFileSync(path.join(EVIDENCE_RAW_DIR, `${p.id}.json`), 'utf8'));
      existing.repeatRun = repeatRun;
      fs.writeFileSync(path.join(EVIDENCE_RAW_DIR, `${p.id}.json`), JSON.stringify(existing, null, 2));
    }

    // 3. Tx-hash path for 6 cases (E1, E3, E6, B1, B2, B6)
    if (['E1', 'E3', 'E6', 'B1', 'B2', 'B6'].includes(p.id) && p.creationTx) {
      console.log(`  Testing tx-hash path for ${p.id}...`);
      const txPayload = {
        network: p.network,
        txHashOrUrl: p.creationTx,
      };
      const txRun = await postJson('/api/analyse', txPayload);
      await sleep(3200);
      record.txPathStatus = txRun.status;
      record.txPathWallMs = txRun.wallMs;
      record.txPathAssessment = txRun.body?.assessment?.outcome || null;

      const existing = JSON.parse(fs.readFileSync(path.join(EVIDENCE_RAW_DIR, `${p.id}.json`), 'utf8'));
      existing.txRun = txRun;
      fs.writeFileSync(path.join(EVIDENCE_RAW_DIR, `${p.id}.json`), JSON.stringify(existing, null, 2));
    }

    // 4. Live re-verify for 4 cases (E1, E2, B2, B5)
    if (['E1', 'E2', 'B2', 'B5'].includes(p.id)) {
      console.log(`  Testing live re-verify for ${p.id}...`);
      const revPayload = {
        network: p.network,
        governorAddress: p.governor,
        proposalId: p.proposalId,
        reverifyLive: true,
      };
      const revRun = await postJson('/api/analyse', revPayload);
      await sleep(3200);
      record.reverifyStatus = revRun.status;
      record.reverifyWallMs = revRun.wallMs;
      record.reverifyEventSource = revRun.body?.proposal?.info?.eventSource || null;

      const existing = JSON.parse(fs.readFileSync(path.join(EVIDENCE_RAW_DIR, `${p.id}.json`), 'utf8'));
      existing.reverifyRun = revRun;
      fs.writeFileSync(path.join(EVIDENCE_RAW_DIR, `${p.id}.json`), JSON.stringify(existing, null, 2));
    }

    results.push(record);
  }

  // 5. Tier Reviews (Standard up to 10 cases, Deep up to 4 cases)
  const successfulCases = results.filter((r) => r.coldStatus === 200 && r.rawBody?.proposal);
  console.log(`Found ${successfulCases.length} successful proposal analyses eligible for reviews.`);

  let standardCount = 0;
  let deepCount = 0;

  for (const item of successfulCases) {
    if (servTotalSpend >= 0.30 || dolphinTotalSpend >= 1.00) {
      console.log('Spend cap reached. Stopping AI calls.');
      break;
    }

    if (standardCount < 10) {
      console.log(`Calling Standard review for ${item.id}...`);
      const reviewReq = {
        network: item.network,
        governorAddress: item.governor,
        proposalId: item.proposalId,
        tier: 'standard',
      };
      const revRes = await postJson('/api/review', reviewReq, 75000);
      await sleep(3200);
      standardCount++;
      item.standardReview = {
        status: revRes.status,
        wallMs: revRes.wallMs,
        servStatus: revRes.body?.serv?.status,
        servModel: revRes.body?.serv?.modelReturned,
        servTurns: revRes.body?.serv?.loopTurns,
        servTools: revRes.body?.serv?.toolCallCount,
        dolphinStatus: revRes.body?.dolphin?.status,
        dolphinModel: revRes.body?.dolphin?.modelReturned,
        dolphinTurns: revRes.body?.dolphin?.loopTurns,
        dolphinTools: revRes.body?.dolphin?.toolCallCount,
      };

      // Estimate spend (~$0.01 per standard call if active)
      if (revRes.body?.serv?.status === 'complete') servTotalSpend += 0.015;
      if (revRes.body?.dolphin?.status === 'complete') dolphinTotalSpend += 0.03;
      spendLog.push({ testId: item.id, tier: 'standard', servStatus: revRes.body?.serv?.status, dolphinStatus: revRes.body?.dolphin?.status, servCum: servTotalSpend, dolphinCum: dolphinTotalSpend });

      const existing = JSON.parse(fs.readFileSync(path.join(EVIDENCE_RAW_DIR, `${item.id}.json`), 'utf8'));
      existing.standardReview = revRes;
      fs.writeFileSync(path.join(EVIDENCE_RAW_DIR, `${item.id}.json`), JSON.stringify(existing, null, 2));

      // Call Deep Review for first 4
      if (deepCount < 4 && servTotalSpend < 0.30 && dolphinTotalSpend < 1.00) {
        console.log(`Calling Deep review for ${item.id}...`);
        const deepReq = {
          network: item.network,
          governorAddress: item.governor,
          proposalId: item.proposalId,
          tier: 'deep',
        };
        const deepRes = await postJson('/api/review', deepReq, 90000);
        await sleep(3200);
        deepCount++;
        item.deepReview = {
          status: deepRes.status,
          wallMs: deepRes.wallMs,
          servStatus: deepRes.body?.serv?.status,
          servModel: deepRes.body?.serv?.modelReturned,
          servTurns: deepRes.body?.serv?.loopTurns,
          servTools: deepRes.body?.serv?.toolCallCount,
          dolphinStatus: deepRes.body?.dolphin?.status,
          dolphinModel: deepRes.body?.dolphin?.modelReturned,
          dolphinTurns: deepRes.body?.dolphin?.loopTurns,
          dolphinTools: deepRes.body?.dolphin?.toolCallCount,
        };

        if (deepRes.body?.serv?.status === 'complete') servTotalSpend += 0.03;
        if (deepRes.body?.dolphin?.status === 'complete') dolphinTotalSpend += 0.06;
        spendLog.push({ testId: item.id, tier: 'deep', servStatus: deepRes.body?.serv?.status, dolphinStatus: deepRes.body?.dolphin?.status, servCum: servTotalSpend, dolphinCum: dolphinTotalSpend });

        const existingDeep = JSON.parse(fs.readFileSync(path.join(EVIDENCE_RAW_DIR, `${item.id}.json`), 'utf8'));
        existingDeep.deepReview = deepRes;
        fs.writeFileSync(path.join(EVIDENCE_RAW_DIR, `${item.id}.json`), JSON.stringify(existingDeep, null, 2));
      }
    }
  }

  // Save results.json
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

  // Save spend.md
  const spendMd = `# API Spend Log\n\n- Audit spend cap: SERV <= $0.30, Dolphin <= $1.00\n- Final estimated spend: SERV ~$${servTotalSpend.toFixed(3)}, Dolphin ~$${dolphinTotalSpend.toFixed(3)}\n\n| Test | Tier | SERV Status | Dolphin Status | SERV Cum ($) | Dolphin Cum ($) |\n|---|---|---|---|---|---|\n` +
    spendLog.map((s) => `| ${s.testId} | ${s.tier} | ${s.servStatus || 'n/a'} | ${s.dolphinStatus || 'n/a'} | $${s.servCum.toFixed(3)} | $${s.dolphinCum.toFixed(3)} |`).join('\n') + '\n';
  fs.writeFileSync(SPEND_PATH, spendMd);

  // Print 20-line summary
  console.log('\n--- 20-LINE SUMMARY OF API RESULTS ---');
  for (const r of results) {
    const outcome = r.coldStatus === 200 ? `PASS (${r.assessment}, actions=${r.actionCount})` : `FAIL (HTTP ${r.coldStatus} - ${r.errorStage || r.errorReason})`;
    const repeat = r.cachedWallMs ? ` [cold: ${r.coldWallMs}ms, cached: ${r.cachedWallMs}ms]` : ` [${r.coldWallMs}ms]`;
    console.log(`${r.id} (${r.network}): ${outcome}${repeat}`);
  }
}

main().catch(console.error);

