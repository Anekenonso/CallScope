# Phase C — OpenServ SERV Multi-Turn ReAct Tool Loop Evidence

**Date:** 2026-11-14  
**Feature:** Multi-turn ReAct tool execution loop for OpenServ SERV investigator  
**Test Suite:** Unit tests (`tests/unit/serv-investigator.test.ts`), Live tests (`tests/live/sponsor-live.test.ts`), and Probe (`scripts/probe-tool-loop.ts`)

---

## 1. Architectural Upgrade

Prior to Phase C, CallScope pre-executed several tools and pasted an evidence summary into the prompt, without enabling the model to dynamically request further information or iterate across turns.

In Phase C:
- Implemented `callOpenAiChatTurn` in `server/providers/openai-compatible.ts`, supporting OpenAI/Anthropic multi-turn tool calling schemas (`tools`, `tool_choice`, `role: 'assistant'` with `tool_calls`, and `role: 'tool'` observations).
- Upgraded `reviewWithServ` in `server/providers/serv.ts` into a true multi-turn ReAct investigator:
  1. Seeds base proposal state and action bounds into `ServToolEngine`.
  2. Sends initial investigation prompt equipped with 5 engine tools (`get_action`, `get_role_capabilities`, `get_recipient_profile`, `get_token_metadata`, `get_description_section`).
  3. If model requests tool calls, dynamically executes them via `engine.execute(toolName, args)`, logs evidence records with unique `evidenceId`s, appends `role: 'tool'` observations, and queries the model for the next turn.
  4. Bounds execution to a safe 4-turn ceiling and 15s per-turn timeout to conform with Vercel serverless limits.
  5. Enforces the strict tool evidence citation gate: every emitted item must cite a valid `evidenceId` generated during the investigation.
  6. Tracks `loopTurns` and `toolCallCount` on the `ProviderReview` object for transparency.

---

## 2. Empirical Verification Results

### A. Live Two-Turn Probe (`scripts/probe-tool-loop.ts`)
```text
--- Turn 1: Sending prompt with tool definition ---
Turn 1 HTTP: 200
Turn 1 finish_reason: tool_calls
Turn 1 tool_calls: [{"id":"toolu_017PJjhNJUYqT1RyS9Gq1bji","type":"function","function":{"name":"get_action","arguments":"{\"index\": 0}"}}]
Executing tool get_action with args: { index: 0 }

--- Turn 2: Sending tool observation back to model ---
Turn 2 HTTP: 200
Turn 2 finish_reason: stop
```
Proved:
- OpenServ gateway accepts OpenAI-compatible tool definitions.
- Model produces structured tool calls with valid JSON arguments.
- OpenServ processes `role: 'tool'` message responses with matching `tool_call_id`.
- Total round-trip across 2 turns completed in ~9 seconds.

### B. Offline Unit Test Suite (`tests/unit/serv-investigator.test.ts`)
- Added comprehensive unit test `Phase C: Multi-Turn ReAct Tool Loop`:
  - Mocks Turn 1 tool call (`get_token_metadata`) and Turn 2 final review citing the dynamic `tool-call-5` evidence ID.
  - Verified `loopTurns: 2`, `toolCallCount >= 5`, and valid evidence citation filtering.
- All 13 tests in `serv-investigator.test.ts` passed (33ms).
- All 224 unit tests across 26 test files passed offline (0 failures).

### C. Live Authenticated Test (`tests/live/sponsor-live.test.ts`)
- Executed against live OpenServ inference API with real credentials:
  - Status: `ok`
  - Total latency: 7,303ms
  - Findings returned: 3
  - Summary: `"Analysis complete."`

---

## 3. Code Modifications
- `src/types/analysis.ts`: Added `toolCallCount?: number` and `loopTurns?: number` to `ProviderReview`.
- `server/providers/openai-compatible.ts`: Added `ChatMessage`, `CallChatTurnOptions`, `ChatTurnResult`, and `callOpenAiChatTurn`.
- `server/providers/serv.ts`: Replaced static call with multi-turn ReAct loop; attached execution metadata to return object.
- `vite.config.ts`: Adjusted test include pattern to accommodate `tests/live/` test runner.
- `tests/unit/serv-investigator.test.ts`: Added multi-turn ReAct unit test.
- `tests/live/sponsor-live.test.ts`: Updated assertion to accept standard status `'ok'`.

