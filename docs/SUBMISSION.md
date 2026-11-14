# CallScope — Hackathon Submission Pack

**Project Title:** CallScope  
**Canonical Production URL:** [https://callscope-five.vercel.app](https://callscope-five.vercel.app)  
**Repository:** [https://github.com/Anekenonso/CallScope](https://github.com/Anekenonso/CallScope)  
**Core Mission:** Deterministic DAO proposal calldata intelligence with advisory multi-agent review.

---

## 1. Track Requirements & Implementation Matrix

### Track 1: OpenServ SERV

| Track Requirement | CallScope Implementation | Implementation Code | Verifiable Evidence Artifact |
| :--- | :--- | :--- | :--- |
| **Model Resolution & Validation** | Single canonical resolver reading `SERV_MODEL`, validating against official catalog from `/v1/models`, throwing at startup on unknown models. | [`server/providers/serv-model.ts`](file:///server/providers/serv-model.ts) | [`eval/serv-model-catalog.json`](file:///eval/serv-model-catalog.json) |
| **Candidate Model Benchmarking** | Empirical comparison of `serv-swift` vs `serv-standard` on ENS & Unlock descriptions (latency, validity, cost). | [`scripts/run-model-comparison.ts`](file:///scripts/run-model-comparison.ts) | [`docs/model-selection.md`](file:///docs/model-selection.md)<br>[`docs/evidence/raw/model-comparison-2026-11-14.json`](file:///docs/evidence/raw/model-comparison-2026-11-14.json) |
| **Native Feature Declaration** | SERV Tools declared as native marker tools in `tools` array (`serv_prompt_guard` & `serv_shadow_agent`) alongside engine tools. | [`server/providers/serv.ts`](file:///server/providers/serv.ts)<br>[`server/analysis/claims-ledger.ts`](file:///server/analysis/claims-ledger.ts) | [`scripts/run-guard-experiment.ts`](file:///scripts/run-guard-experiment.ts) |
| **Prompt Guard Experiment** | Live test with known injection string with and without guard marker; tested 4 pinned descriptions for false positives. | [`scripts/run-guard-experiment.ts`](file:///scripts/run-guard-experiment.ts) | [`docs/evidence/raw/guard-2026-11-14.json`](file:///docs/evidence/raw/guard-2026-11-14.json) |
| **Fast Standard Claims Extraction** | One guarded SERV call extracting textual claims; verified by deterministic comparators against actions; no multi-turn blocking. | [`server/analysis/claims-ledger.ts`](file:///server/analysis/claims-ledger.ts)<br>[`api/_review.ts`](file:///api/_review.ts) | [`docs/evidence/raw/latency-2026-11-14.json`](file:///docs/evidence/raw/latency-2026-11-14.json) |
| **Multi-Turn Investigator Loop** | ReAct tool loop (up to 3 turns) executing against 5 deterministic application tools (`get_action`, `get_role_capabilities`, etc.). | [`server/providers/serv.ts`](file:///server/providers/serv.ts) | [`tests/unit/serv-investigator.test.ts`](file:///tests/unit/serv-investigator.test.ts) |
| **Honest Catalog Pricing** | Corrected unit pricing ($0.125 / 1M prompt, $0.650 / 1M completion) matching OpenServ API catalog. | [`server/providers/serv-model.ts`](file:///server/providers/serv-model.ts)<br>[`server/budget.ts`](file:///server/budget.ts) | [`eval/serv-model-catalog.json`](file:///eval/serv-model-catalog.json) |

---

### Track 2: Dolphin Lighthouse

| Track Requirement | CallScope Implementation | Implementation Code | Verifiable Evidence Artifact |
| :--- | :--- | :--- | :--- |
| **Honest Model Attribution** | Returned model ID displayed transparently in UI, exports, and diagnostics (`Dolphin Lighthouse · <model>`). | [`src/components/ProviderReviews.tsx`](file:///src/components/ProviderReviews.tsx)<br>[`server/providers/dolphin.ts`](file:///server/providers/dolphin.ts) | [`tests/unit/dolphin-scenarios.test.ts`](file:///tests/unit/dolphin-scenarios.test.ts) |
| **Adversarial Scenario Generation** | Generates concrete multi-step attack scenarios targeting authorization bypasses, unverified destinations, and execution hazards. | [`server/providers/dolphin.ts`](file:///server/providers/dolphin.ts) | [`tests/unit/dolphin-scenarios.test.ts`](file:///tests/unit/dolphin-scenarios.test.ts) |
| **Scenario-Specific Rebuttal Checks** | `evaluateScenarioRebuttal` checks privilege use vs role capability, expiry claims vs revocation actions, and self-escalation vs granting powers. | [`server/analysis/scenario-rebuttal.ts`](file:///server/analysis/scenario-rebuttal.ts) | [`tests/unit/scenario-rebuttal.test.ts`](file:///tests/unit/scenario-rebuttal.test.ts) |
| **Regression Protection** | Fails if distinct scenario types receive identical evidence strings. Source verified never equates to `refuted_by_data`. | [`tests/unit/scenario-rebuttal.test.ts`](file:///tests/unit/scenario-rebuttal.test.ts) | [`tests/unit/scenario-rebuttal.test.ts`](file:///tests/unit/scenario-rebuttal.test.ts) |
| **Delegate Proposer Questions** | Generates targeted, plain-language questions for delegates to ask proposers on governance forums. | [`server/providers/dolphin.ts`](file:///server/providers/dolphin.ts)<br>[`src/components/ProviderReviews.tsx`](file:///src/components/ProviderReviews.tsx) | [`tests/unit/dolphin-scenarios.test.ts`](file:///tests/unit/dolphin-scenarios.test.ts) |

---

## 2. Core Architectural Guarantees

### Deterministic Engine Authoritative
- EVM calldata decoding via `viem`, Solidity AST parsing via `@solidity-parser/parser`, and recipient bytecode inspection are strictly authoritative.
- Assessment verdicts (`review_recommended` > `analysis_incomplete` > `no_significant_issue_detected`) are computed solely by the deterministic engine.
- Sponsor AI reviews are advisory only. They cannot alter findings, downgrade severities, or dictate verdicts.

### Baseline Invariance
- Baseline assessments stay invariant across all sponsor states: enabled, disabled, timeout, rate-limited, or prompt-injected.
- Verified by [`tests/unit/decoupled-baseline-consistency.test.ts`](file:///tests/unit/decoupled-baseline-consistency.test.ts).

### 3-Tier Analysis Flow
1. **Instant Tier:** Deterministic baseline only. Measured p50: 3,242 ms cold / 0 ms cached across 25 proposals.
2. **Standard Tier:** Guarded SERV extraction + deterministic Claims Ledger comparators. Measured p50: 1,200 ms.
3. **Deep Tier:** Multi-turn SERV tool loop + Dolphin adversarial stress-testing on demand. Measured p50: 8,500 ms live / 5 ms stored pinned.

---

## 3. Credit & Cost Protection

- **Spend Tracking:** Metered from API reported token usage and recorded in [`docs/spend-log.md`](file:///docs/spend-log.md).
- **Daily Caps:** Configurable via `SERV_DAILY_CAP_USD` and `DOLPHIN_DAILY_CAP_USD` (default: $1.00/day).
- **Emergency Kill Switch:** `AI_PAUSED=true` immediately bypasses AI calls while keeping the deterministic baseline 100% functional.
- **Judge Credit Buffer:** >$0.50 preserved untouched. Pinned examples serve stored live outputs so judges consume zero credits during testing.

---

## 4. Hermetic Test Harness & Verification

- **Outbound Network Blocking:** `tests/setup-hermetic.ts` intercepts outbound `fetch` and RPC requests during `pnpm test`, guaranteeing tests run hermetically offline.
- **Test Suite Status:** 253 automated tests across 30 test files pass 100% green and offline.
- **Consistency Verification:** `pnpm check:readme` enforces consistency between documentation, code constants, RPC gateways, and fixtures.

---

## 5. Key Evidence Artifacts

1. **Prompt Guard Experiment Raw JSON**: [`docs/evidence/raw/guard-2026-11-14.json`](file:///docs/evidence/raw/guard-2026-11-14.json)
2. **Model Selection Benchmark Raw JSON**: [`docs/evidence/raw/model-comparison-2026-11-14.json`](file:///docs/evidence/raw/model-comparison-2026-11-14.json)
3. **Model Selection Report**: [`docs/model-selection.md`](file:///docs/model-selection.md)
4. **3-Tier Latency Benchmark Raw JSON**: [`docs/evidence/raw/latency-2026-11-14.json`](file:///docs/evidence/raw/latency-2026-11-14.json)
5. **25-Proposal Success Table Raw JSON**: [`docs/evidence/raw/proposals-success-2026-11-14.json`](file:///docs/evidence/raw/proposals-success-2026-11-14.json)
6. **25-Proposal Success Table Report**: [`docs/instant-success-table.md`](file:///docs/instant-success-table.md)
7. **Architectural Decisions (ADRs 01–06)**: [`docs/decisions.md`](file:///docs/decisions.md)
8. **Changelog**: [`CHANGELOG.md`](file:///CHANGELOG.md)
9. **API Spend Log**: [`docs/spend-log.md`](file:///docs/spend-log.md)
10. **Demo Video Script**: [`docs/demo-script.md`](file:///docs/demo-script.md)
