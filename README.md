# Callscope

> Focused, evidence-based DAO proposal executable analysis tool for delegates and technical reviewers. Built for the OpenServ SERV Hackathon.

Callscope inspects on-chain governance proposals on **Ethereum Mainnet** and **Base Mainnet**, decodes their executable actions, identifies sensitive operations (permission grants, upgrades, token transfers, admin changes), analyzes description-action consistency, and integrates bounded advisory reviews powered by **OpenServ SERV** and **Dolphin**.

The deterministic analysis engine remains strictly authoritative. AI sponsor reviews provide complementary context and cannot alter verified on-chain facts or downgrade security assessments.

---

## Key Features

- **Direct On-Chain Retrieval**: Fetches exact `ProposalCreated` event logs and current proposal state directly from verified RPC endpoints (Tenderly / public archive nodes).
- **Automated ABI Resolution**: Dynamically resolves verified contract ABIs from Blockscout v2 and Sourcify, with automatic ERC-1967/1822 proxy implementation resolution.
- **Calldata & Legacy Signature Decoding**: Decodes 4-byte selectors, typed arguments, and legacy separate signatures using `viem`.
- **Deterministic Assessment Engine**: Rule-based findings engine identifying sensitive operations (`grantRole`, `revokeRole`, `transferOwnership`, `upgradeTo`, `changeAdmin`, infinite approvals) and canonical role semantics (e.g. `PROPOSER_ROLE`, `DEFAULT_ADMIN_ROLE`).
- **Description / Action Consistency**: Deterministic cross-examination comparing claims in the proposal description against verifiable executable calls to flag omissions and discrepancies.
- **Sponsor Advisory Reviews**:
  - **OpenServ SERV**: Deep semantic analysis comparing description claims against executable calldata to spot unstated consequences.
  - **Dolphin (`deepseek-ai/DeepSeek-V4.1-Flash`)**: Bounded secondary reviewer examining deterministic findings and challenging unverified conclusions.
- **Strict Assessment Precedence**: Every analysis resolves strictly into one of three approved outcomes:
  1. `Review recommended`: Significant findings, sensitive operations, or material discrepancies.
  2. `Analysis incomplete`: One or more actions could not be decoded or contracts lack verified ABIs (a clean verdict is **never** issued for opaque actions).
  3. `No significant issue detected`: Accompanied by an explicit limitation notice (*"Analysis found no sensitive operations or discrepancies among verified actions. This does not constitute an audit or guarantee of safety."*).
- **Restrained Linear-Grade Interface**: Single-page design following `DESIGN.md`. Zero marketing fluff, no fake metrics, no confidence scores, and no misleading "safe" badges. Fully responsive down to 320px width.

---

## Tech Stack

- **Frontend**: Vite 5, React 18, TypeScript, custom restrained CSS design system.
- **Blockchain**: `viem` 2, Tenderly RPC gateways, Ethereum Mainnet (Chain ID 1), Base Mainnet (Chain ID 8453).
- **Contract Verification**: Blockscout v2 REST API, Sourcify open repository.
- **Sponsor AI Providers**: OpenServ inference API (`serv-mini`), Dolphin Lighthouse API (`deepseek-ai/DeepSeek-V4.1-Flash`).
- **Serverless API**: Vercel Serverless Functions (`/api/analyse`).

---

## Quick Start

### 1. Prerequisites
- Node.js 20+
- `pnpm` (or `npm`)

### 2. Installation
```bash
git clone <repository-url>
cd callscope
pnpm install
```

### 3. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` to configure your keys (never commit `.env`):
```env
# Optional custom RPC URLs (defaults to public Tenderly gateways)
ETHEREUM_RPC_URL=https://gateway.tenderly.co/public/mainnet
BASE_RPC_URL=https://base.gateway.tenderly.co

# OpenServ SERV provider
SERV_API_KEY=your_openserv_api_key
SERV_MODEL=serv-mini

# Dolphin provider
DOLPHIN_API_KEY=your_dolphin_api_key
DOLPHIN_MODEL=deepseek-ai/DeepSeek-V4.1-Flash
```

> **Note on credentials**: If sponsor keys are omitted, Callscope continues to operate normally; deterministic on-chain analysis runs with full accuracy, and sponsor review cards display a graceful `Not configured` status.

### 4. Running Locally
Start the development server:
```bash
pnpm dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser. The development server includes an integrated API middleware that executes the full analysis engine locally.

---

## Hackathon Demo Fixtures

Callscope includes one-click buttons on the interface to test two real-world governance reference proposals:

### Fixture 1: ENS — Ethereum Mainnet
- **Network**: `Ethereum`
- **Governor Address**: `0x323A76393544d5ecca80cd6ef2A560C6a395b7E3`
- **Proposal ID**: `77767899528494238518019756391533686963875234067646094287125791110488147463806`
- **What it does**: Grants `PROPOSER_ROLE` on the ENS `TimelockController` to the newly elected Security Council multisig (`0x2acBf518b3759f6e1fA163294eda55bF1d0ae051`).
- **Expected Outcome**: `Review recommended`. Callscope identifies the sensitive permission grant, resolves `PROPOSER_ROLE`, analyzes the Security Council description, gathers OpenServ & Dolphin reviews, and presents verified on-chain evidence without falsely classifying the action as malicious.

### Fixture 2: Unlock Protocol — Base Mainnet
- **Network**: `Base`
- **Governor Address**: `0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9`
- **Proposal ID**: `27419154582993156392805749742953507877176483681373228046916881327937839104508`
- **What it does**: Executes six consecutive ERC-20 `transfer(address,uint256)` actions (3 USDC transfers and 3 UPToken transfers).
- **Expected Outcome**: `No significant issue detected`. Callscope decodes all 6 actions through verified proxy implementations, displays exact amounts and recipients, preserves sequence, confirms consistency with description claims, and attaches the mandatory limitation disclaimer.

---

## Testing & Quality Assurance

Callscope includes extensive unit, integration, SSR, and adversarial pressure tests:

```bash
# Typecheck TypeScript codebase
pnpm typecheck

# Run complete test suite (80+ automated tests)
pnpm test

# Build production bundle
pnpm build
```

### Test Coverage Highlights
- **Unit Tests**: Input validation, RPC client verification, 4-byte selector decoding, legacy calldata parsing, sensitive finding detection rules, consistency checks, precedence hierarchy, sponsor provider error handling (401, 402, 429, 503, timeouts), and React SSR rendering.
- **Live Integration Tests**: On-chain verification of ENS Ethereum and Unlock Base proposals against live public RPC and block explorers.
- **Pressure & Resilience Tests**: Malformed calldata arrays, unverified ABIs, prompt injection attacks in proposal text, simulated provider outages, and automated secret isolation bundle audits.

---

## Deployment (Vercel)

Callscope is pre-configured for one-command deployment to Vercel via `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

1. Import the repository in your [Vercel Dashboard](https://vercel.com).
2. Configure Environment Variables in the project settings:
   - `ETHEREUM_RPC_URL` (optional)
   - `BASE_RPC_URL` (optional)
   - `SERV_API_KEY`
   - `SERV_MODEL`
   - `DOLPHIN_API_KEY`
   - `DOLPHIN_MODEL`
3. Deploy! Vercel automatically builds the Vite frontend and hosts `/api/analyse` as a serverless function.

---

## License

MIT License. Built for the OpenServ SERV Hackathon.

