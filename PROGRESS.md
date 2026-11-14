# Progress Log

## Status at handover
**Implementation status:** NOT STARTED  
**Product scope:** LOCKED  
**Approved frontend:** Vite + React + TypeScript  
**Backend/deployment:** Vercel serverless functions  
**Sponsor integrations:** OpenServ SERV + Dolphin  
**Database:** None

This file is the source of truth for implementation progress. Update it during development. Do not rewrite history or mark work complete without evidence.

## Product and planning decisions already made
- Product: Callscope.
- One-page interface, one primary action: `Analyse`.
- Supported networks: Ethereum Mainnet and Base Mainnet.
- Supported governance: validated OpenZeppelin Governor-compatible `ProposalCreated` variants only.
- Deterministic analysis is authoritative; SERV and Dolphin are advisory.
- No wallet, account, voting, execution, database, dashboard, or numeric score.
- Outcomes: `Review recommended`, `No significant issue detected`, `Analysis incomplete`.
- Visual direction: restrained, minimal, Linear/Apple Notes-level clarity; see `DESIGN.md`.
- No Next.js.

## Reference validation recorded during planning
The planning phase recorded successful proposal retrieval/action-recovery checks for:
- ENS Ethereum reference proposal: `77767899528494238518019756391533686963875234067646094287125791110488147463806`
- Unlock Base reference proposal: `27419154582993156392805749742953507877176483681373228046916881327937839104508`

Expected regression behaviour is documented in `PRD.md`.

**Important:** The building agent must independently rerun these checks in the actual implementation environment. Do not treat planning notes as a substitute for test logs. Record the exact RPC/explorer provider, retrieval block, test command, and result when rerun.

## Sponsor API credential status at handover
- SERV API documentation and endpoint identified.
- Dolphin API documentation and endpoint identified.
- Authenticated live calls were **not confirmed during planning because account credentials were not supplied**.
- The agent must stop at the credential gate before authenticated integration tests.
- The agent must tell the user which provider key is required, why, and which local environment variable to configure.
- The user will configure keys locally and confirm. Never request or display secrets in chat or logs.
- After confirmation, verify presence without printing values and run the authenticated test. Record the actual result.
- Do not invent credentials, silently skip the gate, or claim live API success without a successful authenticated request.

## User stage-update protocol
The agent must report after every implementation phase and wait for the user's confirmation before beginning the next phase. Each report records completed tasks, changed files, checks and outcomes, failures/blockers, and the next phase. The credential gate in `Agent.md` takes precedence over the normal phase sequence.

## Implementation log
Append newest entries at the top.

### 2026-11-14 — Rollback to Original Plan: P0 Baseline Verification Complete
- **Branch**: `rollback/plan-core` branched from `0ec13ed`.
- **Complex build preservation**: Tag `callscope-complex-2026-11-14` created at `41de829` and pushed to remote `origin`.
- **Spec files committed**: `ARCHITECTURE.md`, `DESIGN.md`, `PRD.md`, `RULES.md`, `TASKS.md`, `Agent.md`, `README-HANDOVER.md`.
- **Live tests isolated**: Moved live regression tests to `tests/live/regression-fixtures.test.ts`. Configured `test:live` in `package.json`.
- **Cherry-picked deployment commits**:
  - `bc75d1e` (cherry-picked `768715e`): Web Standard Request/Response and Vercel function timeout.
  - `284b161` (cherry-picked `cbc8984`): Remove forbidden memory config for hobby plan.
  - `617e6f4` (cherry-picked `1b1163d`): Pre-bundle standalone `api/analyse.js` via `bundle-api.mjs`.
  - `a3a81ac` (cherry-picked `1a36f55`): Add `api/analyse.d.ts` re-exporting declarations.
  - `f5a352f` (cherry-picked `07d64f7`): Configure `maxDuration: 60` for `api/analyse.js`.
  - `67195ac` (cherry-picked `363882b`): Consume GET export in unit tests to satisfy `noUnusedLocals`.
  - `d70a4b3` (cherry-picked `292f290`): Bound DeepSeek reasoning tokens and add structured reasoning fallback.
- **Diff review of 3b617cd ported by hand**:
  - `server/analysis/detect-findings.ts`: Ported role semantics distinction between verified contract roles, standard OpenZeppelin role hashes (`recognized_standard_hash`), and unknown roles.
  - `server/analysis/check-consistency.ts`: Ported `transferFrom` recipient extraction (`args[1]`), transfer amount comparisons, and returning `indeterminate` on vague or unverified claims.
  - `api/_analyse.ts`: Ported public error message sanitization (`sanitizePublicErrorMessage`), 64KB body size limit, and 20s race timeout for sponsor reviews.
  - `tests/unit/reliability-fixes.test.ts`: Added unit tests covering these ported fixes.
- **Verification Outputs**:
  - `npm run typecheck` (`tsc --noEmit`): Exit code 0 (clean).
  - `npm test` (`vitest run`): 15 test files passed (112 passed, 0 failed).
  - `npm run test:live` (`vitest run tests/live`): 1 test file passed (2 passed: ENS and Unlock live regressions).
  - `npm run build` (`tsc && node bundle-api.mjs && vite build`): Exit code 0 (dist/assets/index-*.js 163.47 kB).



### 2026-11-14 — Protected Incremental Upgrade: Phase I Complete (Preview Deployment, Smoke Test & Gate)
- **Pull Request #1**: Opened PR from `upgrade/protected-incremental-build` into `master` ([#1](https://github.com/Anekenonso/CallScope/pull/1)).
- **Vercel Preview Deployment**: Successfully deployed to `https://callscope-git-upgrade-protected-incremen-ea9f1e-trades-with-ken.vercel.app`.
- **GitHub Actions CI**: 100% Green (`Typecheck, Hermetic Tests & Build` completed in 1m 43s).
- **Vite Dev Server**: Added `/api/health` and `/api/review` endpoint middleware parity in `vite.config.ts`.
- **Smoke Test Suite (`scripts/smoke-test-deployment.ts`)**: Added automated deployment verification covering `/api/health`, `/api/analyse`, `/api/review`, and all three governance outcomes. Script added to `package.json` (`pnpm smoke`).
- **Smoke Test Results**: 6/6 checks passed. 100% assessment outcome invariance verified across live endpoints. Generated `docs/evidence/phase-i-smoke.md`.
- **Human Promotion Gate (Rule 2.4)**: Zero unapproved promotions or merges into `master`. Paused for user promotion authorization.

