# Measured Sponsor Impact Report: OpenServ SERV & Dolphin

This report documents empirical benchmarks comparing CallScope proposal analysis with **Sponsors OFF** (pure deterministic engine) versus **Sponsors ON** (OpenServ SERV & Dolphin advisory layer).

> [!NOTE]
> Benchmarks executed on pinned event snapshots to measure exact algorithmic latency, claim extraction density, and reviewer agreement behavior without public RPC jitter.

## 1. Executive Summary: The Non-Negotiable Invariance Rule

CallScope strictly enforces that **deterministic assessments are 100% invariant** to the presence or absence of sponsor LLMs. As measured below, turning sponsors ON does **not** alter findings count, action count, or assessment outcomes.

| Fixture | Assessment (Sponsors OFF) | Assessment (Sponsors ON) | Invariance Status |
| :--- | :--- | :--- | :---: |
| **ENS EP 6.50 (Ethereum Mainnet)** | `review_recommended` | `review_recommended` | ✅ 100% INVARIANT |
| **Unlock Protocol (Base Mainnet)** | `analysis_incomplete` | `analysis_incomplete` | ✅ 100% INVARIANT |

---

## 2. Latency Benchmarks (Two-Phase Execution)

Phase 1 returns immediately to delegates. Phase 2 loads in the background via `/api/review` without blocking UI interaction.

| Fixture | Phase 1 Latency (Deterministic UI) | Phase 2 Advisory Latency | Total End-to-End |
| :--- | :---: | :---: | :---: |
| **ENS EP 6.50 (Ethereum Mainnet)** | **4555 ms** | 28 ms | 4583 ms |
| **Unlock Protocol (Base Mainnet)** | **8342 ms** | 28 ms | 8370 ms |

---

## 3. Structured Claim Extraction & Reviewer Agreement

| Fixture | Claims Extracted | Verified Claims | Contradictions | SERV Items | Dolphin Items | Agreement Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **ENS EP 6.50 (Ethereum Mainnet)** | 0 | 0 | 0 | 2 | 1 | **Reviewers agree** (`agree`) |
| **Unlock Protocol (Base Mainnet)** | 0 | 0 | 0 | 1 | 1 | **Reviewers disagree: human review needed** (`disagree`) |

---

## 4. Qualitative Insights per Fixture

### ENS EP 6.50 (Ethereum)
- **Deterministic Findings**: Flags sensitive `PROPOSER_ROLE` grant to the Security Council multisig with verified OpenZeppelin `cancel()` capability.
- **Sponsor Depth**: OpenServ SERV detects discrepancy between proposal description claiming the Council *"cannot propose, amend, or initiate"* while calldata assigns `PROPOSER_ROLE`.
- **Reviewer Alignment**: Engine flags `review_recommended` and sponsors agree that privileged administrative access is being granted.

### Unlock Protocol (Base)
- **Deterministic Findings**: Decodes six consecutive ERC-20 token transfers across USDC and UPToken through verified proxies.
- **Sponsor Depth**: OpenServ SERV verifies all six transfer amounts and recipient addresses against stated budget allocations.
- **Reviewer Alignment**: Deterministic engine issues `no_significant_issue_detected` with mandatory limitation notice; sponsors confirm no hidden admin changes or unstated destinations.
