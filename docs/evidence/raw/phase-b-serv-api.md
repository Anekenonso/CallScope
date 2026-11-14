# Phase B — OpenServ SERV API Verification Evidence

**Date:** 2026-11-12  
**Probes run:** 8 (across 3 scripts)  
**Endpoint:** `https://inference-api.openserv.ai/v1/chat/completions`  
**Models endpoint:** `https://inference-api.openserv.ai/v1/models` (HTTP 200 ✅)

---

## Finding 1: `serv-mini` does not exist — model was `4o-mini` (also invalid)

The `.env.example` and fallback in `serv.ts` both reference `serv-mini`.  
The `.env` on this machine has `SERV_MODEL=4o-mini`.  
**Neither model exists** in the OpenServ model catalogue.

**Valid SERV-branded models (confirmed from `/v1/models`):**

| modelId | displayName | Input (per M) | Output (per M) | Context |
|---|---|---|---|---|
| `serv-swift` | serv-swift | \$125 | \$650 | 200K |
| `serv-standard` | serv-standard | \$375 | \$2000 | 200K |
| `serv-pro` | serv-pro | \$450 | \$2500 | 1M |
| `serv-ultra` | serv-ultra | \$650 | \$3250 | 200K |

**Underlying model revealed:** `serv-swift` → `claude-haiku-4-5-20251001` (returned in API response)

**Recommended default:** `serv-swift` — cheapest, 200K context, sufficient for proposal analysis.

---

## Finding 2: `response_format: { type: 'json_object' }` is NOT supported

All calls with `response_format: { type: 'json_object' }` returned:
```
HTTP 400 — "response_format.type: Input should be 'json_schema'"
```

`response_format: { type: 'json_schema', json_schema: { ..., strict: true } }` is required, but also fails unless `strict` is explicitly provided.

**Decision:** Remove `responseFormat` from the SERV call entirely. The existing `extractStructuredJson()` already handles JSON extraction from free-form text. The system prompt already instructs JSON-only output — this is sufficient and battle-tested.

---

## Finding 3: Native params (`serv_prompt_guard`, `serv_shadow_agent`, `reasoning_effort`) — ACCEPTED

Calls with these extra body fields **did not cause HTTP 400**.  
They are silently accepted by the API (not reflected in the response body).

**Truthful label:** *"Declared in system prompt. Also passed as extra body fields — accepted by the OpenServ API without error. Cannot distinguish 'honoured' from 'silently ignored' without internal access."*

The system prompt declaration is the guaranteed active layer. The extra body fields are retained as they cause no harm.

---

## Finding 4: Tool-calling — FULLY SUPPORTED ✅

```
[4-tools-with-schema]
  HTTP: 200 | 880ms | model: claude-haiku-4-5-20251001
  finish_reason: tool_calls
  tool_calls: 1 → {"name":"get_action","arguments":"{\"index\": 0}"}
```

The model **invokes tools** when asked. The API returns `finish_reason: "tool_calls"` and a `tool_calls` array with the function name and arguments.

**This enables a real ReAct agentic loop in Phase C.**

---

## Code Changes Required (Phase B)

| # | Change | File | Reason |
|---|---|---|---|
| 1 | Change `SERV_MODEL` default from `serv-mini` to `serv-swift` | `server/providers/serv.ts` | `serv-mini` doesn't exist |
| 2 | Update `.env.example` model to `serv-swift` | `.env.example` | Correct default |
| 3 | Remove `responseFormat: { type: 'json_object' }` from SERV API call | `server/providers/serv.ts`, `server/analysis/claims-ledger.ts` | Returns HTTP 400 |
| 4 | Keep `serv_prompt_guard`, `serv_shadow_agent`, `reasoning_effort` in `extraBody` | `server/providers/serv.ts` | Accepted by API without error |
| 5 | Implement real ReAct tool loop (Phase C) | `server/providers/serv.ts` | Tool-calling confirmed working |

---

## Raw Evidence Files

- `docs/evidence/raw/phase-b-serv-api.json` — initial probe (4 tests)
- `docs/evidence/raw/phase-b-serv-models.json` — model-corrected probe (4 tests)  
- `docs/evidence/raw/phase-b-serv-final.json` — final probe (4 tests)