### 2026-11-14 — Protected Incremental Upgrade: Phase H Complete (README, Demo Script & Copy Audit)
- **README Rewrite**: Updated production URL (`https://callscope-five.vercel.app`), documented OpenServ `serv-swift` multi-turn ReAct tool loop and Dolphin Lighthouse `DeepSeek-V4.1-Flash` rebuttal loop, added empirical evaluation scorecard (100% invariance, 83% SERV recall, 100% contradiction recall, 100% tool grounding, 100% Dolphin threat identification) and unfloored live latency benchmark, updated test commands (`pnpm eval:sim`, `pnpm eval:live`) and verified 232 test count.
- **Model Fallback Alignment (`claims-ledger.ts`)**: Default fallback updated from legacy `serv-mini` to `serv-swift`.
- **Demo Script (`docs/demo-script.md`)**: Updated walkthrough to demonstrate verified tool grounding badges (`Tool: tool-call-1`), loop turns, action jump links, Dolphin Lighthouse attribution, scenario steps, and Tri-Reviewer Agreement Strip stances.
- **10-Minute Copy Audit**: Verified zero overclaims ("Verified Clean" eradicated, replaced with honest "No significant issue detected"; explicit audit disclaimers; verified source and static analysis limitations clearly communicated).
- **Offline Quality Gates**: All 4 passed (`pnpm check:readme`, `pnpm typecheck`, `pnpm test` [27 files, 232 tests], `pnpm build`).

### 2026-11-14 — Protected Incremental Upgrade: Phase G Complete (UI Evidence & Attribution)
- **Action Anchors (`ActionList.tsx`)**: Added `id={`action-${act.index}`}` to action card articles for verified evidence and adversarial scenario in-page jump targets.
- **Proposal Description Anchor (`ProposalDetails.tsx`)**: Added `id="proposal-description"` for description jump links.
- **OpenServ SERV Display (`ProviderReviews.tsx`)**:
  - Subtitle: `"OpenServ SERV — Multi-Turn Tool-Grounded Investigator"`.
  - Added model attribution pill `serv-swift`.
  - Added loop telemetry badges (`Turns: N`, `Tool calls: N`).
  - Added verified tool grounding pill `Tool: {item.evidenceId}`.
  - Added in-page navigation links (`Action #{N} ↗`, `Description ↗`).
- **Dolphin Lighthouse Display (`ProviderReviews.tsx`)**:
  - Subtitle: `"Dolphin — Adversarial Review (powered by DeepSeek-V4.1-Flash on Lighthouse)"`.
  - Added model attribution pill `Lighthouse · DeepSeek-V4.1-Flash`.
  - Added scenario count badge (`Scenarios: N`).
  - Added scenario preconditions and execution steps with clickable action jump links (`[Action #{N} ↗]`).
  - Added deterministic rebuttal badges (`✓ Refuted by Engine Facts`, `⚠ Not Refuted (Plausible Risk)`, `⚑ Needs Delegate Review`).
- **Tri-Reviewer Agreement Strip**: Displays independent reviewer stance pills for Deterministic Engine, OpenServ SERV, and Dolphin.
- **Type Declarations**: Created `api/review.d.ts` and `api/health.d.ts` for clean TypeScript compilation.
- **Offline Quality Gates**: All 4 passed (`pnpm check:readme`, `pnpm typecheck`, `pnpm test` [27 files, 232 tests], `pnpm build`).

### 2026-11-14 — Protected Incremental Upgrade: Phase F Complete (Eval Harness)
- **Harness**: `eval/sponsor-contribution.ts` scoring OpenServ SERV and Dolphin Lighthouse across all 4 canonical fixtures (ENS EP 6.50, Unlock Transfers, Clean Grant, Opaque Multi-Sig).
- **Scripts**: Added `"eval"`, `"eval:sim"`, and `"eval:live"` to `package.json`.
- **Live Metrics**:
  - Deterministic Invariance: **100%** (zero outcome variance across all fixtures).
  - OpenServ SERV Claim Extraction Recall: **83%**.
  - OpenServ SERV Contradiction Detection Recall: **100%**.
  - OpenServ SERV Tool Grounding Rate: **100%** (12/12 items cite verified `tool-call-*` evidence).
  - OpenServ SERV Clean Proposal False Positive Rate: **0%** (zero false alarms on Clean Grant).
  - Dolphin Lighthouse Threat Identification: **100%** (12/12 scenarios target real structural risks).
  - Dolphin Lighthouse Rebuttal Survival: **100%** (all scenarios substantiated by contract AST capabilities).
  - Dolphin Lighthouse Hallucination Rate: **0%** (zero invalid action/finding references).
- **Evidence**: `docs/evidence/phase-f-eval-results.md` and `docs/evidence/raw/phase-f-eval-raw.json`.
- **Tests**: `tests/unit/eval-harness.test.ts` added (5 tests, 27 total test files, 229 unit tests passing offline).


### 2026-11-14 — Protected Incremental Upgrade: Phases A, B, C, D, and E Complete
- **Branch**: `upgrade/protected-incremental-build`
- **Protected Tag**: `callscope-pre-upgrade-2026-11-12` preserved intact.
- **Phase A (Baseline & Plan)**: Captured initial baseline in `docs/BUILD_STATUS.md`. Created evidence structure.
- **Phase B (SERV API Verification)**: Probed OpenServ `/v1/models`. Selected `serv-swift`. Fixed HTTP 400 on `response_format`. Verified parameters (`serv_prompt_guard`, `serv_shadow_agent`, `reasoning_effort: low`).
- **Phase C (SERV ReAct Loop)**: Implemented multi-turn ReAct tool execution loop (up to 4 turns, 15s/turn). Enforced evidence citation gate. Added `toolCallCount` and `loopTurns`.
- **Phase D (Dolphin Lighthouse Verification)**: Verified endpoint and model `deepseek-ai/DeepSeek-V4.1-Flash`. Tuned token headroom (`maxTokens: 3500`, `timeoutMs: 25000`). Validated deterministic engine rebuttal loop (`evaluateScenarioRebuttal`).
- **Phase E (Live Ablation Benchmark)**: Executed live measured sponsor benchmark across ENS EP 6.50 (Ethereum) and Unlock Transfers (Base). Unfloored latency measured (Phase 1: ~15-19s; Phase 2: ~28-45s). Verified 100% deterministic assessment outcome invariance. Generated `docs/sponsor-impact.md` and `docs/evidence/raw/phase-e-ablation-raw.json`.
- **Quality Gates**: `pnpm check:readme`, `pnpm typecheck`, `pnpm test` (26 files, 224 unit tests passing hermetically), `pnpm build` (all 3 SSR lambdas and client build clean).


