# Measured Sponsor Impact Report: OpenServ SERV & Dolphin

> [!WARNING]
> ### ⚠️ [SIMULATED BENCHMARK]
> This report was generated on **2026-11-11T10:15:02.793Z** in **simulated offline mode** (`pnpm compare:sponsors:sim`) for hermetic verification without live API keys.
> All sponsor responses are labeled `[SIMULATED]`. To execute against live sponsor endpoints with real API credentials, run:
> ```bash
> SERV_API_KEY=... DOLPHIN_API_KEY=... pnpm compare:sponsors:live
> ```

## 1. Executive Summary: The Non-Negotiable Invariance Rule

CallScope strictly enforces that **deterministic assessments are 100% invariant** to the presence, latency, or status of sponsor LLMs. Phase 1 outputs (actions, decodings, findings, assessment outcomes) are identical regardless of whether sponsors are configured.

| Fixture | Assessment (Baseline) | Assessment (With Sponsors) | Invariance Status |
| :--- | :--- | :--- | :---: |
| **ENS EP 6.50 (Ethereum Mainnet)** | `review_recommended` | `review_recommended` | ✅ 100% INVARIANT |
| **Unlock Protocol (Base Mainnet)** | `analysis_incomplete` | `analysis_incomplete` | ✅ 100% INVARIANT |

---

## 2. Latency Benchmarks (Two-Phase Architecture)

Phase 1 returns immediately to delegates. Phase 2 executes in the background without blocking UI interaction.

| Fixture | Mode | Phase 1 Latency (Deterministic UI) | Phase 2 Advisory Latency | Total End-to-End |
| :--- | :---: | :---: | :---: | :---: |
| **ENS EP 6.50 (Ethereum Mainnet)** | `[SIMULATED]` | **4684 ms** | 0 ms | 4684 ms |
| **Unlock Protocol (Base Mainnet)** | `[SIMULATED]` | **9217 ms** | 0 ms | 9217 ms |

---

## 3. Sponsor Depth: Tool-Grounded Investigation & Attack Scenarios

| Fixture | Claims Extracted | Verified Claims | Contradictions | SERV Cited Items | Dolphin Scenarios | Tri-Reviewer Agreement |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **ENS EP 6.50 (Ethereum Mainnet)** | 1 | 0 | 1 | 1 | 1 | **Reviewers agree** (`agree`) |
| **Unlock Protocol (Base Mainnet)** | 1 | 1 | 0 | 1 | 1 | **Reviewers disagree: human review needed** (`disagree`) |

---

## 4. Qualitative Insights per Fixture

### ENS EP 6.50 (Ethereum)
- **Deterministic Engine**: Identifies `grantRole` on TimelockController assigning `PROPOSER_ROLE` with verified `schedule()` and `cancel()` access gates.
- **OpenServ SERV**: Tool-grounded investigator uses `get_action(0)` and `get_role_capabilities` to cite verified execution facts, identifying the contradiction with the proposal's claim that the council *"cannot propose"*.
- **Dolphin**: Proposes unauthorized proposal queueing scenario; engine rebuttal loop confirms role has `schedule()` capability (`not_refuted`).
- **Reviewer Alignment**: All reviewers flag high governance risk (`agree`).

### Unlock Protocol (Base)
- **Deterministic Engine**: Decodes six consecutive ERC-20 token transfers through verified proxies; issues `no_significant_issue_detected` with mandatory limitation notice.
- **OpenServ SERV**: Tool-grounded investigator verifies transfer parameters and recipient addresses against stated milestone allocations.
- **Dolphin**: Generates adversarial treasury drain attack scenario; engine rebuttal loop disproves the scenario using 0 native ETH transfer facts (`refuted_by_data`).
- **Reviewer Alignment**: Deterministic engine is clean, SERV verifies allocations, and Dolphin attack scenario is refuted by data (`agree`).
