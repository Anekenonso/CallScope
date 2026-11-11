# CallScope 90-Second Product Demo Script

**Total Duration:** 90 seconds (1 minute, 30 seconds)  
**Target Audience:** DAO Delegates, Protocol Security Researchers, Governance Stewards  
**Resolution / Setting:** 1920x1080 (16:9), Dark Mode, System audio clear  

---

## Storyboard & Timeline

### 0:00 – 0:12: The Governance Blindspot
- **Visual:** Open CallScope in browser (`http://localhost:5173`). Clean dashboard view showing the headline: *"Deterministic DAO Calldata Intelligence"*, the pinned examples row, and dual-mode input (Governor Address + Proposal ID or Tx Hash).
- **On-Screen Action:** Mouse hovers briefly over the header pill: `Read-only · v0.1 beta`.
- **Voiceover:**
  > *"Every week, DAO delegates vote on proposals where thousands of lines of descriptive prose mask high-risk smart contract calls. Traditional LLMs hallucinate or gloss over malicious calldata. CallScope changes that. It puts a deterministic EVM decoding engine first, backed by an advisory multi-agent review layer."*

---

### 0:12 – 0:38: Fixture 1 – ENS EP 6.50 (Outcome: `Review Recommended`)
- **Visual:** Click the pinned preset pill `ETH · ENS EP 6.50 · Review Recommended`. The input fields populate automatically. Click **Analyse**.
- **On-Screen Action:** Indeterminate progress bar runs with real elapsed time timer. Within sub-seconds, Phase 1 renders instantly:
  - Banner shows: `review_recommended` (Amber/Red status).
  - Metadata grid cleanly displays Governor, Proposer, Proposal ID, and `Event source: pinned snapshot (block 25524727)`. No text collisions.
  - Findings section expands:
    - Finding 1: `Action #1 grants privileged role: PROPOSER_ROLE` with pill `Role hash matched`.
    - Function capability detail: `can schedule and cancel on TimelockController (per verified source)`.
    - Recipient profile: `Recipient: contract, verified, deployed timestamp 1783713622`.
  - Claims Ledger table displays extracted claims with status `contradicted`.
  - Sponsor reviews load asynchronously in Phase 2.
  - Reviewer Agreement Strip displays: `Reviewers agree (All reviewers identified concerns)`.
- **Voiceover:**
  > *"Look at ENS EP 6.50. In the description, the authors state the Security Council 'cannot propose, amend, or initiate actions'. But CallScope decodes the raw calldata to find a `grantRole` assigning `PROPOSER_ROLE`. By parsing the target contract's verified source code, CallScope proves this role grants the power to cancel pending DAO timelocks. The Claims Ledger flags the contradiction, and the Reviewer Agreement strip confirms that both OpenServ SERV and Dolphin agree with our deterministic engine."*

---

### 0:38 – 0:56: Fixture 2 – Clean Grant (Outcome: `No Significant Issues`)
- **Visual:** Scroll to top and click `ETH · [SYNTHETIC] Clean Grant · No Issues`. Click **Analyse**.
- **On-Screen Action:**
  - Assessment badge turns green: `no_significant_issue_detected`.
  - Action decoded: ERC-20 `transfer(to: 0xca76..., amount: 400 USDC)`.
  - Claims Ledger shows: `verified` badge linked directly to Action #1.
  - Findings count: 0 findings.
  - Reviewer Agreement Strip: `Reviewers agree (Reviewers found no conflicting issues)`.
- **Voiceover:**
  > *"Next, what does a clean proposal look like? Here is a verified ecosystem grant. All calldata decodes successfully, the recipient and 400 USDC amount match the description verbatim in our Claims Ledger, zero privileged capabilities are granted, and CallScope deterministically issues 'No Significant Issues Detected'."*

---

### 0:56 – 1:14: Fixture 3 – Opaque Multi-Sig (Outcome: `Analysis Incomplete`)
- **Visual:** Click `ETH · [SYNTHETIC] Opaque Wrapper · Incomplete`. Click **Analyse**.
- **On-Screen Action:**
  - Assessment badge displays blue/violet: `analysis_incomplete`.
  - Finding displayed: `SAFE_WRAPPER_OPAQUE_0` — `Action #1 executes via Safe transaction wrapper`.
  - Limitations card lists: `Safe transaction wrapper conceals underlying destination calls`.
  - Reviewer Agreement Strip shows advisory nuances.
- **Voiceover:**
  > *"Rule number two of CallScope: never give a false sense of security. When a proposal routes through a Gnosis Safe transaction wrapper or targets an unverified contract, CallScope refuses to certify it. It issues 'Analysis Incomplete', explicitly disclosing what cannot be deterministically verified."*

---

### 1:14 – 1:30: Live Verification, Tx-Hash Input & Final Guarantee
- **Visual:** Toggle `Re-verify live (bypass pinned snapshot)`. Click **Analyse**. Show live RPC resolution.
- **On-Screen Action:** Switch input mode tab to **Tx Hash / Explorer Link**. Paste a transaction hash (`0x76eefae46df65ef...`). The system auto-detects Ethereum network, queries the transaction receipt directly, and loads the proposal without log-scanning.
- **Voiceover:**
  > *"Delegates can also toggle live re-verification to bypass pinned snapshots, or paste any transaction hash or Etherscan URL to analyze proposals directly from block receipts. Deterministic EVM truth, verified source decompilation, and multi-agent sponsor consensus. That is CallScope."*

---

## Technical Demonstration Verification Checklist
| Step | Feature | Checked Item | Verification Output |
| :---: | :--- | :--- | :--- |
| 1 | Outcome 1 | `review_recommended` | Pinned ENS EP 6.50 displays sensitive `PROPOSER_ROLE` grant |
| 2 | Outcome 2 | `no_significant_issue_detected` | `[SYNTHETIC] Clean Grant` (999001) passes all checks |
| 3 | Outcome 3 | `analysis_incomplete` | `[SYNTHETIC] Opaque Wrapper` (999002) flags undecoded payload |
| 4 | Capabilities | Verified Source Parsing | `can schedule and cancel on TimelockController (per verified source)` |
| 5 | Profiling | Deterministic Recipient Profile | `Recipient: contract, verified` |
| 6 | Consistency | Structured Claims Ledger | Exact quote match, `verified` vs `contradicted` badges |
| 7 | Multi-Agent | Reviewer Agreement Strip | `Reviewers agree` vs `Reviewers disagree: human review needed` |
| 8 | Resiliency | Prompt-Injection Resistance | Adversarial instructions cannot alter verdicts or severities |
| 9 | Direct Input | Tx Hash / Explorer URL | Direct `eth_getTransactionReceipt` bypassing block scans |
| 10 | Live Toggle | Re-verify Live | Bypasses pinned snapshot and executes against RPC endpoints |