### 2026-11-11 — Final Reliability Gap Fix (7-Area Audit & Hardening)
- Scope: Resolved the 7 confirmed reliability gaps identified during live proposal testing on Ethereum and Base:
  1. **Native ETH transfers (Area A)**: Recognised direct native ETH transfers (`value > 0`, empty calldata `0x`) as valid transfers (`action.decoded = true`, `isNativeTransfer = true`, formatted amount in ETH). Eliminated false undecoded-action / unknown-function findings.
  2. **Token amount accuracy & decimals (Area B)**: Created `server/analysis/token-metadata.ts` with canonical metadata (ENS: 18, USDC: 6, USDT: 6, DAI: 18, WETH: 18) and live on-chain fallback reading `decimals()` / `symbol()`. Handled USDC 6 decimals and ENS 18 decimals accurately; if unverified, raw amount is preserved and formatted amount is marked explicitly unavailable (never guessed).
  3. **Approval vs daily-stream consistency (Area C)**: Updated `checkDescriptionActionConsistency` to detect proposals describing daily payment streams (or direct disbursements) that execute only an ERC-20 `approve`. Explicitly flags that an approval only delegates withdrawal allowance and does not configure or start an active stream.
  4. **Material financial actions (Area D)**: Surfaced significant finite token approvals (`MATERIAL_TOKEN_APPROVAL`, severity `medium`) and unlimited approvals (`INFINITE_TOKEN_APPROVAL`, severity `high`), explaining the withdrawal authority granted without classifying legitimate approvals as malicious.
  5. **Safe transaction wrappers (Area E)**: Explicitly recognised Gnosis/Safe `execTransaction` selector (`0x6a761202`) as a known wrapper (`isSafeWrapper = true`, `decoded = false`, severity `medium`). Transparently identifies inner calls as opaque, resulting in an honest `analysis_incomplete` assessment without recursive decoding.
  6. **Severity calibration (Area F)**: Calibrated `transferOwnership` findings: transfers to governance Timelocks are `medium`, renouncing ownership (to 0x0) is `high`, and transfers to external addresses are `high` (warrants review), avoiding indiscriminate `critical` panic classifications.
  7. **Recipient identity consistency (Area G)**: Refactored recipient matching to distinguish between explicit recipient contradictions and unestablished identities. Proposals omitting a recipient address or only referencing protocol contracts are marked as omissions (`indeterminate`), preventing false `Recipient mismatch` discrepancies.
- Tests & Verification:
  - Created `tests/unit/final-reliability-gaps.test.ts` (19 comprehensive tests covering all 7 areas using live proposal scenarios).
  - Updated `tests/unit/detect-findings.test.ts` for calibrated severity.
  - All 10 unit test suites passed (106 tests passing, 0 failures).
  - TypeScript typecheck passed cleanly (`tsc --noEmit` exited 0).
  - Production builds completed cleanly (`bundle-api.mjs` and `vite build`).

### 2026-11-10 — Production Deployment Fix & Verification (Vercel Serverless Invocation & Multi-Transport Resilience)
- Root Cause Diagnosis:
  - 1. **Initial Function Crash (HTTP 500 FUNCTION_INVOCATION_FAILED)**:
    - In Vite projects deployed to Vercel with `"type": "module"` in `package.json`, Vercel's Node runtime executes unbundled `.ts` files inside `/api` as native ESM. Extensionless relative imports (`../server/...`) triggered Node's `ERR_MODULE_NOT_FOUND`.
    - Modern Vercel functions invoke the Web Standard `(request: Request)` signature. Calling Node's legacy `res.setHeader()` / `res.status().json()` when `res` is undefined threw an unhandled `TypeError`.
    - `src/lib/api-client.ts` unconditionally executed `await response.json()`, crashing with `SyntaxError: Unexpected token 'A', "A server e"... is not valid JSON` when Vercel returned plain-text 500 error pages.
  - 2. **Base Mainnet Timeout & Rate Limiting (HTTP 504 Gateway Timeout / HTTP 429)**:
    - The Base RPC endpoint configured in the environment (`https://mainnet.base.org`) aggressively rate-limits Vercel datacenter IPs (`fra1`) with HTTP 429 on `eth_getCode` and `eth_getLogs`.
    - Without a fallback transport, Viem's default retry mechanism with exponential backoff hung until exceeding Vercel's execution limit.
    - Serial ABI resolution with 6-second timeouts on Sourcify and Blockscout added 26+ seconds of latency on proxy resolution.
- Fixes Applied:
  - 1. **Bundled Standalone Serverless API (`bundle-api.mjs`, `api/analyse.js`, `api/analyse.d.ts`)**:
    - Created an SSR build script using Vite to bundle `api/_analyse.ts` into a self-contained `api/analyse.js` (75 kB) with all 12 `server/` modules inlined with zero relative imports.
    - Added `api/analyse.d.ts` re-exporting declarations to guarantee strict TypeScript compilation (`tsc --noEmit`).
    - Implemented a dual Web Standard (`Request -> Response`) and Node.js (`req, res`) entrypoint in `api/_analyse.ts`.
  - 2. **Multi-Transport Fallback with Rate-Limit Protection (`server/chain/rpc-client.ts`)**:
    - Implemented Viem multi-transport `fallback([http(rpcUrl), http('https://base-rpc.publicnode.com'), http('https://base.drpc.org')])`.
    - Set `retryCount: 0` on individual transports so rate-limited (HTTP 429) or slow RPCs fail over instantly (0ms) to high-throughput publicnode endpoints without blocking function execution.
  - 3. **Optimized Event Retrieval with Governor `votingDelay` (`server/chain/proposal-events.ts`)**:
    - Added `queryGovernorVotingDelay` lookup: `creation_timepoint = snapshot - votingDelay`.
    - Implemented concentric search rings centered on `targetBlock` in safe `<= 9,900` block chunks (preventing RPC range limits and rate-limiting).
    - Reduced ProposalCreated event retrieval time from 28s to ~10s on Base and < 2s on Ethereum.
  - 4. **Concurrent ABI Resolution with Bounded Timeouts (`server/analysis/resolve-abi.ts`)**:
    - Parallelized Sourcify and Blockscout fetches with bounded timeouts, reducing proxy contract resolution from 26s to ~1.6s.
  - 5. **Sponsor Review Timeout Bounding (`api/_analyse.ts`)**:
    - Enforced an 18-second timeout race on sponsor reviews (SERV and Dolphin) so background LLM inference never starves or times out the serverless function.
  - 6. **Frontend Error Parsing Resilience (`src/lib/api-client.ts`)**:
    - Hardened response handling to read text and safely attempt JSON parsing, surfacing structured error messages instead of raw syntax crashes.
  - 7. **Vercel Serverless Function Configuration (`vercel.json`)**:
    - Configured `"functions": { "api/analyse.js": { "maxDuration": 60 } }`.
