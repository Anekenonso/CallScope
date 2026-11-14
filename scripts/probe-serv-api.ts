/**
 * Phase B — OpenServ SERV API Probe
 *
 * Purpose: Verify real endpoint, model name, native parameter support,
 * tool-calling support, and response_format support.
 *
 * Run: node --experimental-strip-types --env-file=.env scripts/probe-serv-api.ts
 *
 * Records raw evidence to docs/evidence/raw/phase-b-serv-api.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SERV_ENDPOINT =
  process.env.SERV_ENDPOINT || 'https://inference-api.openserv.ai/v1/chat/completions';
const SERV_MODEL = process.env.SERV_MODEL || 'serv-mini';
const SERV_API_KEY = process.env.SERV_API_KEY || '';

if (!SERV_API_KEY) {
  console.error('❌ SERV_API_KEY not set. Add to .env and retry.');
  process.exit(1);
}

interface ProbeResult {
  probeName: string;
  timestamp: string;
  endpoint: string;
  model: string;
  requestBody: Record<string, unknown>;
  httpStatus: number;
  responseHeaders: Record<string, string>;
  rawResponseBody: unknown;
  durationMs: number;
  verdict: string;
  notes: string[];
}

async function probe(
  probeName: string,
  body: Record<string, unknown>
): Promise<ProbeResult> {
  const start = Date.now();
  const notes: string[] = [];

  console.log(`\n▶ ${probeName}`);
  console.log('  Request body keys:', Object.keys(body).join(', '));

  let httpStatus = 0;
  let rawResponseBody: unknown = null;
  let responseHeaders: Record<string, string> = {};

  try {
    const res = await fetch(SERV_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERV_API_KEY.trim()}`,
        'User-Agent': 'Callscope/phase-b-probe',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    httpStatus = res.status;
    responseHeaders = Object.fromEntries(res.headers.entries());

    try {
      rawResponseBody = await res.json();
    } catch {
      rawResponseBody = { _parseError: 'Response body was not JSON', text: await res.text().catch(() => '') };
    }

    const data = rawResponseBody as Record<string, unknown>;
    const choices = Array.isArray(data?.choices) ? data.choices : [];
    const firstChoice = (choices[0] || {}) as Record<string, unknown>;
    const message = (firstChoice?.message || {}) as Record<string, unknown>;
    const content = message?.content;
    const finishReason = firstChoice?.finish_reason;
    const modelReturned = (data?.model as string) || null;
    const toolCalls = (message?.tool_calls as unknown[]) || [];

    console.log(`  HTTP status: ${httpStatus}`);
    console.log(`  model (returned): ${modelReturned || '(not in response)'}`);
    console.log(`  finish_reason: ${finishReason || '(none)'}`);
    console.log(`  content: ${typeof content === 'string' ? content.slice(0, 120) + (content.length > 120 ? '…' : '') : '(empty/null)'}`);
    console.log(`  tool_calls: ${toolCalls.length > 0 ? JSON.stringify(toolCalls).slice(0, 200) : '(none)'}`);

    if (data?.error) {
      notes.push(`API error field: ${JSON.stringify(data.error)}`);
      console.log(`  ⚠ Error field:`, JSON.stringify(data.error));
    }

    if (modelReturned && modelReturned !== body.model) {
      notes.push(`Model mismatch: requested "${body.model}", returned "${modelReturned}"`);
    }

    const verdict = httpStatus === 200 && (typeof content === 'string' && content.length > 0 || toolCalls.length > 0)
      ? 'PASS'
      : httpStatus === 200 && finishReason === 'length'
        ? 'PASS-TRUNCATED'
        : httpStatus >= 400
          ? `FAIL-HTTP-${httpStatus}`
          : 'FAIL-EMPTY';

    console.log(`  Verdict: ${verdict}`);

    return {
      probeName,
      timestamp: new Date().toISOString(),
      endpoint: SERV_ENDPOINT,
      model: SERV_MODEL,
      requestBody: body,
      httpStatus,
      responseHeaders,
      rawResponseBody,
      durationMs: Date.now() - start,
      verdict,
      notes,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ Threw: ${msg}`);
    return {
      probeName,
      timestamp: new Date().toISOString(),
      endpoint: SERV_ENDPOINT,
      model: SERV_MODEL,
      requestBody: body,
      httpStatus,
      responseHeaders,
      rawResponseBody,
      durationMs: Date.now() - start,
      verdict: `ERROR: ${msg}`,
      notes: [`threw: ${msg}`],
    };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log(' CallScope Phase B — OpenServ SERV API Probe');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Endpoint : ${SERV_ENDPOINT}`);
  console.log(`Model    : ${SERV_MODEL}`);
  console.log(`Key set  : ${SERV_API_KEY ? 'YES (not logged)' : 'NO'}`);

  const results: ProbeResult[] = [];

  // ── Probe 1: Minimal call — verify endpoint and model accept requests
  results.push(await probe('1-minimal-call', {
    model: SERV_MODEL,
    messages: [
      { role: 'system', content: 'You are a test assistant. Reply with exactly: {"ok":true}' },
      { role: 'user', content: 'Reply with {"ok":true}' },
    ],
    max_completion_tokens: 20,
    temperature: 0,
    response_format: { type: 'json_object' },
  }));

  // ── Probe 2: With native OpenServ params — do they cause errors or get ignored?
  results.push(await probe('2-native-params', {
    model: SERV_MODEL,
    messages: [
      { role: 'system', content: '[OpenServ Agent Configuration: serv_prompt_guard=true, serv_shadow_agent=true, reasoning_effort=low]\nReply with exactly: {"params_accepted":true}' },
      { role: 'user', content: 'Reply with {"params_accepted":true}' },
    ],
    max_completion_tokens: 20,
    temperature: 0,
    response_format: { type: 'json_object' },
    serv_prompt_guard: true,
    serv_shadow_agent: true,
    reasoning_effort: 'low',
  }));

  // ── Probe 3: Tool-calling — does the endpoint support tools array?
  results.push(await probe('3-tool-calling', {
    model: SERV_MODEL,
    messages: [
      { role: 'system', content: 'You are a tool-using assistant. Use the get_action tool to fetch action index 0.' },
      { role: 'user', content: 'Please call get_action with index 0' },
    ],
    max_completion_tokens: 100,
    temperature: 0,
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_action',
          description: 'Fetch proposal action details',
          parameters: {
            type: 'object',
            properties: { index: { type: 'integer' } },
            required: ['index'],
          },
        },
      },
    ],
    tool_choice: 'auto',
  }));

  // ── Probe 4: Available models list (if /v1/models endpoint exists)
  console.log('\n▶ 4-models-list');
  const modelsEndpoint = SERV_ENDPOINT.replace('/chat/completions', '/models').replace(/\/v1\/.*$/, '/v1/models');
  console.log(`  GET ${modelsEndpoint}`);
  try {
    const start = Date.now();
    const res = await fetch(modelsEndpoint, {
      headers: { Authorization: `Bearer ${SERV_API_KEY.trim()}` },
      signal: AbortSignal.timeout(10_000),
    });
    const rawBody = await res.json().catch(() => null);
    const durationMs = Date.now() - start;
    console.log(`  HTTP status: ${res.status}`);
    console.log(`  Response: ${JSON.stringify(rawBody).slice(0, 300)}`);
    results.push({
      probeName: '4-models-list',
      timestamp: new Date().toISOString(),
      endpoint: modelsEndpoint,
      model: SERV_MODEL,
      requestBody: { method: 'GET' },
      httpStatus: res.status,
      responseHeaders: Object.fromEntries(res.headers.entries()),
      rawResponseBody: rawBody,
      durationMs,
      verdict: res.status === 200 ? 'PASS' : `FAIL-HTTP-${res.status}`,
      notes: [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ Threw: ${msg}`);
    results.push({
      probeName: '4-models-list',
      timestamp: new Date().toISOString(),
      endpoint: modelsEndpoint,
      model: SERV_MODEL,
      requestBody: { method: 'GET' },
      httpStatus: 0,
      responseHeaders: {},
      rawResponseBody: null,
      durationMs: 0,
      verdict: `ERROR: ${msg}`,
      notes: [`threw: ${msg}`],
    });
  }

  // ── Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' Summary');
  console.log('═══════════════════════════════════════════════════════');
  for (const r of results) {
    const icon = r.verdict.startsWith('PASS') ? '✅' : r.verdict.startsWith('FAIL') ? '❌' : '⚠';
    console.log(`${icon} ${r.probeName.padEnd(25)} ${r.verdict.padEnd(20)} ${r.durationMs}ms`);
  }

  // ── Write evidence
  mkdirSync('docs/evidence/raw', { recursive: true });
  const outPath = join('docs/evidence/raw', 'phase-b-serv-api.json');
  writeFileSync(outPath, JSON.stringify({ probeRunAt: new Date().toISOString(), results }, null, 2), 'utf8');
  console.log(`\n📄 Evidence written → ${outPath}`);

  // ── Analysis for Phase B findings
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' Phase B Findings');
  console.log('═══════════════════════════════════════════════════════');

  const minimal = results.find(r => r.probeName === '1-minimal-call');
  const nativeParams = results.find(r => r.probeName === '2-native-params');
  const toolCalling = results.find(r => r.probeName === '3-tool-calling');
  const models = results.find(r => r.probeName === '4-models-list');

  if (minimal) {
    console.log(`\nEndpoint & model:`);
    console.log(`  Endpoint live: ${minimal.verdict.startsWith('PASS') ? 'YES' : 'NO'}`);
    const returned = (minimal.rawResponseBody as Record<string, unknown>)?.model as string | undefined;
    console.log(`  Model returned: ${returned || '(not in response)'}`);
  }

  if (nativeParams) {
    const nativeOk = nativeParams.verdict.startsWith('PASS');
    console.log(`\nNative params (serv_prompt_guard, serv_shadow_agent, reasoning_effort):`);
    console.log(`  Call succeeded (params did not 400): ${nativeOk ? 'YES — params accepted or silently ignored' : 'NO — params caused error'}`);
    if (nativeParams.httpStatus === 400) {
      console.log(`  ⚠ CONCLUSION: Native params cause HTTP 400 → must be REMOVED from extraBody`);
    } else if (nativeOk) {
      console.log(`  ℹ CONCLUSION: Params did not cause an error. Cannot distinguish "honoured" from "silently ignored".`);
      console.log(`    They should be described as: "declared in system prompt; also passed as extra body fields (accepted by API)"`);
    }
  }

  if (toolCalling) {
    const toolData = toolCalling.rawResponseBody as Record<string, unknown>;
    const toolChoices = toolData?.choices as Array<Record<string, unknown>> | undefined;
    const toolMsg = toolChoices?.[0]?.message as Record<string, unknown> | undefined;
    const toolCalls = toolMsg?.tool_calls as unknown[] | undefined;
    const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;
    console.log(`\nTool-calling support:`);
    console.log(`  Endpoint accepted tools array: ${toolCalling.httpStatus !== 400 ? 'YES' : 'NO'}`);
    console.log(`  Model returned tool_calls: ${hasToolCalls ? 'YES — real tool-calling supported' : 'NO — model did not invoke tools'}`);
    if (hasToolCalls) {
      console.log(`  ✅ CONCLUSION: Real ReAct tool-calling is supported → Phase C can implement full loop`);
    } else {
      console.log(`  ℹ CONCLUSION: Tools array accepted but model didn't invoke → keep pre-execution approach`);
    }
  }

  if (models && models.verdict.startsWith('PASS')) {
    const modelsData = models.rawResponseBody as Record<string, unknown>;
    const modelList = Array.isArray(modelsData?.data) ? (modelsData.data as Array<Record<string, unknown>>).map(m => m.id) : [];
    console.log(`\nAvailable models:`);
    if (modelList.length > 0) {
      modelList.forEach(m => console.log(`  - ${m}`));
    } else {
      console.log(`  (Could not parse model list)`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

