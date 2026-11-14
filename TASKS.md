# Implementation Tasks

## Execution protocol
- Work in order and within the current approved phase.
- Complete tasks in the phase, run focused checks, and update `PROGRESS.md`.
- At the end of each phase, send the user a stage report and wait for explicit confirmation before beginning the next phase.
- Routine decisions inside the current phase do not require approval when already covered by the specifications.
- Credential-dependent work has a hard stop: when a real key is required, stop, explain which key is needed and why, and wait for the user to configure it locally and confirm. Do not continue that task using invented credentials or silently skip its live test.
- Mark tasks `DONE`, `IN PROGRESS`, `BLOCKED`, or `NOT STARTED`. Do not mark a task done on intention alone.

## Phase 0 — Read and prepare
- [x] T0.1 Read `Agent.md`, `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `RULES.md`, `TASKS.md`, and `PROGRESS.md`.
- [x] T0.2 Inspect the repository before changing anything. Preserve useful existing work; do not overwrite blindly.
- [x] T0.3 Confirm Node/npm versions and available scripts.
- [x] T0.4 Record baseline build/test status in `PROGRESS.md`.
- [x] T0.5 Create `.env.example` with documented variable names and no secrets.

## Phase 1 — Minimal application foundation
- [x] T1.1 Configure Vite + React + TypeScript with strict mode.
- [x] T1.2 Add only required dependencies.
- [x] T1.3 Configure Tailwind only if used; implement design tokens from `DESIGN.md`.
- [x] T1.4 Add Vercel serverless API route wiring.
- [x] T1.5 Add typed request/response/error contracts.
- [x] T1.6 Verify dev server and production build.

## Phase 2 — Chain access and proposal retrieval
- [x] T2.1 Implement allowlisted Ethereum/Base network configuration.
- [x] T2.2 Implement RPC clients and chain ID verification.
- [x] T2.3 Validate Governor address and contract bytecode.
- [x] T2.4 Implement supported `ProposalCreated` event ABI variants.
- [x] T2.5 Implement indexed proposal ID filtering and bounded adaptive log retrieval.
- [x] T2.6 Verify exact event identity and reject ambiguous/malformed results.
- [x] T2.7 Read current Governor proposal state and map supported enum values.
- [x] T2.8 Add unit tests for event parsing, range handling, state mapping and failures.

## Phase 3 — ABI resolution and action decoding
- [x] T3.1 Implement verified ABI retrieval using the chosen Blockscout endpoint(s).
- [x] T3.2 Implement proxy implementation ABI resolution where verifiable.
- [x] T3.3 Decode selector-prefixed calldata.
- [x] T3.4 Decode legacy separate signatures and argument calldata.
- [x] T3.5 Preserve raw target/value/signature/selector/calldata for every action.
- [x] T3.6 Validate action-array lengths and retain action order.
- [x] T3.7 Represent unknown ABI/function and unsupported nested calls as explicit limitations.
- [x] T3.8 Add tests for known, unknown, malformed and proxy targets.

## Phase 4 — Deterministic assessment
- [x] T4.1 Implement the initial sensitive-operation rules in `PRD.md`.
- [x] T4.2 Decode and display relevant arguments for each finding.
- [x] T4.3 Implement evidence-backed role semantics; unknown when not verifiable.
- [x] T4.4 Implement deterministic description/action comparison inputs and result contract.
- [x] T4.5 Implement assessment precedence exactly as specified.
- [x] T4.6 Add tests proving incomplete/undecoded actions cannot produce a clean outcome.
- [x] T4.7 Add ENS and Unlock regression fixtures and assertions.

## Phase 5 — Sponsor integrations
- [x] T5.1 Implement shared bounded OpenAI-compatible HTTP helper.
- [x] T5.2 Implement SERV adapter using server-side `SERV_API_KEY` and `SERV_MODEL`.
- [x] T5.3 Implement Dolphin adapter using server-side `DOLPHIN_API_KEY` and `DOLPHIN_MODEL`.
- [x] T5.4 Add prompt-injection-resistant prompts that treat proposal content as untrusted data.
- [x] T5.5 Validate structured provider responses; reject malformed output.
- [x] T5.6 Add timeout, output-size and provider-error handling.
- [x] T5.7 Add mocked tests for success, missing credentials, 401, 402, 404, 429, 5xx, timeout and malformed output.
- [x] T5.8 **CREDENTIAL GATE:** before any authenticated provider call, stop and ask the user to configure the required key(s) locally; wait for confirmation. Never request keys in chat.
- [x] T5.9 After user confirmation, verify required variables are present without displaying values, then run one minimal authenticated call to each provider and record exact outcomes.

## Phase 6 — UI
- [x] T6.1 Implement the compact header and analysis form.
- [x] T6.2 Implement loading, validation and error states.
- [x] T6.3 Implement assessment banner with only the three approved outcomes.
- [x] T6.4 Implement proposal details and current status.
- [x] T6.5 Implement action list with inspectable raw/decoded details.
- [x] T6.6 Implement findings and description consistency.
- [x] T6.7 Implement SERV and Dolphin review summaries with availability states.
- [x] T6.8 Implement evidence links from actual returned data.
- [x] T6.9 Verify keyboard accessibility, contrast and 320px mobile layout.
- [x] T6.10 Remove any unnecessary copy, labels, cards, icons or visual decoration.

## Phase 7 — Integration and pressure testing
- [x] T7.1 Run ENS Ethereum fixture end-to-end against live chain data where RPC credentials permit.
- [x] T7.2 Run Unlock Base fixture end-to-end against live chain data where RPC credentials permit.
- [x] T7.3 Verify the expected ENS `grantRole` operation and interpretation.
- [x] T7.4 Verify all six Unlock `transfer()` actions and their decoded arguments.
- [x] T7.5 Test wrong network, invalid address, no contract code, unknown proposal, unsupported Governor, RPC outage and log scan limit.
- [x] T7.6 Test unknown ABI, unknown selector, malformed arrays and partially undecoded actions.
- [x] T7.7 Test each sponsor provider failure independently.
- [x] T7.8 Test malicious instructions embedded in proposal descriptions.
- [x] T7.9 Verify no secret appears in browser bundle, API response or logs.

## Phase 8 — Final quality and deployment
- [x] T8.1 Run `npm run typecheck`.
- [x] T8.2 Run `npm run lint` if configured.
- [x] T8.3 Run `npm run test`.
- [x] T8.4 Run `npm run build`.
- [x] T8.5 Fix all actionable failures; do not suppress tests.
- [x] T8.6 Configure Vercel environment variables without committing secrets.
- [x] T8.7 Deploy and smoke-test the deployed app.
- [x] T8.8 Verify both networks and both sponsor integrations or explicitly disclose provider credential limitations.
- [x] T8.9 Update `PROGRESS.md` with exact commands, outcomes, deployment URL and known limitations.
- [x] T8.10 Prepare concise hackathon demo steps using the ENS and Unlock fixtures.

## Core Reliability Hardening (Post-Audit)
- [x] R1. Historical proposal retrieval: adaptive bounded RPC log retrieval, snapshot value timepoint conversion, zero hardcoded block hints, parallel chunk batching.
- [x] R2. Role verification: distinction between verified contract semantics, recognized standard OpenZeppelin hashes, and unknown roles; preservation of semantic uncertainty.
- [x] R3. Description consistency: corrected `transferFrom` recipient extraction (arg 1), explicit claimed amount checking under 1/6/18 decimals, removed keyword bypass, honest `indeterminate` state.
- [x] R4. Sponsor & API reliability: 64KB body size limit, IP sliding-window rate limiting, 20s bounded timeout race on sponsor reviews, error sanitization stripping paths and secrets.
- [x] R5. Results & progress integrity: clear results on new analysis request (`setResult(null)`), removal of fabricated timed progress stages, honest indeterminate shimmer and active pipeline overview.
- [x] R6. Test integrity: fixed build prerequisite ordering in pressure tests, added explicit `skipIf` and live validation in sponsor tests, added regression suite covering all reliability criteria.

## UI/UX & Brand Polish (Post-Reliability)
- [x] U1. OpenServ Console aesthetic: applied dark developer console tokens (`#090A0D` canvas, `#12151B` surface, hairline borders, high contrast).
- [x] U2. Brand identity: custom vector SVG DAO governance logo mark and matching `public/favicon.svg` with modern typography (`JetBrains Mono`, `Plus Jakarta Sans`).
- [x] U3. Micro-interactions: interactive preset pills (`ETH · ENS EP 6.50`, `BASE · Unlock Transfers`), staggered animation wave for progress indicators, and quiet console footer.
- [x] U4. All 112 tests verified green; production Vite bundle built and pushed to GitHub `origin/master`.