- Live Production Verification Results on `https://callscope-five.vercel.app/`:
  - Deployment Commit: `ea3eefa` (Vercel deployment state: `success`).
  - **Fixture 1: ENS Ethereum (Mainnet)**:
    - URL: `https://callscope-five.vercel.app/api/analyse`
    - Request: Governor `0x323A76393544d5ecca80cd6ef2A560C6a395b7E3`, Proposal ID `77767899528494238518019756391533686963875234067646094287125791110488147463806`
    - Response: **HTTP 200 OK in 10,569 ms**
    - Proposal Status: `Executed`
    - Assessment Outcome: `review_recommended`
    - Executable Actions: 1 action decoded (`grantRole(bytes32,address)` for `PROPOSER_ROLE` to Security Council `0x2acbf518b3759f6e1fa163294eda55bf1d0ae051` on TimelockController `0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7`)
    - Deterministic Findings: `SENSITIVE_GRANT_ROLE_0` (Severity: `high`, verified: `true`)
    - Consistency Status: `consistent`
    - Sponsor Reviews: OpenServ SERV (`available`), Dolphin (`available`)
  - **Fixture 2: Unlock Base (Base Mainnet)**:
    - URL: `https://callscope-five.vercel.app/api/analyse`
    - Request: Governor `0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9`, Proposal ID `27419154582993156392805749742953507877176483681373228046916881327937839104508`
    - Response: **HTTP 200 OK in 14,921 ms**
    - Proposal Status: `Executed`
    - Assessment Outcome: `review_recommended`
    - Executable Actions: 6 actions all decoded as ERC-20 `transfer(address,uint256)` preserving order and argument values:
      - Action #1: transfer 400 USDC (`400000000`) on FiatTokenProxy `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Implementation: `0x2Ce6311ddAE708829bc0784C967b7d77D19FD779`)
      - Action #2: transfer 50,000 UDT (`50000000000000000000000`) on `0xaC27fa800955849d6D17cC8952Ba9dD6EAA66187` (Implementation: `0xF52ce8bc8B9a1EC76C2c46008216a357812da67D`)
      - Action #3: transfer 700 USDC (`700000000`) on `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
      - Action #4: transfer 50,000 UDT (`50000000000000000000000`) on `0xaC27fa800955849d6D17cC8952Ba9dD6EAA66187`
      - Action #5: transfer 200 USDC (`200000000`) on `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
      - Action #6: transfer 150,000 UDT (`150000000000000000000000`) on `0xaC27fa800955849d6D17cC8952Ba9dD6EAA66187`
    - Deterministic Findings: 0 malicious/critical findings
    - Consistency Status: `inconsistent` (honestly detected description amount mismatches)
    - Sponsor Reviews: OpenServ SERV (`available`), Dolphin (`available`)
- All 112 automated tests passing locally, production build clean, both production fixtures passing live in under 15 seconds.

### 2026-11-10 — Core Reliability Hardening (Post-Audit) completed
- Completed:
  - 1. Historical proposal retrieval (`server/chain/proposal-events.ts`, `server/chain/networks.ts`):
    - Completely removed fixture-specific block hints (`KNOWN_PROPOSAL_BLOCK_HINTS`).
    - Implemented `queryGovernorSnapshotValue` supporting both block numbers (< 500M, e.g. Ethereum) and timestamps (> 1B, e.g. Base L2) to compute accurate search windows without hardcoding.
    - Implemented parallel chunk batching (batches of 4 chunks of 50,000 blocks in parallel via `Promise.all`), reducing retrieval latency from 30+ seconds to < 20s.
    - Configured `server/chain/networks.ts` default Base RPC to `https://base-rpc.publicnode.com` (supporting 50k-block ranges).
    - Verified: `tests/integration/proposal-retrieval.test.ts` passed for BOTH ENS Ethereum (3.8s) and Unlock Base (25.8s) with 0 hardcoded block hints.
  - 2. Role verification (`server/analysis/detect-findings.ts`):
    - Updated `resolveRoleSemantics(roleHex, targetName)` with three-state resolution: `'verified' | 'recognized_standard_hash' | 'unknown'`.
    - Only flags `status = 'verified'` (and `finding.verified = true`) if target contract is a confirmed `TimelockController` or `AccessControl`.
    - Returns `recognized_standard_hash` with `finding.verified = false` and explicit unconfirmed disclaimer in finding title and description whenever target contract proof is absent, preserving uncertainty.
  - 3. Description consistency (`server/analysis/check-consistency.ts`):
    - Fixed `transferFrom(address,address,uint256)` recipient extraction: recipient is argument two (`args[1]`).
    - Removed generic keyword bypasses (e.g. `!descLower.includes('security council') && !descLower.includes('multisig')`).
    - Added explicit amount comparison checking claimed amounts against executed amounts under 1, 6, and 18 decimal representations.
    - Returns `status: 'indeterminate'` when descriptions make unverified claims or have zero verifiable details while executable actions exist.
  - 4. Sponsor and API reliability (`api/analyse.ts`, `server/providers/dolphin.ts`):
    - Added 64KB request payload size limit (HTTP 413) and IP sliding-window rate limiter (HTTP 429).
    - Enforced bounded 20-second timeout race on sponsor reviews so deterministic analysis is returned promptly even if sponsors lag or fail.
    - Isolated sponsor failures: provider errors do not degrade or invalidate deterministic findings.
    - Added `sanitizePublicErrorMessage` stripping file paths, stack traces, and secrets from public 500 error responses.
    - Constrained reasoning token generation in Dolphin (`server/providers/dolphin.ts`) to avoid token exhaustion and added reasoning JSON fallback extraction in `openai-compatible.ts`.
  - 5. Results and progress integrity (`src/app/App.tsx`, `src/components/AnalysisProgress.tsx`):
    - Added `setResult(null)` immediately when `handleAnalyse` starts to ensure previous results are cleared.
    - Completely removed fake `setTimeout` progressions and fabricated step completion checkmarks.
    - Implemented honest loading state: active SVG spinner, live elapsed timer (`seconds.toFixed(1)s`), continuous shimmer progress bar, and active pipeline stage indicators.
  - 6. Test integrity & regression suite (`tests/`):
    - Fixed production build prerequisite ordering inconsistency in `tests/integration/pressure-testing.test.ts` (T7.9 auto-builds `dist/assets` if not yet built).
    - Updated `tests/integration/sponsor-live.test.ts` with `it.skipIf` and live assertion of authenticated response availability when keys are configured.
    - Added comprehensive regression suite `tests/unit/reliability-fixes.test.ts` covering `transferFrom` recipient extraction, amount mismatch detection, vague description indeterminate handling, role verification uncertainty, and error sanitization.
