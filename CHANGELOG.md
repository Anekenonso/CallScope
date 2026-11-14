# CallScope Changelog

All notable changes to the CallScope DAO governance analysis engine are documented in this file.

---

## [1.0.0] - 2026-11-14 (Final Submission Release)

### Performance & Architecture
- **3-Tier Analysis Flow**:
  - **Instant Tier (≤5s)**: Purely deterministic on-chain EVM assessment without AI latency.
  - **Standard Tier (≤10-12s)**: Automated single-call OpenServ SERV claim extraction with deterministic ledger comparison.
  - **Deep Tier (≤25s)**: On-demand concurrent OpenServ multi-turn investigator tool loop + Dolphin Lighthouse multi-scenario stress test.
- **Per-Stage Diagnostic Timings**: Added fine-grained microsecond stage timers to API responses (`eventLookupMs`, `abiResolutionMs`, `roleCapabilitiesMs`, `assessmentMs`, etc.).
- **Hermetic Testing Harness**: Zero outbound network during testing via `tests/setup-hermetic.ts` and pre-recorded RPC fixtures in `server/fixtures/hermetic-recordings.json`. All 30 unit tests pass offline in <60 seconds.

### OpenServ SERV Native Integration
- **Marker Tools Declaration**: Converted SERV tools to native OpenServ marker tools (`serv_prompt_guard`, `serv_shadow_agent`) in the OpenAI-compatible `tools` array per official specifications.
- **Model Resolver & Catalog Validation**: Created `server/providers/serv-model.ts` validating `SERV_MODEL` against live API catalog in `eval/serv-model-catalog.json` (`serv-swift` pinned as default).
- **Injection Defense**: Separated local pre-check from remote prompt guard; eliminated speculative string matching.

### Dolphin Lighthouse Refinement
- **Scenario-Specific Rebuttal Checks**: Attack scenarios are audited against concrete action capabilities (self-escalation, term permanence, treasury drains) rather than generic strings.
- **Proposer Key Questions**: Emits targeted, actionable questions for delegates before voting.
- **Conservative Rebuttal Invariant**: Attack scenarios referencing unverified contracts or verified PROPOSER_ROLE powers are never marked `refuted_by_data`.

### Budget & Safety Controls
- **Spend Tracking & Daily Caps**: Implemented `server/budget.ts` tracking spend against `SERV_DAILY_CAP_USD` and `DOLPHIN_DAILY_CAP_USD`.
- **Emergency Kill Switch**: Instant AI bypass when `AI_PAUSED=true` with UI fallback to deterministic baseline.
- **Stored Live Reviews**: Pinned canonical proposals serve timestamped live recordings (`recorded live on 2026-11-14`) so evaluating judges spend zero API credits.
- **Zod Request Validation**: Added Zod schemas at API boundaries (`/api/analyse`, `/api/review`) and startup environment validation.

---

## [0.2.0] - 2026-11-12 (Sponsor Intelligence & Evaluation Upgrade)

### Features
- **OpenServ SERV Integration**: Multi-turn ReAct investigator loop utilizing EVM lookup tools (`get_proposal_details`, `get_action`, `check_role_capabilities`, `get_recipient_profile`).
- **Dolphin Lighthouse Integration**: Adversarial threat modeling powered by `deepseek-ai/DeepSeek-V4.1-Flash` on Dolphin Lighthouse.
- **Two-Phase API**: Decoupled immediate deterministic response (`/api/analyse`) from background sponsor advisory review (`/api/review`).
- **Evaluation Harness**: Added reproducible contribution harness (`eval/sponsor-contribution.ts`) verifying 100% authoritative invariance.

---

## [0.1.0] - 2026-11-10 (Authoritative Deterministic Engine)

### Core Engine
- On-chain `ProposalCreated` event retrieval across Ethereum Mainnet and Base.
- Transaction hash and block explorer URL input resolution.
- Calldata decoding via Blockscout smart contract ABIs and local ERC20/ERC721/Timelock interfaces.
- Static role capability resolution on OpenZeppelin `AccessControl` and `TimelockController`.
- Description-vs-calldata consistency verification and 3-state governance assessment (`no_significant_issue_detected`, `review_recommended`, `analysis_incomplete`).
