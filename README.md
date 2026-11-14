# Callscope

> Focused, evidence-based DAO proposal executable analysis tool for delegates and technical reviewers. Built for the OpenServ SERV Hackathon.

Callscope inspects on-chain governance proposals on **Ethereum Mainnet** and **Base Mainnet**, decodes their executable actions, identifies sensitive operations (permission grants, upgrades, token transfers, admin changes), analyzes description-action consistency, and integrates parallel advisory AI reviews powered by **OpenServ SERV** and **Dolphin**.

The deterministic analysis engine is authoritative. AI sponsor reviews provide complementary context and cannot alter verified on-chain facts or downgrade security assessments.

---

## What Callscope Does

- **Deterministic On-Chain Retrieval**: Fetches exact `ProposalCreated` event logs and current proposal state directly from verified RPC endpoints and Blockscout with zero creation-block guessing.
- **Fail-Fast & Timeout Resilience**: Aborts nonexistent proposals in < 1.5s with HTTP 400. Wraps retrieval in a hard ~24.5s internal deadline returning structured `Analysis incomplete` (HTTP 200) instead of raw platform 504 timeouts.
- **Direct Creation Tx Hash Input**: Accepts an optional proposal creation transaction hash or explorer URL to decode actions instantaneously via `eth_getTransactionReceipt` without scanning.
- **Automated ABI Resolution & Decoding**: Dynamically resolves verified contract ABIs from Blockscout and Sourcify with proxy implementation resolution. Decodes 4-byte selectors, typed arguments, and legacy signatures using `viem`. Supports both OpenZeppelin and Compound-Bravo governance formats.
- **Deterministic Assessment Engine**: Rule-based findings engine identifying sensitive operations (`grantRole`, `revokeRole`, `transferOwnership`, `upgradeTo`, `changeAdmin`, infinite approvals) and canonical role semantics (e.g. `PROPOSER_ROLE`, `DEFAULT_ADMIN_ROLE`).
- **Description / Action Consistency**: Compares claims in the proposal description against verifiable executable calls to flag omissions and discrepancies.
- **Parallel Sponsor Advisory Reviews**:
  - **OpenServ SERV (`serv-swift`)**: Consistency reviewer evaluating whether executable actions match stated descriptions, with strict action-index citation gating.
  - **Dolphin (`deepseek-ai/DeepSeek-V4.1-Flash`)**: Adversarial risk reviewer generating up to 3 threat scenarios citing specific action indices or finding IDs with bounded reasoning tokens.
- **Strict Assessment Precedence**: Every analysis resolves strictly into one of three approved outcomes:
  1. `Review recommended`: Significant findings, sensitive operations, or material discrepancies.
  2. `Analysis incomplete`: One or more actions could not be decoded or event logs could not be proven (a clean verdict is **never** issued for opaque actions).
  3. `No significant issue detected`: Accompanied by an explicit limitation notice (*"Analysis found no sensitive operations or discrepancies among verified actions. This does not constitute an audit or guarantee of safety."*).
- **Restrained Linear-Grade Interface**: Single-page design following `DESIGN.md`. Zero marketing fluff, no fake metrics, no confidence scores, and no misleading "safe" badges. Responsive down to 320px width.

---

## Empirical Verification Results

Empirical verification executed against real on-chain proposals via `scripts/verify-real.mjs` (raw test artifacts saved in [`docs/evidence/raw/`](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/evidence/raw/)):

| Metric | Target | Measured Result |
| :--- | :--- | :--- |
| **HTTP 504 Gateway Timeouts** | 0 | **0** |
| **Ethereum Retrieval p50** | $\le$ 8,000 ms | **6,904 ms** |
| **Base Retrieval p50** | $\le$ 12,000 ms | **3,663 ms** |
| **Nonexistent Proposal Fail-Fast** | < 5,000 ms | **1,650 ms** |
| **Offline Unit Test Suite** | 100% pass | **95 / 95 passing (0 network calls)** |

### Verified Live Fixture Artifacts
- **ENS EP 6.50 (Ethereum)**: [`docs/evidence/raw/P3_live_sponsor_eth.json`](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/evidence/raw/P3_live_sponsor_eth.json)
- **Unlock Contributor Compensation (Base)**: [`docs/evidence/raw/P3_live_sponsor_base.json`](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/evidence/raw/P3_live_sponsor_base.json)

---

## Limitations

- **Not an Audit**: Callscope is an automated inspection tool, not a full smart contract audit.
- **Coverage**: Supports OpenZeppelin Governor and Compound-Bravo proposal event variants on Ethereum Mainnet and Base Mainnet. Custom or non-standard governance architectures without standard event emission cannot be decoded.
- **Static Analysis Scope**: Calldata analysis is static. Downstream state transitions, external oracle behavior, reentrancy vulnerabilities, and off-chain multisig signers are not evaluated on-chain.

---

## Environment Configuration

| Variable | Required | Description | Default |
| :--- | :--- | :--- | :--- |
| `ETHEREUM_RPC_URL` | Optional | Archive RPC endpoint for Ethereum Mainnet | `https://gateway.tenderly.co/public/mainnet` |
| `BASE_RPC_URL` | Optional | Archive RPC endpoint for Base Mainnet | `https://base.gateway.tenderly.co` |
| `SERV_API_KEY` | Optional | OpenServ inference API key | None (`not_configured` if absent) |
| `SERV_MODEL` | Optional | OpenServ model identifier | `serv-swift` |
| `DOLPHIN_API_KEY` | Optional | Dolphin Lighthouse API key | None (`not_configured` if absent) |
| `DOLPHIN_MODEL` | Optional | Dolphin model identifier | `deepseek-ai/DeepSeek-V4.1-Flash` |

---

## Quick Start

### 1. Installation
```bash
git clone <repository-url>
cd callscope
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env.local
# Add your RPC and sponsor API keys to .env.local
```

### 3. Local Development
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Running Checks
```bash
# Typecheck
npm run typecheck

# Offline unit tests
npm test

# Production build
npm run build
```

---

## License

MIT License. Built for the OpenServ SERV Hackathon.