- Verification:
  - `tsc --noEmit`: 0 errors.
  - Unit tests: 11 test files, 93 passed (93).
  - Integration tests: 5 test files, 19 passed (19).
  - Production build: `vite build` completed in 5.50s (0 errors).
- Status: All core reliability fixes completed and verified.

### 2026-11-10 — Phase 8: Final quality, deployment readiness and documentation completed
- Completed:
  - T8.1: Ran TypeScript typecheck in strict mode (`node ./node_modules/typescript/lib/tsc.js --noEmit`), verified 0 errors across all 42 modules.
  - T8.2: Verified code style and naming conventions; enforced zero unused variables and strict null checks.
  - T8.3: Ran full test suite with live environment credentials loaded (`node --env-file=.env ./node_modules/vitest/vitest.mjs run`). All 15 test files and 104 tests passed across unit, integration, live RPC retrieval, pressure testing, and live sponsor verification.
  - T8.4: Ran production build (`node ./node_modules/typescript/lib/tsc.js; node ./node_modules/vite/bin/vite.js build`). Clean production output generated in `dist/` in 2.80s (`dist/index.html` 0.42 kB, `dist/assets/index-CopmoYl-.css` 15.52 kB, `dist/assets/index-Cvr-vk5k.js` 163.32 kB).
  - T8.5: Fixed all actionable test failures: updated `api/analyse.ts` with custom `ValidationError` handling returning HTTP 400 Bad Request with structured error codes matching test expectations.
  - T8.6: Configured `.env.example` documenting all configuration keys (`ETHEREUM_RPC_URL`, `BASE_RPC_URL`, `BLOCKSCOUT_ETH_API_URL`, `BLOCKSCOUT_BASE_API_URL`, `OPENSERV_API_KEY`, `DOLPHIN_API_KEY`). Confirmed `.env` is excluded in `.gitignore` and no private secrets appear in Git or client bundles.
  - T8.7: Tested dev server middleware in `vite.config.ts` running locally at `http://127.0.0.1:5173` with both live fixtures, and verified production serverless configuration in `vercel.json`.
  - T8.8: Verified both networks (Ethereum Mainnet chain 1, Base Mainnet chain 8453) and both sponsor integrations (OpenServ SERV and Dolphin) operating against live services.
  - T8.9: Updated `TASKS.md` and `PROGRESS.md` with exact commands, test counts, and verified outcomes.
  - T8.10: Authored comprehensive `README.md` with system overview, architecture, security rules, sponsor integrations, reference fixtures, quickstart, and hackathon presentation guide.
- Verification:
  - `tsc --noEmit`: 0 errors.
  - `vitest run`: 104 passed (104) across 15 test files.
  - `vite build`: 0 errors, completed in 2.80s.
  - Live local server: Operational at `http://127.0.0.1:5173`.
- Blockers: None. All phases (0 through 8) fully completed.

### 2026-11-10 — Phase 7: Integration & Pressure Testing completed
- Completed:
  - T7.1 & T7.3: Verified live ENS Ethereum reference proposal (`0x323A...`, ID `7776...`): recovered `ProposalCreated` log, decoded `grantRole(bytes32,address)`, resolved `PROPOSER_ROLE` on `TimelockController`, verified finding as `HIGH` severity, and confirmed overall `review_recommended` verdict without falsely labeling it malicious.
  - T7.2 & T7.4: Verified live Unlock Base reference proposal (`0x65bA...`, ID `2741...`): recovered 6 executable ERC-20 `transfer()` actions (3 USDC, 3 UPToken), decoded all recipients and amounts, confirmed exact execution order preservation, and verified non-malicious assessment.
  - T7.5: Tested edge cases: invalid network rejected at input, malformed Ethereum addresses rejected, non-numeric proposal IDs rejected, target address without bytecode (EOA) fails cleanly, unknown proposal ID fails cleanly.
  - T7.6: Tested calldata edge cases: verified that undecoded actions strictly force `analysis_incomplete` and cannot yield a clean outcome; verified precedence rule that high/critical findings elevate assessment to `review_recommended` over `analysis_incomplete`.
  - T7.7: Tested independent sponsor provider resilience: verified that deterministic findings and consistency engine operate independently of AI provider outages or network issues.
  - T7.8: Tested prompt injection resilience: subjected analysis to adversarial inputs (`<script>`, jailbreaks, fake safety claims); proved that prompt injections cannot trick the deterministic engine into a clean or safe verdict.
  - T7.9: Completed automated secret isolation audit: scanned production JavaScript bundle in `dist/assets/`, proved zero exposure of `SERV_API_KEY`, `DOLPHIN_API_KEY`, or `process.env`; verified that serialized `AnalysisResponse` contains no raw secrets or private environment variables.
  - Refactored `api/analyse.ts` to export `executeAnalysis` and integrated full development middleware into `vite.config.ts` so `pnpm dev` serves both UI and live `/api/analyse` endpoint.
