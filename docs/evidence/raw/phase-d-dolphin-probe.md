# Phase D — Dolphin Lighthouse Live Verification & Rebuttal Loop Evidence

**Date:** 2026-11-14  
**Provider:** Dolphin (hosted on Dolphin Lighthouse)  
**Model:** `deepseek-ai/DeepSeek-V4.1-Flash`  
**Endpoint:** `https://lighthouse.dphn.ai/run/text-v/v1/chat/completions`  
**Test Suite:** `tests/live/dolphin-live.test.ts` (PASS in 8,357ms)  
**Evidence Record:** `docs/evidence/raw/phase-d-dolphin-probe.json`

---

## 1. Live Endpoint & Model Verification

- **Live Connectivity:** Successfully authenticated and received valid streaming chat completions from `https://lighthouse.dphn.ai/run/text-v/v1/chat/completions`.
- **Model Attribution:** Confirmed model identifier `deepseek-ai/DeepSeek-V4.1-Flash`.
- **Reasoning Handling:** DeepSeek-V4.1-Flash is an active reasoning model. Tuned token headroom (`maxTokens: 3500`) and placed internal thinking brevity directives at the top of the prompt.
- **Latency:** Completed full adversarial evaluation in ~8.3 seconds.

---

## 2. Adversarial Scenarios & Deterministic Engine Rebuttal Loop

Evaluated against the live ENS EP 6.50 proposal (granting `PROPOSER_ROLE` to Blockful Security Council):

### Generated Scenarios (Capped at 3)
1. **Critical:** *"Compromised Security Council schedules arbitrary governance actions"*
   - **Preconditions:** Council contract compromised or malicious.
   - **Step:** Uses `PROPOSER_ROLE` on `TimelockController` to schedule arbitrary governance actions.
   - **Deterministic Engine Rebuttal:** `not_refuted`
   - **Engine Audit Evidence:** *"Not refuted: Deterministic source analysis confirms granted role has schedule() capability on TimelockController."*

2. **High:** *"Permanent proposer privilege beyond the two-year term"*
   - **Preconditions:** Role has no automated on-chain expiration.
   - **Deterministic Engine Rebuttal:** `not_refuted`
   - **Engine Audit Evidence:** *"Not refuted: Deterministic source analysis confirms granted role has schedule() capability on TimelockController."*

3. **Critical:** *"Council schedules privilege escalation for itself"*
   - **Deterministic Engine Rebuttal:** `not_refuted`
   - **Engine Audit Evidence:** *"Not refuted: Deterministic source analysis confirms granted role has schedule() capability on TimelockController."*

---

## 3. Reference Integrity & 3-Item Cap

- **3-Item Cap:** Exactly 3 items returned.
- **Reference Integrity:** Every single review item references valid on-chain actions (`actionRef: 0`) and matches deterministic AST capabilities without hallucination.
- **Items Generated:**
  - `[contradiction]` The proposal motivation states the Security Council has a single power to cancel malicious proposals, but the executable action grants `PROPOSER_ROLE`, which allows scheduling arbitrary TimelockController operations.
  - `[risk]` The role grant has no on-chain expiration, so the council contract may retain `PROPOSER_ROLE` beyond the stated two-year term unless a future proposal explicitly revokes it.
  - `[risk]` The recipient is a verified contract, but the proposal does not describe its upgradeability, signer set, or compromise-resistance properties.

---

## 4. Verification Evidence Files
- `tests/live/dolphin-live.test.ts`
- `docs/evidence/raw/phase-d-dolphin-probe.json`

