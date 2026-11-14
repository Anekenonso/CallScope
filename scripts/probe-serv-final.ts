/**
 * Phase B — Final SERV probes: correct response_format, native params, and tool loop
 * Run: node --experimental-strip-types --env-file=.env scripts/probe-serv-final.ts
 */

import { writeFileSync } from 'fs';

const ENDPOINT = 'https://inference-api.openserv.ai/v1/chat/completions';
const KEY = process.env.SERV_API_KEY || '';
if (!KEY) { console.error('SERV_API_KEY not set'); process.exit(1); }

async function call(label: string, body: Record<string, unknown>) {
  const start = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY.trim()}`, 'User-Agent': 'Callscope/probe' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const durationMs = Date.now() - start;
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    const choice = (data?.choices as Array<Record<string, unknown>>)?.[0] || {};
    const message = (choice?.message || {}) as Record<string, unknown>;
    const content = (message?.content as string) || '';
    const toolCalls = (message?.tool_calls as Array<Record<string, unknown>>) || [];
    const finishReason = (choice?.finish_reason as string) || null;
    const modelReturned = (data?.model as string) || null;
    const errorField = data?.error || null;

    console.log(`\n[${label}]`);
    console.log(`  HTTP: ${res.status} | ${durationMs}ms | model: ${modelReturned}`);
    console.log(`  finish_reason: ${finishReason}`);
    console.log(`  tool_calls: ${toolCalls.length}${toolCalls.length > 0 ? ' → ' + JSON.stringify(toolCalls[0]?.function).slice(0, 100) : ''}`);
    console.log(`  content: "${content.slice(0, 150)}"`);
    if (errorField) console.log(`  ⚠ error: ${JSON.stringify(errorField)}`);

    return { label, httpStatus: res.status, durationMs, model: modelReturned, content, toolCalls, finishReason, error: errorField, raw: data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`\n[${label}] THREW: ${msg}`);
    return { label, httpStatus: 0, durationMs: Date.now() - start, model: null, content: '', toolCalls: [], finishReason: null, error: msg, raw: null };
  }
}

const results = [];

// 1. Plain text response (no response_format) — baseline to confirm model works
results.push(await call('1-plain-text', {
  model: 'serv-swift',
  messages: [
    { role: 'system', content: 'You are a brief test assistant.' },
    { role: 'user', content: 'Reply with: Analysis complete.' }
  ],
  max_completion_tokens: 20, temperature: 0,
}));

// 2. json_schema response_format (correct format for SERV)
results.push(await call('2-json-schema-format', {
  model: 'serv-swift',
  messages: [
    { role: 'system', content: 'You reply only with valid JSON.' },
    { role: 'user', content: 'Give me {"summary":"ok","items":[]}' }
  ],
  max_completion_tokens: 50, temperature: 0,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'review',
      schema: { type: 'object', properties: { summary: { type: 'string' }, items: { type: 'array' } }, required: ['summary', 'items'] }
    }
  },
}));

// 3. Native params WITHOUT response_format — do they 400?
results.push(await call('3-native-params-no-format', {
  model: 'serv-swift',
  messages: [
    { role: 'system', content: '[OpenServ Agent Configuration: serv_prompt_guard=true, serv_shadow_agent=true, reasoning_effort=low]\nReply with: Analysis complete.' },
    { role: 'user', content: 'Reply with: Analysis complete.' }
  ],
  max_completion_tokens: 20, temperature: 0,
  serv_prompt_guard: true,
  serv_shadow_agent: true,
  reasoning_effort: 'low',
}));

// 4. Tools with json_schema — the ideal combination
results.push(await call('4-tools-with-schema', {
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
      description: 'Fetch a proposal action by 0-based index',
      parameters: { type: 'object', properties: { index: { type: 'integer' } }, required: ['index'] }
    }
  }],
  tool_choice: 'auto',
  serv_prompt_guard: true,
  serv_shadow_agent: true,
  reasoning_effort: 'low',
}));

// Summary
console.log('\n═════════════════════════════════════════════════════════');
console.log('Phase B Final Findings');
console.log('═════════════════════════════════════════════════════════');

const [plain, jsonSchema, nativeParams, toolsWithNative] = results;
console.log(`\n✦ Correct response_format: "json_schema" (not "json_object")`);
console.log(`  json_schema format: HTTP ${jsonSchema?.httpStatus} → ${jsonSchema?.httpStatus === 200 ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
console.log(`\n✦ Native params (without response_format):`);
console.log(`  HTTP ${nativeParams?.httpStatus} → ${nativeParams?.httpStatus === 200 ? '✅ ACCEPTED (params silently honoured or ignored)' : '❌ REJECTED — must remove from extraBody'}`);
console.log(`\n✦ Tool-calling + native params:`);
console.log(`  HTTP ${toolsWithNative?.httpStatus} | tool_calls: ${toolsWithNative?.toolCalls?.length} → ${toolsWithNative?.httpStatus === 200 && (toolsWithNative?.toolCalls?.length ?? 0) > 0 ? '✅ REAL TOOL-CALLING WORKS' : toolsWithNative?.httpStatus === 200 ? 'HTTP OK but no tool calls returned' : '❌ FAILED'}`);
console.log(`\n✦ Underlying model for serv-swift: ${plain?.model || toolsWithNative?.model || '(not revealed)'}`);

console.log('\n═════════════════════════════════════════════════════════');
console.log('Action items for Phase B code changes:');
if ((jsonSchema?.httpStatus ?? 0) !== 200) {
  console.log('  1. Remove response_format entirely — use plain text + extractStructuredJson');
} else {
  console.log('  1. Change response_format.type from "json_object" to "json_schema" with schema');
}
if ((nativeParams?.httpStatus ?? 0) !== 200) {
  console.log('  2. Remove serv_prompt_guard/serv_shadow_agent/reasoning_effort from extraBody');
  console.log('     (keep them in system prompt text only — that is their actual location)');
} else {
  console.log('  2. Native params safe to include in extraBody');
}
if ((toolsWithNative?.toolCalls?.length ?? 0) > 0) {
  console.log('  3. ✅ Implement real ReAct tool-calling loop in serv.ts');
} else {
  console.log('  3. Keep pre-execution approach; model does not invoke tools');
}

writeFileSync('docs/evidence/raw/phase-b-serv-final.json', JSON.stringify({ probeRunAt: new Date().toISOString(), results }, null, 2), 'utf8');
console.log('\n📄 Evidence → docs/evidence/raw/phase-b-serv-final.json');