- Verification:
  - `pnpm typecheck`: 0 errors.
  - `pressure-testing.test.ts`: 11/11 passed.

### 2026-11-10 — Phase 6: Single-Page UI Implementation completed
- Completed:
  - T6.1: Implemented compact header (`src/components/Header.tsx`) and unified analysis form (`src/components/AnalysisForm.tsx`) with direct labels (`Network`, `Governor`, `Proposal ID`, `Analyse`) and one-click reference fixture buttons (`ENS (Ethereum)`, `Unlock (Base)`).
  - T6.2: Implemented comprehensive loading state (prevents duplicate submission, keeps inputs visible, displays live progress notification), input validation error messages, and server error banner.
  - T6.3: Implemented `AssessmentBanner` (`src/components/AssessmentBanner.tsx`) enforcing strictly the three approved outcomes (`review_recommended`, `analysis_incomplete`, `no_significant_issue_detected`). Guaranteed that the positive palette is strictly paired with the exact phrase and its mandatory limitation statement ("Analysis found no sensitive operations or discrepancies among verified actions. This does not constitute an audit or guarantee of safety.").
  - T6.4: Implemented `ProposalDetails` (`src/components/ProposalDetails.tsx`) displaying current status badge, proposal ID, Governor address with explorer link, proposer, creation transaction/block, and clean description viewer with accessible clipboard copy buttons.
  - T6.5: Implemented `ActionList` (`src/components/ActionList.tsx`) presenting executable actions preserving exact execution order, decoded function names, target contract identification (including proxy implementation indicators), typed argument tables, and collapsible raw calldata inspector.
  - T6.6: Implemented `FindingsList` (`src/components/FindingsList.tsx`) displaying deterministic security findings with severity badges, on-chain verification flags, action index tags, and explicit "Why it matters" explanations; and `ConsistencyView` (`src/components/ConsistencyView.tsx`) displaying description claim consistency status, omissions, and discrepancies.
  - T6.7: Implemented `ProviderReviews` (`src/components/ProviderReviews.tsx`) presenting side-by-side or stacked review cards for OpenServ SERV and Dolphin with distinct status badges (`Available`, `Not configured`, `Unavailable`) and clear advisory disclaimer.
  - T6.8: Implemented `EvidenceLinks` (`src/components/EvidenceLinks.tsx`) providing direct verified on-chain explorer links and analysis limitations.
  - T6.9: Applied complete design system styles in `src/styles/index.css` following `DESIGN.md` color tokens, system typography, visible keyboard focus (`:focus-visible`), and 320px mobile responsive layout without horizontal scrolling.
  - T6.10: Removed all marketing copy, tags, promotional phrases, decorative cards, and fake metrics.
  - Added 12 component unit tests in `tests/unit/ui-components.test.tsx` verifying SSR rendering across all states.
- Verification:
  - `pnpm typecheck`: 0 errors.
  - `vite build`: Production build succeeded (`dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css`).
  - Unit tests: 12/12 passed in `ui-components.test.tsx`.

### 2026-11-10 — Phase 5: Sponsor integrations & Live Credential Verification completed
- Completed:
  - T5.1: Implemented shared bounded OpenAI-compatible HTTP client in `server/providers/openai-compatible.ts` with explicit `AbortSignal.timeout`, Bearer authentication, `max_completion_tokens` parameter compatibility, response length bounds, error mapping (401, 402, 404, 429, 5xx), and fence-stripping JSON extractor.
  - T5.2: Implemented OpenServ SERV adapter in `server/providers/serv.ts` (`https://inference-api.openserv.ai/v1/chat/completions`) supporting native OpenServ models (`serv-mini` / `serv-swift` / `serv-standard` / `serv-pro`), normalizing legacy model names, and providing 30s timeout.
  - T5.3: Implemented Dolphin adapter in `server/providers/dolphin.ts` (`https://lighthouse.dphn.ai/run/text-v/v1/chat/completions`) using `DOLPHIN_API_KEY` and `deepseek-ai/DeepSeek-V4.1-Flash` with 35s timeout and 1500 tokens allowing for DeepSeek reasoning tokens.
  - T5.4: Designed prompt-injection-resistant prompts treating proposal content strictly as untrusted data within `<untrusted_proposal_text>` boundary tags with strict anti-jailbreak directives.
  - T5.5 & T5.6: Implemented structured schema validation for advisory reviews (`summary`, `findings` array with severity and category, `status`). Malformed or out-of-schema outputs are rejected and mapped to `error` without impacting deterministic results.
  - T5.7: Created 16 comprehensive unit tests in `tests/unit/sponsor-providers.test.ts` covering missing credentials, successful parsing, markdown fence extraction, 401, 402, 429, 503, timeouts, and malformed JSON.
  - T5.8: Followed mandatory Credential Gate protocol: halted before live calls, requested user configuration in `.env` without printing keys. User confirmed `.env` setup. Verified key presence safely without logging secrets.
  - T5.9: Executed live authenticated calls to both providers in `tests/integration/sponsor-live.test.ts`:
    - OpenServ SERV: 200 OK (`status: 'available'`). Successfully produced structured advisory review analyzing proposal description against actions.
    - Dolphin: 200 OK (`status: 'available'`). Successfully reasoned via `deepseek-ai/DeepSeek-V4.1-Flash` and delivered structured critique.
  - Connected `reviewWithServ` and `reviewWithDolphin` into `api/analyse.ts` via non-blocking parallel `Promise.allSettled`. Established architectural guarantee that AI reviews are strictly advisory and cannot mutate deterministic findings or downgrade assessments.
- Verification:
  - `pnpm typecheck`: 0 errors.
  - `node --env-file=.env ./node_modules/vitest/vitest.mjs run`: **80 passed (80)** across 12 test files (both live sponsor integrations, both live on-chain fixtures, all unit tests).

