# CallScope 90-Second Product Demo Script

**Total Duration:** 90 seconds (1 minute, 30 seconds)  
**Target Audience:** DAO Delegates, Protocol Security Researchers, Governance Stewards  
**Resolution / Setting:** 1920x1080 (16:9), Dark Mode, System audio clear  
**Production Deployment:** [https://callscope-five.vercel.app](https://callscope-five.vercel.app)

---

## Storyboard & Timeline

### 0:00 – 0:12: The Governance Blindspot
- **Visual:** Open CallScope in browser (`https://callscope-five.vercel.app`). Clean dashboard view showing headline: *"Deterministic DAO Calldata Intelligence"*, the pinned examples row, and dual-mode input (Governor Address + Proposal ID or Tx Hash).
- **On-Screen Action:** Mouse hovers briefly over the header pill: `Read-only · v0.1 beta`.
- **Voiceover:**
  > *"Every week, DAO delegates vote on proposals where thousands of lines of descriptive prose mask high-risk smart contract calls. Traditional LLMs hallucinate or gloss over malicious calldata. CallScope changes that. It puts an authoritative deterministic EVM decoding engine first, backed by an advisory multi-agent review layer."*

---

### 0:12 – 0:38: Fixture 1 – ENS EP 6.50 (Outcome: `Review Recommended`)
- **Visual:** Click the pinned preset pill `ETH · ENS EP 6.50 · Review Recommended`. The input fields populate automatically. Click **Analyse**.
- **On-Screen Action:** Indeterminate progress bar runs with real elapsed time timer. Within sub-seconds, Phase 1 renders instantly:
  - Banner shows: `review_recommended` (Amber/Red status).
  - Metadata grid cleanly displays Governor, Proposer, Proposal ID, and `Event source: pinned snapshot (block 25524727)`.
  - Findings section expands:
    - Finding 1: `Action #1 grants privileged role: PROPOSER_ROLE` with badge `Role hash matched`.
    - Function capability detail: `can schedule and cancel on TimelockController (per verified source)` resolved via Solidity AST parsing.
    - Recipient profile: `Recipient: contract, verified`.
  - Claims Ledger table displays extracted claims with status `contradicted` against action #1.
  - Phase 2 loads in the background:
    - **OpenServ SERV**: Multi-turn ReAct investigator surfaces `serv-swift` badge, loop telemetry (`Turns: 2`, `Tool calls: 3`), verified tool evidence badge (`Tool: tool-call-1`), and in-page jump link (`Action #1 ↗`).
    - **Dolphin (`deepseek-ai/DeepSeek-V4.1-Flash` on Dolphin Lighthouse)**: Surfaces `Lighthouse · DeepSeek-V4.1-Flash` and `Scenarios: 2` badge. Renders attack scenario preconditions and step-by-step action jump links (`[Action #1 ↗]`). Engine rebuttal audit confirms role capability (`⚠ Not Refuted (Plausible Risk)`).
  - Tri-Reviewer Agreement Strip compares independent reviewer stances: Deterministic Engine (`review_recommended`), OpenServ SERV (`Identified contradictions`), and Dolphin (`Identified unrefuted threats`).
- **Voiceover:**
  > *"Look at ENS EP 6.50. In the description, the authors state the Security Council 'cannot propose, amend, or initiate actions'. But CallScope decodes the raw calldata to find a `grantRole` assigning `PROPOSER_ROLE`. By parsing the verified contract source with a full Solidity AST parser, CallScope proves this role grants the power to schedule and cancel timelocks. The Claims Ledger flags the contradiction, OpenServ SERV cites verified tool evidence across two loop turns, and Dolphin on Lighthouse proposes an attack scenario that our deterministic engine confirms as an unrefuted hazard."*

---

### 0:38 – 0:56: Fixture 2 – Clean Grant (Outcome: `No Significant Issues`)
- **Visual:** Scroll to top and click `ETH · [SYNTHETIC] Clean Grant · No Issues`. Click **Analyse**.
- **On-Screen Action:**
  - Synthetic banner indicates: `[SYNTHETIC]`. Creation tx displays: `Synthetic fixture · no on-chain transaction` without broken explorer links.
  - Assessment badge turns green: `no_significant_issue_detected` (never overclaiming 'Verified Clean').
  - Action decoded: ERC-20 `transfer(to: 0xca76..., amount: 400 USDC)`.
  - Claims Ledger shows: `verified` badge linked directly to Action #1.
  - Findings count: 0 findings.
  - Reviewer Agreement Strip: `Reviewers agree (No significant issues detected)`.
- **Voiceover:**
  > *"Next, what does a clean proposal look like? Here is a verified community grant. All calldata decodes successfully, the recipient and 400 USDC amount match the description verbatim in our Claims Ledger, zero privileged capabilities are granted, and CallScope deterministically issues 'No Significant Issue Detected'."*

---

### 0:56 – 1:14: Fixture 3 – Opaque Multi-Sig (Outcome: `Analysis Incomplete`)
- **Visual:** Click `ETH · [SYNTHETIC] Opaque Wrapper · Incomplete`. Click **Analyse**.
- **On-Screen Action:**
  - Assessment badge displays blue/violet: `analysis_incomplete`.
  - Finding displayed: `SAFE_WRAPPER_OPAQUE_0` — `Action #1 executes via Safe transaction wrapper`.
  - Limitations card lists: `Safe transaction wrapper conceals underlying destination calls`.
  - Reviewer Agreement Strip shows advisory stances.
- **Voiceover:**
  > *"Rule number two of CallScope: never give a false sense of security. When a proposal routes through a Gnosis Safe transaction wrapper or targets an unverified contract, CallScope refuses to certify it. It issues 'Analysis Incomplete', explicitly disclosing what cannot be deterministically verified."*

---

### 1:14 – 1:30: Live Verification, Tx-Hash Input & Final Guarantee
- **Visual:** Toggle `Re-verify live (bypass pinned snapshot)`. Click **Analyse**. Show live public RPC resolution.
- **On-Screen Action:** Switch input mode tab to **Tx Hash / Explorer Link**. Paste a transaction hash (`0x76eefae46df65ef...`). The system auto-detects Ethereum network, queries `eth_getTransactionReceipt` directly, and loads the proposal without log-scanning. Empty submissions display inline validation warnings.
- **Voiceover:**
  > *"Delegates can also toggle live re-verification to bypass pinned snapshots, or paste any transaction hash or Etherscan URL to analyze proposals directly from block receipts. Deterministic EVM truth, Solidity AST capability decompilation, and multi-agent sponsor consensus. That is CallScope."*

---

## Technical Demonstration Verification Checklist
| Step | Feature | Checked Item | Verification Output |
| :---: | :--- | :--- | :--- |
| 1 | Outcome 1 | `review_recommended` | Pinned ENS EP 6.50 displays sensitive `PROPOSER_ROLE` grant |
| 2 | Outcome 2 | `no_significant_issue_detected` | `[SYNTHETIC] Clean Grant` (999001) passes all checks with honest labeling |
| 3 | Outcome 3 | `analysis_incomplete` | `[SYNTHETIC] Opaque Wrapper` (999002) flags undecoded payload |
| 4 | Capabilities | Solidity AST Parser | `can schedule and cancel on TimelockController (per verified source)` via `@solidity-parser/parser` |
| 5 | Profiling | Deterministic Recipient Profile | `Recipient: contract, verified` |
| 6 | Consistency | Structured Claims Ledger | Exact quote match, `verified` vs `contradicted` badges |
| 7 | OpenServ SERV | Tool-Grounded Investigator | `serv-swift` multi-turn ReAct loop; cites `Tool: tool-call-1` evidence; displays loop telemetry (`Turns: 2`, `Tool calls: 3`) and action jump links; `serv_prompt_guard: true` |
| 8 | Dolphin | Adversarial Rebuttal Loop | `DeepSeek-V4.1-Flash` on Lighthouse; proposes attack scenarios with action links; engine tests against bytecode (`✓ Refuted by Engine Facts` vs `⚠ Not Refuted (Plausible Risk)`) |
| 9 | Agreement | Tri-Reviewer Agreement Strip | Compares independent stances: Deterministic Engine, OpenServ SERV, and Dolphin Lighthouse |
| 10 | Resiliency | Prompt-Injection Resistance | Adversarial instructions cannot alter verdicts, severities, or outcomes |
| 11 | Direct Input | Tx Hash / Explorer URL | Direct `eth_getTransactionReceipt` bypassing block scans; inline validation |
| 12 | Live Toggle | Re-verify Live | Bypasses pinned snapshot and executes against public RPC endpoints |
