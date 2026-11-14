/**
 * Phase C — Probe OpenServ multi-turn tool loop
 * Run: node --experimental-strip-types --env-file=.env scripts/probe-tool-loop.ts
 */

const ENDPOINT = 'https://inference-api.openserv.ai/v1/chat/completions';
const KEY = process.env.SERV_API_KEY || '';
if (!KEY) { console.error('SERV_API_KEY not set'); process.exit(1); }

async function testToolLoop() {
  console.log('Testing 2-turn tool call and return on OpenServ...');

  const messages: any[] = [
    {
      role: 'system',
      content: 'You are an investigator. Always call get_action for index 0 first before concluding. Output strictly JSON: {"summary":"...","items":[]}'
    },
    {
      role: 'user',
      content: 'Investigate proposal action 0.'
    }
  ];

  const tools = [
    {
      type: 'function',
      function: {
        name: 'get_action',
        description: 'Fetch action at index',
        parameters: {
          type: 'object',
          properties: { index: { type: 'integer' } },
          required: ['index']
        }
      }
    }
  ];

  // Turn 1
  console.log('\n--- Turn 1: Sending prompt with tool definition ---');
  const res1 = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KEY.trim()}`,
      'User-Agent': 'Callscope/phase-c-probe'
    },
    body: JSON.stringify({
      model: 'serv-swift',
      messages,
      tools,
      tool_choice: 'auto',
      max_completion_tokens: 300,
      temperature: 0,
    })
  });

  const data1: any = await res1.json();
  console.log('Turn 1 HTTP:', res1.status);
  const choice1 = data1?.choices?.[0];
  const msg1 = choice1?.message;
  console.log('Turn 1 finish_reason:', choice1?.finish_reason);
  console.log('Turn 1 tool_calls:', JSON.stringify(msg1?.tool_calls));

  if (!msg1?.tool_calls || msg1.tool_calls.length === 0) {
    console.log('No tool calls in Turn 1.');
    return;
  }

  // Push assistant tool call message to history
  messages.push(msg1);

  // Execute tool
  for (const tc of msg1.tool_calls) {
    const fnName = tc.function.name;
    const args = JSON.parse(tc.function.arguments || '{}');
    console.log(`Executing tool ${fnName} with args:`, args);

    const toolResult = {
      evidenceId: 'tool-call-1',
      target: '0x1234567890123456789012345678901234567890',
      functionName: 'transfer',
      args: [{ name: 'to', value: '0xabc...' }, { name: 'amount', value: '1000' }]
    };

    messages.push({
      role: 'tool',
      tool_call_id: tc.id,
      content: JSON.stringify(toolResult)
    });
  }

  // Turn 2
  console.log('\n--- Turn 2: Sending tool observation back to model ---');
  const res2 = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KEY.trim()}`,
      'User-Agent': 'Callscope/phase-c-probe'
    },
    body: JSON.stringify({
      model: 'serv-swift',
      messages,
      tools,
      tool_choice: 'auto',
      max_completion_tokens: 500,
      temperature: 0,
    })
  });

  const data2: any = await res2.json();
  console.log('Turn 2 HTTP:', res2.status);
  const choice2 = data2?.choices?.[0];
  console.log('Turn 2 finish_reason:', choice2?.finish_reason);
  console.log('Turn 2 content:\n', choice2?.message?.content);
  console.log('Turn 2 tool_calls:', JSON.stringify(choice2?.message?.tool_calls));
}

testToolLoop().catch(console.error);