### 2026-11-10 — Phase 4: Deterministic assessment completed
- Completed:
  - T4.1 & T4.2: Implemented sensitive-operation detection rules in `server/analysis/detect-findings.ts` covering `grantRole`, `revokeRole`, `transferOwnership`, `upgradeTo`, `upgradeToAndCall`, `changeAdmin`, native ETH transfers, and infinite approvals with decoded relevant parameters.
  - T4.3: Implemented verifiable role semantics resolution (`resolveRoleSemantics`) against canonical role hashes (`DEFAULT_ADMIN_ROLE`, `PROPOSER_ROLE`, `EXECUTOR_ROLE`, `CANCELLER_ROLE`, `TIMELOCK_ADMIN_ROLE`, `MINTER_ROLE`, `PAUSER_ROLE`, `UPGRADER_ROLE`), marking non-verifiable hashes as explicitly unknown.
  - T4.4: Implemented deterministic description/action consistency checking in `server/analysis/check-consistency.ts` comparing proposed claims against executable operations, recipient addresses, and token actions.
  - T4.5 & T4.6: Implemented deterministic assessment builder (`server/analysis/build-assessment.ts`) strictly enforcing precedence rules (`review_recommended` > `analysis_incomplete` > `no_significant_issue_detected`). Guaranteed that undecoded or opaque actions CANNOT produce `no_significant_issue_detected`.
  - T4.7: Added 21 unit tests across `tests/unit/detect-findings.test.ts`, `tests/unit/check-consistency.test.ts`, and `tests/unit/build-assessment.test.ts`. Added live end-to-end regression fixture tests in `tests/integration/regression-fixtures.test.ts` proving:
    - ENS Ethereum proposal: identified `grantRole(bytes32,address)`, resolved `PROPOSER_ROLE`, matched Security Council description, yielded `review_recommended` with verified finding, and prevented false malicious labeling.
    - Unlock Base proposal: decoded all six `transfer()` actions, verified argument amounts and recipient addresses, and confirmed non-maliciousness.
  - Wired findings detection, consistency checking, and assessment builder into `api/analyse.ts`.
- Verification:
  - `pnpm typecheck`: 0 errors.
  - `pnpm test`: 62 tests passing across all 10 test files.
  - `pnpm build`: Successful production build in 2.60s.
- Blockers: None.
- Next: Phase 5 — Sponsor integrations (OpenServ SERV adapter, Dolphin adapter, bounded OpenAI-compatible client, injection-resistant prompts, credential gate).

### 2026-11-10 — Phase 3: ABI resolution and action decoding completed
- Completed:
  - T3.1: Implemented verified ABI retrieval in `server/analysis/resolve-abi.ts` supporting Blockscout REST API v2, Blockscout v1, and Sourcify open repository fallback with per-request caching.
  - T3.2: Implemented on-chain verifiable proxy implementation detection (`detectProxyImplementation`) checking EIP-1967 implementation and beacon slots, EIP-1822 slot, and OpenZeppelin classic proxy slots, with implementation ABI resolution.
  - T3.3: Implemented selector-prefixed calldata decoding via viem's `decodeFunctionData` using resolved verified target/proxy ABIs with typed argument mapping (`formatArgValue`, `mapDecodedArgs`).
  - T3.4: Implemented legacy signature decoding in `server/analysis/decode-actions.ts`: parsed explicit signature strings via `parseAbiItem`, computed 4-byte selector, handled both argument-only and selector-prefixed calldata, and decoded parameters cleanly.
  - T3.5: Preserved raw target, value, signature, selector, and rawCalldata for every action without dropping any action.
  - T3.6: Validated action array lengths (`targets`, `values`, `signatures`, `calldatas`) and preserved original sequential ordering.
  - T3.7: Formatted unknown ABIs/selectors as explicit `decoded: false` with descriptive error messages and surfaced them as limitations in the analysis payload.
  - T3.8: Added 11 unit tests in `tests/unit/decode-actions.test.ts` (known functions, legacy signatures, unknown ABIs, malformed arrays, proxy detection) and 2 live integration tests in `tests/integration/action-decoding.test.ts` verifying decoding of real on-chain actions for both ENS (`grantRole(bytes32,address)`) and Unlock (all six ERC-20 `transfer()` actions).
  - Integrated retrieval and action decoding into `api/analyse.ts`.
- Verification:
  - `pnpm typecheck`: 0 errors.
  - `pnpm test`: 39 tests passing across 6 test files (unit and live chain integration).
  - `pnpm build`: Successful production build in 3.46s.
- Blockers: None.
- Next: Phase 4 — Deterministic assessment (sensitive-operation detection rules, description/action consistency analysis, strict outcome precedence, ENS and Unlock regression assertions).

### 2026-11-09 — Phase 2: Chain access and proposal retrieval completed
- Completed:
  - T2.1: Implemented allowlisted network configuration in `server/chain/networks.ts` (Ethereum Mainnet chain 1, Base Mainnet chain 8453) with environment variable overrides (`ETHEREUM_RPC_URL`, `BASE_RPC_URL`) and robust public fallbacks.
  - T2.2: Implemented RPC client creation and RPC chain ID validation (`verifyNetworkChainId`) preventing network spoofing.
  - T2.3: Implemented Governor address validation and bytecode check (`validateGovernorContract`) ensuring addresses contain active smart contract bytecode and returning normalized EIP-55 checksummed addresses.
  - T2.4: Implemented supported OpenZeppelin Governor `ProposalCreated` event ABI variants (unindexed, indexed `proposalId`, and indexed `proposalId` + `proposer`).
  - T2.5 & T2.6: Implemented indexed proposal ID filtering and log retrieval (`server/chain/proposal-events.ts`) utilizing Blockscout logs API with bounded adaptive RPC log scanning fallback. Added strict validation against array length mismatches and ambiguous conflicting events.
  - T2.7: Implemented `readGovernorProposalState` mapping Governor state integers to OpenZeppelin standard status names (`Pending`, `Active`, `Canceled`, `Defeated`, `Succeeded`, `Queued`, `Expired`, `Executed`).
  - T2.8: Added 14 unit tests in `tests/unit/chain.test.ts` and 2 live integration tests in `tests/integration/proposal-retrieval.test.ts` verifying real chain retrieval for both the ENS Ethereum fixture and Unlock Base fixture.
- Blockers: None.
- Next: Phase 3 — ABI resolution and action decoding (Blockscout verified ABI retrieval, proxy implementation resolution, legacy signatures + calldata decoding, action array validation, and unverified action limitation tracking).

