# CallScope

> Deterministic DAO proposal calldata intelligence with advisory multi-agent review.

**Live Application**: [https://callscope-five.vercel.app](https://callscope-five.vercel.app)

CallScope is an evidence-based governance analysis engine for DAO delegates and security researchers. It inspects on-chain proposals across **Ethereum Mainnet** and **Base Mainnet**, decodes raw EVM calldata into human-verifiable operations, parses contract role capabilities via Solidity AST analysis from verified source code, cross-examines description claims in a structured Claims Ledger, and surfaces complementary advisory reviews from **OpenServ SERV** and **Dolphin**.

The deterministic engine remains strictly authoritative: LLM reviews are advisory only and cannot alter findings, downgrade severities, or dictate assessment verdicts. Baseline assessments stay invariant regardless of sponsor status.

---

## 3-Tier Analysis Architecture

CallScope provides a 3-tier analysis flow optimized for speed, precision, and credit conservation:

1. **Instant Tier (Deterministic Baseline)**:
   - Zero AI calls. Resolves proposal events, decodes EVM calldata, parses verified Solidity AST for role capabilities, inspects recipient bytecode, and cross-checks explicit recipient constraints.
   - **Target**: ≤ 5 s cold (≤ 2 s pinned / cached).
   - **Measured**: **p50: 3,242 ms** across 25 live proposals; **p50: 0 ms** on cached/pinned runs.
   - **Evidence**: [`docs/evidence/raw/latency-2026-11-14.json`](file:///docs/evidence/raw/latency-2026-11-14.json) | [`docs/instant-success-table.md`](file:///docs/instant-success-table.md)
2. **Standard Tier (Guarded Claims Extraction)**:
   - Automatically triggered following Instant analysis. Executes a single guarded OpenServ SERV call (`serv-swift` with `serv_prompt_guard`) to extract textual governance commitments, which are then checked by the deterministic engine's Claims Ledger comparators. Multi-turn tool loops are bypassed to keep execution fast and light.
   - **Target**: ≤ 10–12 s median.
   - **Measured**: **p50: 1,200 ms**.
   - **Evidence**: [`docs/evidence/raw/latency-2026-11-14.json`](file:///docs/evidence/raw/latency-2026-11-14.json)
3. **Deep Tier (Interactive Adversarial Stress-Test)**:
   - Initiated on-demand via the "Run Deep Review" button. Dispatches the full OpenServ SERV multi-turn investigator tool loop (up to 3 turns) and concurrent Dolphin Lighthouse adversarial attack scenario generation and proposer questions.
   - **Target**: ≤ 25 s.
   - **Measured**: **p50: 8,500 ms** live; **5 ms** on stored pinned examples.
   - **Evidence**: [`docs/evidence/raw/latency-2026-11-14.json`](file:///docs/evidence/raw/latency-2026-11-14.json)

---

## Pinned Examples Across All Three Governance Outcomes

CallScope includes pinned event snapshots for instant, deterministic reproducibility, as well as an on-chain re-verification toggle that bypasses snapshots to query public RPC nodes directly.

| Example Name | Chain | Governor Address | Proposal ID | Expected Outcome | What It Demonstrates |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **ENS EP 6.50** | Ethereum | `0x323A76393544d5ecca80cd6ef2A560C6a395b7E3` | `77767899528494238518019756391533686963875234067646094287125791110488147463806` | `review_recommended` | Calldata grants `PROPOSER_ROLE` on TimelockController (`schedule()` and `cancel()` capabilities), directly contradicting description claiming the Security Council lacks proposal or initiation powers. |
| **Clean Community Grant** (`[SYNTHETIC]`) | Ethereum | `0x323A76393544d5ecca80cd6ef2A560C6a395b7E3` | `999001` | `no_significant_issue_detected` | Standard ERC-20 transfer (50,000 USDC) where recipient and amount match description verbatim. Zero sensitive permissions granted. |
| **Opaque Multi-Sig Execution** (`[SYNTHETIC]`) | Ethereum | `0x323A76393544d5ecca80cd6ef2A560C6a395b7E3` | `999002` | `analysis_incomplete` | Calldata routes through Gnosis Safe `execTransaction` (`0x6a761202`) with opaque nested payload. CallScope refuses to issue a clean bill of health. |
| **Unlock Protocol** | Base | `0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9` | `27419154582993156392805749742953507877176483681373228046916881327937839104508` | `analysis_incomplete` | Six ERC-20 token transfers across USDC and UPToken where description references external links rather than inlining recipient addresses. |

> [!TIP]
> **Direct Transaction Lookup**: You can also analyze proposals directly by pasting a proposal creation transaction hash (e.g. `0x76eefae46df65ef44d7bf95f4a0fd7cc7f0628fd684cc0074d59f1173cddef90`) or an Etherscan / Basescan transaction URL. CallScope derives the proposal from the transaction receipt without log scanning.

---

## Instant Tier Success & Completion Rate Benchmark

Evaluated across 25 historical, operational, and benchmark proposals from major OpenZeppelin and Bravo Governor deployments on Ethereum and Base (ENS, Unlock Protocol, Compound, and Uniswap):

| Metric | Target | Measured Result | Evidence |
| :--- | :---: | :---: | :--- |
| **Completion Rate** | ≥ 95% | **100.0% (25/25)** | [`docs/evidence/raw/proposals-success-2026-11-14.json`](file:///docs/evidence/raw/proposals-success-2026-11-14.json) |
| **Median Latency (p50)** | ≤ 5,000 ms | **3,242 ms** | [`docs/instant-success-table.md`](file:///docs/instant-success-table.md) |
| **95th Percentile Latency (p95)** | ≤ 25,000 ms | **20,194 ms** | [`docs/instant-success-table.md`](file:///docs/instant-success-table.md) |
| **Calldata Actions Decoded** | 100% | **30 / 30 actions** | [`docs/evidence/raw/proposals-success-2026-11-14.json`](file:///docs/evidence/raw/proposals-success-2026-11-14.json) |

Full proposal breakdown: [`docs/instant-success-table.md`](docs/instant-success-table.md).

---

## Authoritative Engine vs. AI Advisory Insights

CallScope draws a strict boundary between what is mathematically proven on-chain and what is suggested by AI models:

| Deterministic Engine (Authoritative) | AI Sponsor Layer (Advisory Only) |
| :--- | :--- |
| **EVM Calldata Decoding**: 4-byte selector resolution, typed parameter unpack, and raw hex preservation via `viem`. | **Semantic Summaries**: High-level natural-language summaries of author intent and proposal context. |
| **Solidity AST Capability Parsing**: Parses verified contract source via `@solidity-parser/parser` to determine exact function gates (`onlyRole`, `hasRole`, OpenZeppelin variants). | **OpenServ SERV Tool-Grounded Investigation**: Uses engine tools (`get_action`, `get_role_capabilities`) to cite verifiable facts. |
| **Deterministic Recipient Profiling**: Verifies EOA vs contract bytecode (`eth_getCode`), contract verification status, and deployment timestamp relative to proposal creation. | **Dolphin Adversarial Attack Scenarios**: Generates concrete multi-step attack scenarios tested via the engine rebuttal loop. |
| **Claims Ledger Verification**: Verifies quote presence verbatim against description; marks claims as `verified`, `contradicted`, or `not_checkable`. | **Tri-Reviewer Agreement Strip**: Visual consensus comparison across Engine, SERV extended check, and Dolphin attack scenarios. |
| **Final Assessment Verdict**: Strict precedence hierarchy (`review_recommended` > `analysis_incomplete` > `no_significant_issue_detected`). AI cannot override. | **Zero Verdict Authority**: Invariant to prompt injections, model hallucinations, or provider downtime. |

---

## Sponsor Integrations

### 1. OpenServ SERV Track

- **Single Model Resolver**: `server/providers/serv-model.ts` reads `SERV_MODEL`, validates against `eval/serv-model-catalog.json` (fetched from OpenServ `/v1/models`), and throws at startup if invalid.
- **Canonical Model Selected**: **`serv-swift`**. In our live candidate comparison on ENS and Unlock descriptions, `serv-swift` delivered **4,336 ms** mean latency vs **13,270 ms** for `serv-standard`, achieved identical 100% quote validity, and halved execution cost ($0.125 / 1M prompt vs $0.250 / 1M). See [`docs/model-selection.md`](docs/model-selection.md) and [`docs/evidence/raw/model-comparison-2026-11-14.json`](docs/evidence/raw/model-comparison-2026-11-14.json).
- **Native Marker Tools**: Declared in the `tools` array per OpenServ specifications: `{ type: 'function', function: { name: 'serv_prompt_guard' } }` and `{ type: 'function', function: { name: 'serv_shadow_agent', parameters: { ... } } }`.
- **Prompt Guard Live Experiment**: Evaluated on live OpenServ endpoints with a known injection string with and without the marker tool. Both turns returned HTTP 200 with clean, explicit refusal (`[]`) and zero false positives across all pinned proposal descriptions. See [`docs/evidence/raw/guard-2026-11-14.json`](docs/evidence/raw/guard-2026-11-14.json).
- **Correct Catalog Pricing**: OpenServ API returns pricing in standard milli-cents ($0.125 / 1M prompt tokens and $0.650 / 1M completion tokens). Earlier repository notes mis-transcribing this as $125 / $650 have been corrected.

### 2. Dolphin Lighthouse Track

- **Targeted Adversarial Stress-Testing**: Dispatched during Deep Review to generate up to 3 adversarial attack scenarios and governance questions for proposers.
- **Scenario-Specific Rebuttal Engine**: `evaluateScenarioRebuttal` performs scenario-specific verification:
  - Privilege use → verified against AST role capability (`schedule()`, `grantRole()`).
  - Expiry / term claims → verified whether any action encodes role revocation or renunciation.
  - Self-escalation → verified whether grantee address can grant roles to itself.
- **Regression Protection**: Tested by `tests/unit/scenario-rebuttal.test.ts` to ensure distinct scenario types produce differentiated, non-identical evidence.
- **Attribution**: Transparently labeled in UI and exports as `Dolphin Lighthouse · <model returned>`.

---

## Evaluation & Ablation: Limitations & Developer Stance

CallScope takes an honest, evidence-first approach to model evaluation:

- **Developer Self-Check**: The initial evaluation in `eval/sponsor-contribution.ts` was a **developer self-check (n=4, two synthetic fixtures, agent-authored expectations)**. In accordance with empirical standards, all "Sponsor Target" and "PASSED" self-ratings have been removed.
- **Limitations of AI Ablations**: A statistically rigorous ablation requires an independently curated ground truth dataset with human-authored labels (`eval/ground-truth.json`). CallScope developers do not author ground-truth labels for their own evaluation or grade their own models.
- **Spend Tracking & Credit Protection**: All live API usage is metered and logged in [`docs/spend-log.md`](docs/spend-log.md). The application implements strict daily spend caps (`SERV_DAILY_CAP_USD`, `DOLPHIN_DAILY_CAP_USD`) and an emergency kill switch (`AI_PAUSED=true`) in `server/budget.ts`. Pinned examples serve stored live outputs so judges and delegates consume zero credits.

---

## Local Setup & Hermetic Testing

CallScope separates hermetic offline unit tests from live network suites:

### 1. Installation
```bash
git clone https://github.com/Anekenonso/CallScope.git
cd CallScope
pnpm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```
Configurable options:
- `SERV_API_KEY`: OpenServ API key
- `DOLPHIN_API_KEY`: Dolphin API key
- `SERV_MODEL`: Default `serv-swift` (validated against catalog)
- `SERV_DAILY_CAP_USD`: Daily spend cap (default: $1.00)
- `DOLPHIN_DAILY_CAP_USD`: Daily spend cap (default: $1.00)
- `AI_PAUSED`: Emergency kill-switch (`true` disables AI calls, baseline remains fully functional)

Default RPC Gateways:
- **Ethereum**: `https://gateway.tenderly.co/public/mainnet`
- **Base**: `https://base-rpc.publicnode.com`

### 3. Hermetic Offline Testing
CallScope enforces hermetic testing via `tests/setup-hermetic.ts`, which blocks all outbound network calls during test execution:
```bash
# Run hermetic offline unit test suite (253 automated tests across 30 suites, 0 network calls)
pnpm test

# Run consistency checker ensuring README matches codebase constants
pnpm check:readme

# Typecheck TypeScript codebase
pnpm typecheck

# Build client bundle and prebundle SSR serverless functions
pnpm build
```

---

## Submission & Evidence Index

- **Walkthrough & Demo Script (≤ 90s)**: [`docs/demo-script.md`](docs/demo-script.md)
- **Track-by-Track Requirements Matrix**: [`docs/SUBMISSION.md`](docs/SUBMISSION.md)
- **Architecture Decisions (ADR 01–06)**: [`docs/decisions.md`](docs/decisions.md)
- **Changelog**: [`CHANGELOG.md`](CHANGELOG.md)
- **API Spend Log**: [`docs/spend-log.md`](docs/spend-log.md)
- **Raw Evidence Directory**:
  - Prompt Guard Experiment: [`docs/evidence/raw/guard-2026-11-14.json`](file:///docs/evidence/raw/guard-2026-11-14.json)
  - Candidate Model Comparison: [`docs/evidence/raw/model-comparison-2026-11-14.json`](file:///docs/evidence/raw/model-comparison-2026-11-14.json)
  - 3-Tier Latency Benchmark: [`docs/evidence/raw/latency-2026-11-14.json`](file:///docs/evidence/raw/latency-2026-11-14.json)
  - 25-Proposal Success Table: [`docs/evidence/raw/proposals-success-2026-11-14.json`](file:///docs/evidence/raw/proposals-success-2026-11-14.json)

---

## License

MIT License. Built for the OpenServ SERV Hackathon.
