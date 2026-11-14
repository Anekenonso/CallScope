# CallScope Architectural Decision Records (ADR)

This document captures the architectural decisions, rationale, and verified evidence supporting the CallScope governance analysis engine.

---

## ADR 01: Authoritative Deterministic Engine vs Advisory AI Sponsors

### Status
Accepted & Enforced

### Context
Public blockchain DAO proposals govern multi-million dollar treasuries and privileged access controls. Relying strictly on generative AI for binary voting decisions introduces risks of prompt injection, non-deterministic hallucinations, and variable latency.

### Decision
The core EVM deterministic engine is strictly authoritative. Sponsor AI outputs (OpenServ SERV and Dolphin Lighthouse) are strictly advisory.
- Authoritative outcomes (`no_significant_issue_detected`, `review_recommended`, `analysis_incomplete`) are generated in Phase 1 without AI dependencies.
- Phase 2 sponsor reviews can only escalate human attention or surface adversarial questions; they can never downgrade or alter the authoritative engine verdict.

### Evidence
- Invariance verification: [docs/evidence/phase-f-eval-results.md](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/docs/evidence/phase-f-eval-results.md)
- Automated unit test: [tests/unit/decoupled-baseline-consistency.test.ts](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/tests/unit/decoupled-baseline-consistency.test.ts)

---

## ADR 02: 3-Tier Latency Architecture

### Status
Accepted & Enforced

### Context
Live multi-turn LLM loops and adversarial reasoning models require 20–45 seconds of generation time, leading to poor user experience if executed synchronously.

### Decision
CallScope implements a 3-tier progressive disclosure model:
1. **Instant Tier**: Pure EVM deterministic analysis returned immediately (≤5s live, ≤150ms cached).
2. **Standard Tier**: Automatically triggered in the background after Instant; runs a single guarded OpenServ SERV call to extract proposal claims, verified against deterministic comparators (≤10–12s).
3. **Deep Tier**: User-triggered on demand; executes the multi-turn OpenServ SERV investigator tool loop and Dolphin Lighthouse adversarial scenario generation concurrently (≤25s).

### Evidence
- 3-tier API implementation: [api/_review.ts](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/api/_review.ts)
- Diagnostic timings benchmark: [server/budget.ts](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/server/budget.ts)

---

## ADR 03: Native OpenServ Marker Tools

### Status
Accepted & Enforced

### Context
Early implementations attempted to trigger OpenServ platform capabilities (prompt guard and shadow agent) via custom `extraBody` JSON fields, which did not conform to OpenServ's documented OpenAI-compatible tool specifications.

### Decision
Declare SERV platform capabilities as native marker tools within the OpenAI-compatible `tools` array:
- `serv_prompt_guard`: `{ type: 'function', function: { name: 'serv_prompt_guard' } }`
- `serv_shadow_agent`: `{ type: 'function', function: { name: 'serv_shadow_agent', parameters: { ... } } }`
Keep client function tools (`get_action`, `check_role_capabilities`) alongside marker tools in the same array with `reasoning_effort: 'low'`.

### Evidence
- Integration code: [server/providers/serv.ts](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/server/providers/serv.ts)
- Raw provider response artifact: [docs/evidence/raw/phase-b-serv-api.md](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/docs/evidence/raw/phase-b-serv-api.md)

---

## ADR 04: Single Canonical SERV Model Resolver

### Status
Accepted & Enforced

### Context
Disparate scripts and modules previously had conflicting fallback model strings (`serv-mini`, `4o-mini`, `serv-swift`).

### Decision
Centralize all model resolution in `server/providers/serv-model.ts`.
- Validates against live OpenServ catalog (`eval/serv-model-catalog.json`).
- Throws at server startup on any unsupported model ID.
- Pins `serv-swift` (OpenServ's low-latency, cost-effective Haiku-class tier) as default.

### Evidence
- Model catalog: [eval/serv-model-catalog.json](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/eval/serv-model-catalog.json)
- Unit tests: [tests/unit/serv-model.test.ts](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/tests/unit/serv-model.test.ts)

---

## ADR 05: Scenario-Specific Rebuttal Logic

### Status
Accepted & Enforced

### Context
Adversarial scenario reviews from Dolphin previously received identical generic rebuttal strings ("schedule() capability") across distinct scenario classes.

### Decision
Implement targeted, scenario-specific deterministic rebuttal checks in `server/providers/dolphin.ts`:
- Privilege execution → Checked against role capabilities in verified contracts.
- Self-escalation → Checked against `DEFAULT_ADMIN_ROLE` or role grant authority.
- Term permanence → Checked against explicit expiration or revocation calldata.
- Conservative invariant: If recipient contract is unverified on Blockscout, attack scenarios can never be marked `refuted_by_data`.

### Evidence
- Implementation: [server/providers/dolphin.ts](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/server/providers/dolphin.ts)
- Regression test: [tests/unit/dolphin-scenarios.test.ts](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/tests/unit/dolphin-scenarios.test.ts)

---

## ADR 06: Hermetic Test Harness with Zero Network Access

### Status
Accepted & Enforced

### Context
Unit test runs previously depended on public JSON-RPC endpoints (`base-rpc.publicnode.com`, `eth.blockscout.com`), causing CI flakiness, rate-limit 429s, and 45-second timeouts.

### Decision
Enforce 100% offline hermetic testing via `tests/setup-hermetic.ts`:
- Intercepts `globalThis.fetch` during test execution.
- Replays pre-recorded RPC receipts and contract ABIs from `server/fixtures/hermetic-recordings.json`.
- Throws a descriptive `Hermetic Test Violation` on any unmocked outbound network call.

### Evidence
- Setup configuration: [tests/setup-hermetic.ts](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/tests/setup-hermetic.ts)
- Recorded fixtures: [server/fixtures/hermetic-recordings.json](file:///c:/Users/USER/Documents/Software Development/AI SaaS/CallScope/server/fixtures/hermetic-recordings.json)
- Test suite run: 30 test files pass in <60 seconds offline.