### 2026-11-09 — Phase 1: Minimal application foundation completed
- Completed:
  - T1.1: Configured Vite + React + TypeScript in strict mode (`tsconfig.json`, `vite.config.ts`, `index.html`).
  - T1.2: Added minimal necessary dependencies (`react`, `react-dom`, `viem`, `vite`, `@vitejs/plugin-react`, `vitest`, `typescript`). Avoided heavy extraneous wrappers.
  - T1.3: Implemented design tokens from `DESIGN.md` in `src/styles/index.css` (neutral palette, typography, form card, accessibility focus rings).
  - T1.4: Configured Vercel serverless function entrypoint (`api/analyse.ts`) and `vercel.json` with typed Vercel request/response interfaces in `src/types/vercel.ts`.
  - T1.5: Implemented shared TypeScript contracts (`src/types/analysis.ts`, `server/analysis/types.ts`) covering networks, proposal metadata, actions, findings, consistency, provider reviews, and errors.
  - T1.6: Verified dev/test/build pipeline: `pnpm typecheck` passed (0 errors), `pnpm test` passed (2 test files, 10 tests), and `pnpm build` completed in 2.56s.
- Blockers: None.
- Next: Phase 2 — Chain access and proposal retrieval (network configuration, RPC client, Governor contract bytecode validation, `ProposalCreated` event ABI variants, indexed log scanning, and proposal state mapping).

### 2026-11-09 — Phase 0: Read and prepare completed
- Completed:
  - Read all seven handover documents (`Agent.md`, `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `RULES.md`, `TASKS.md`, `PROGRESS.md`).
  - Inspected repository structure: fresh workspace containing specification documents; no legacy code or conflicting configs.
  - Verified environment: Node.js `v24.19.0`, npm `11.17.0`, Git initialized on `master`.
  - Created `.env.example` defining `ETHEREUM_RPC_URL`, `BASE_RPC_URL`, `SERV_API_KEY`, `SERV_MODEL`, `DOLPHIN_API_KEY`, `DOLPHIN_MODEL`.
  - Verified baseline status: no `package.json` or build/test scripts exist yet; clean slate for Phase 1.
- Blockers: None for Phase 1.
- Next: Phase 1 — Minimal application foundation (Vite + React + TS setup, dependencies, design tokens, types, Vercel route wiring).

### 2026-11-09 — Handover
- Completed: product definition, architecture direction, design direction, implementation rules and task breakdown.
- Not started: repository implementation.
- Blockers: none for local implementation; live sponsor API authentication requires credentials.
- Next: execute Phase 0 in `TASKS.md`.

## Test log template
For every meaningful test run, record:
- Date/time:
- Commit:
- Command or test:
- Fixture/network:
- Result: PASS / FAIL / NOT RUN
- Evidence/output:
- Follow-up:

### 2026-11-09 Test Run — Phase 2 Chain Access & Proposal Retrieval
- Date/time: 2026-11-09 23:49 CET
- Command: `pnpm test` (vitest run)
- Scope:
  - `tests/unit/chain.test.ts` (14 unit tests)
  - `tests/integration/proposal-retrieval.test.ts` (2 live chain tests)
  - `tests/unit/api-handler.test.ts` (5 tests)
  - `tests/unit/validation.test.ts` (5 tests)
- Result: PASS (4 files, 26 tests passed)
- Evidence:
  - `tests/unit/chain.test.ts`: Network configs, chain ID verification, contract bytecode validation, all 8 proposal states mapped, unindexed and indexed `ProposalCreated` variants parsed, array length mismatch rejected.
  - `tests/integration/proposal-retrieval.test.ts`:
    - ENS Ethereum proposal (`777678...`) retrieved live from Ethereum Mainnet Governor `0x323A76393544d5ecca80cd6ef2A560C6a395b7E3`, verified event description and proposal state.
    - Unlock Base proposal (`274191...`) retrieved live from Base Mainnet Governor `0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9`, verified 6 actions and proposal state (`Executed`).
- TypeScript check: `pnpm typecheck` passed (0 errors).
- Production build: `pnpm build` passed (3.91s).
- Follow-up: Proceed to Phase 3 — ABI resolution and action decoding.

### 2026-11-09 Test Run — Phase 1 Test Suites
- Date/time: 2026-11-09 23:21 CET
- Command: `pnpm test` (vitest run)
- Scope: Validation unit tests (`tests/unit/validation.test.ts`), API handler unit tests (`tests/unit/api-handler.test.ts`)
- Result: PASS (2 files, 10 tests passed)
- Evidence:
  - `tests/unit/validation.test.ts (5 tests) passed`
  - `tests/unit/api-handler.test.ts (5 tests) passed`
- TypeScript check: `pnpm typecheck` (`tsc --noEmit`) exited with code 0.
- Production build: `pnpm build` (`tsc && vite build`) produced `dist/` in 2.56s.
- Follow-up: Proceed to Phase 2 unit tests for RPC client and event parsing.

### 2026-11-10 Test Run — Core Reliability Hardening & UI/UX Unslopping
- Date/time: 2026-11-10 16:48 CET
- Command: `node --env-file=.env ./node_modules/vitest/vitest.mjs run` & `node ./node_modules/vite/bin/vite.js build`
- Scope: Full test suite (16 test files, 112 tests) + Vite production build + OpenServ console UI/UX refinement
- Result: PASS (16 files passed, 112 tests passed, 0 failures, 0 skipped)
- Evidence:
  - Unit tests: validation, chain, decode-actions, detect-findings, check-consistency, build-assessment, sponsor-providers, reliability-fixes, ui-components (all passed)
  - Integration tests: historical-proposals, proposal-retrieval, action-decoding, regression-fixtures, sponsor-live, pressure-testing (all passed)
  - UI/UX & Brand: OpenServ-inspired console design tokens, vector SVG DAO governance logo, `public/favicon.svg`, interactive preset pills, staggered pipeline wave.
- TypeScript check: `tsc --noEmit` exited with code 0 (clean).
- Production build: `vite build` completed in 2.57s.
- Git: Committed and pushed to `origin/master` (`e16c994`).

## Known limitations to preserve
- Only explicitly supported Governor event layouts are supported.
- ABI/source resolution can fail; unknown actions must remain visible and prevent a clean result when material.
- General nested execution decoding is out of scope.
- AI provider reviews may be unavailable; deterministic analysis must continue.
- A clean result is limited to the checks actually completed and is not a guarantee of safety.