## Production Deployment Fix (Vercel Serverless Invocation & Error Resilience)
- [x] P1. Root cause diagnosis: identified Vercel Node runtime mismatch (`FUNCTION_INVOCATION_FAILED` due to missing Web Standard Request/Response export, unbundled ESM relative imports, and 10s default serverless timeout).
- [x] P2. Universal API handler: implemented dual Web Standard (`POST`, `GET`, `Request -> Response`) and Node.js (`req, res`) handler in `api/analyse.ts`.
- [x] P3. Serverless function configuration: added `"functions": { "api/analyse.ts": { "maxDuration": 60, "memory": 1024 } }` to `vercel.json`.
- [x] P4. Frontend error resilience: hardened `src/lib/api-client.ts` to safely parse text/json error bodies and surface human-readable HTTP errors instead of raw `SyntaxError: Unexpected token 'A'`.
- [x] P5. Automated test coverage: verified all unit tests pass, added explicit Web Standard Request test cases in `tests/unit/api-handler.test.ts`.
- [x] P6. Production deployment and live verification: push fix to GitHub `origin/master`, wait for Vercel deployment, and test both ENS Ethereum and Unlock Base fixtures against the live URL.

## Protected Incremental Upgrade (Phases A–I)
- [x] Phase A: Baseline and protection (tag `callscope-pre-upgrade-2026-11-12`, branch `upgrade/protected-incremental-build`, implementation plan)
- [x] Phase B: SERV model and API verification (`serv-swift`, remove `response_format`, verify parameters)
- [x] Phase C: SERV native integration (multi-turn ReAct tool execution loop, tool citation gate)
- [x] Phase D: Dolphin verification and rebuttal loop (`deepseek-ai/DeepSeek-V4.1-Flash` on Lighthouse, token tuning, engine rebuttal)
- [x] Phase E: Live ablation benchmark (ENS EP 6.50 & Unlock Base, unfloored latency, 100% invariance, `docs/sponsor-impact.md`)
- [x] Phase F: Eval harness (`eval/sponsor-contribution.ts`, scoring SERV claims and Dolphin attack scenarios)
- [x] Phase G: UI evidence and attribution (tool citations, turn count, Tri-Reviewer Agreement Strip)
- [x] Phase H: Final gate, README and demo script (live benchmark numbers, 10-minute copy audit)
- [x] Phase I: Deploy preview, smoke test, and human promotion gate (preview verification before master merge)

## Mandatory phase reporting
At the end of Phases 0–8:
1. Update this checklist and `PROGRESS.md`.
2. Send the user a concise report of completed work, changed files, tests and results, blockers, and next phase.
3. Wait for the user's confirmation before starting the next phase.

If Phase 5 reaches the credential gate, stop and wait for the user to configure the key(s) and confirm. Do not proceed with authenticated calls until then.

## Definition of done
The product is done only when:
- All acceptance criteria in `PRD.md` are met.
- Both reference fixtures pass.
- The app is responsive and usable.
- Build, typecheck and tests pass.
- No secrets are exposed.
- Assessment logic fails safely.
- Deployment is smoke-tested.
- `PROGRESS.md` accurately describes verified status and remaining limitations.
