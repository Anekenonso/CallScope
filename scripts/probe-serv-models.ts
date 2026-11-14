/**
 * Phase B — SERV model probe with correct model names
 * Run: node --experimental-strip-types --env-file=.env scripts/probe-serv-models.ts
 */

const ENDPOINT = 'https://inference-api.openserv.ai/v1/chat/completions';
const KEY = process.env.SERV_API_KEY || '';

if (!KEY) { console.error('SERV_API_KEY not set'); process.exit(1); }

interface CallResult {
  label: string;
  httpStatus: number;
  durationMs: number;
  model: string | null;
  content: string;
  toolCallCount: number;
  finishReason: string | null;
  error: unknown;
  hasToolCalls: boolean;
  nativeParamsAccepted: boolean | null;
}

async function call(label: string, body: Record<string, unknown>): Promise<CallResult> {
  const start = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY.trim()}`,
        'User-Agent': 'Callscope/phase-b-probe'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const durationMs = Date.now() - start;
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    const choice = (data?.choices as Array<Record<string, unknown>>)?.[0] || {};
    const message = (choice?.message || {}) as Record<string, unknown>;
    const content = (message?.content as string) || '';
    const toolCalls = (message?.tool_calls as unknown[]) || [];
    const finishReason = (choice?.finish_reason as string) || null;
    const modelReturned = (data?.model as string) || null;
    const errorField = data?.error || null;

    // Check if native params appear in response (some APIs echo them back)
    const hasNativeParams = JSON.stringify(data || {}).includes('serv_prompt_guard');
    
    console.log(`\n[${label}]`);
    console.log(`  HTTP: ${res.status} | ${durationMs}ms | model: ${modelReturned}`);
    console.log(`  finish_reason: ${finishReason} | tool_calls: ${toolCalls.length}`);
    console.log(`  content: "${content.slice(0, 100)}"`);
    if (errorField) console.log(`  error: ${JSON.stringify(errorField)}`);

    return {
      label, httpStatus: res.status, durationMs,
      model: modelReturned, content, toolCallCount: toolCalls.length,
      finishReason, error: errorField, hasToolCalls: toolCalls.length > 0,
      nativeParamsAccepted: res.status !== 400 ? null : false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`\n[${label}] THREW: ${msg}`);
    return { label, httpStatus: 0, durationMs: Date.now() - start, model: null, content: '', toolCallCount: 0, finishReason: null, error: msg, hasToolCalls: false, nativeParamsAccepted: null };
  }
}

const results: CallResult[] = [];

// 1. serv-swift minimal (cheapest SERV model, json_object)
results.push(await call('1-serv-swift-minimal', {
  model: 'serv-swift',
  messages: [
    { role: 'system', content: 'You are a minimal test assistant. Reply with exactly the JSON: {"ok":true}' },
    { role: 'user', content: 'Reply' }
  ],
  max_completion_tokens: 20, temperature: 0,
  response_format: { type: 'json_object' },
}));

// 2. serv-swift with native params in extra body — do they 400 or succeed?
results.push(await call('2-serv-swift-native-params', {
  model: 'serv-swift',
  messages: [
    { role: 'system', content: '[OpenServ Agent Configuration: serv_prompt_guard=true, serv_shadow_agent=true, reasoning_effort=low]\nReply with exactly: {"ok":true}' },
    { role: 'user', content: 'Reply' }
  ],
  max_completion_tokens: 20, temperature: 0,
  response_format: { type: 'json_object' },
  serv_prompt_guard: true,
  serv_shadow_agent: true,
  reasoning_effort: 'low',
}));

// 3. serv-swift with tools array — does model invoke them?
results.push(await call('3-serv-swift-tools', {
  model: 'serv-swift',
  messages: [
    { role: 'system', content: 'You are a tool-using investigator. Use get_action to fetch action 0.' },
    { role: 'user', content: 'Please call get_action with index 0.' }
  ],
  max_completion_tokens: 100, temperature: 0,
  tools: [{
    type: 'function',
    function: {
      name: 'get_action',
      description: 'Fetch a proposal executable action by index',
      parameters: {
        type: 'object',
        properties: { index: { type: 'integer', description: '0-based action index' } },
        required: ['index'],
      },
    }
  }],
  tool_choice: 'auto',
}));

// 4. serv-standard (mid-tier — good balance for real analysis)
results.push(await call('4-serv-standard-json', {
  model: 'serv-standard',
  messages: [
    { role: 'system', content: 'You analyse DAO proposals. Reply with exactly: {"summary":"Test analysis complete.","items":[]}' },
    { role: 'user', content: 'Analyse this test proposal.' }
  ],
  max_completion_tokens: 50, temperature: 0,
  response_format: { type: 'json_object' },
}));

// Summary
console.log('\n═══════════════════════════════════════════════════════');
console.log(' Summary');
console.log('═══════════════════════════════════════════════════════');
for (const r of results) {
  const icon = r.httpStatus === 200 && (r.content || r.hasToolCalls) ? '✅' : '❌';
  console.log(`${icon} ${r.label.padEnd(35)} HTTP:${r.httpStatus} | tools:${r.toolCallCount} | ${r.durationMs}ms`);
}

console.log('\n═══════════════════════════════════════════════════════');
console.log(' Phase B Key Findings');
console.log('═══════════════════════════════════════════════════════');

const minimalOk = results[0]?.httpStatus === 200;
console.log(`\n1. SERV endpoint live with valid model: ${minimalOk ? 'YES' : 'NO'}`);
console.log(`   Returned model: ${results[0]?.model || '(none)'}`);

const nativeOk = results[1]?.httpStatus === 200;
console.log(`\n2. Native params (serv_prompt_guard etc) → HTTP ${results[1]?.httpStatus}: ${nativeOk ? 'ACCEPTED (no 400)' : 'REJECTED'}`);
console.log(`   Verdict: ${nativeOk ? 'Params silently accepted or honoured — safe to include' : 'Params cause error — must remove from extraBody'}`);

const toolsOk = results[2]?.httpStatus === 200;
const toolsCalled = results[2]?.hasToolCalls;
console.log(`\n3. Tool-calling:`);
console.log(`   Endpoint accepted tools array: ${toolsOk ? 'YES' : 'NO (HTTP ' + results[2]?.httpStatus + ')'}`);
console.log(`   Model invoked tool_calls: ${toolsCalled ? 'YES — real agentic loop supported' : 'NO — model did not invoke tools'}`);

const stdOk = results[3]?.httpStatus === 200;
console.log(`\n4. serv-standard (recommended model): ${stdOk ? 'YES — available and working' : 'NO'}`);

console.log('\n═══════════════════════════════════════════════════════');
console.log(' Valid SERV models: serv-swift, serv-standard, serv-pro, serv-ultra');
console.log(' Recommended replacement: serv-swift (cheapest) or serv-standard (balanced)');
console.log('═══════════════════════════════════════════════════════');

import { writeFileSync } from 'fs';
writeFileSync('docs/evidence/raw/phase-b-serv-models.json', JSON.stringify({ probeRunAt: new Date().toISOString(), results }, null, 2), 'utf8');
console.log('\n📄 Evidence → docs/evidence/raw/phase-b-serv-models.json');

