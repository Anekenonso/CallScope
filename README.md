# Callscope

> Callscope helps DAO delegates understand what a governance proposal will actually execute before voting.

[![Live Application](https://img.shields.io/badge/Live_App-callscope--five.vercel.app-2563eb?style=flat-square)](https://callscope-five.vercel.app/)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Anekenonso%2FCallScope-181717?style=flat-square&logo=github)](https://github.com/Anekenonso/CallScope)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![Viem](https://img.shields.io/badge/Viem-2.21-black?style=flat-square)](https://viem.sh/)

Callscope retrieves on-chain governance proposal data, decodes executable calldata into human-readable actions, identifies sensitive operations, evaluates description-action consistency, and integrates parallel adversarial AI reviews powered by **OpenServ SERV** and **Dolphin**.

The deterministic analysis engine is authoritative. AI advisory reviews provide complementary analysis but cannot alter verified on-chain facts or downgrade security findings.

---

## The Problem

DAO governance proposals frequently combine an extensive narrative description with an array of raw contract calls. While delegates review forum posts, rationale documents, and markdown summaries, the blockchain only executes the raw byte arrays submitted to the Governor contract.

This gap creates material risks for DAOs:
- **Calldata Discrepancies**: A proposal may claim to fund a development initiative while the executable payload transfers funds to an unmentioned address or alters unrelated contract parameters.
- **Privilege Escalation**: Governance payloads may include sensitive administrative calls—such as `grantRole`, `changeAdmin`, or `transferOwnership`—that are omitted or downplayed in the narrative text.
- **Proxy Upgrades**: Proposals may redirect proxy implementations (`upgradeTo`, `upgradeToAndCall`) without clearly documenting the new implementation's code changes.
- **Unbounded Approvals**: Token transfers or approval operations may grant infinite (`type(uint256).max`) allowances to third-party contracts.
- **Review Overhead**: Inspecting raw calldata manually requires downloading contract ABIs, decoding function selectors, formatting hexadecimal parameters, and cross-referencing on-chain addresses. Most delegates lack the time or tooling to perform this verification under tight voting deadlines.

Callscope automates this verification pipeline, providing delegates with deterministic evidence of what a proposal will actually execute.

---

## How Callscope Works

Callscope executes a seven-stage analysis pipeline combining deterministic on-chain verification with AI-assisted advisory review:

```
[Governor Address + Proposal ID (+ Optional Creation Tx)]
                           │
                           ▼
               1. Proposal Retrieval
         (State & snapshot verified via RPC)
                           │
                           ▼
         2. Event & Execution Data Recovery
        (ProposalCreated log parsed via receipt/filter)
                           │
                           ▼
          3. ABI Resolution & Call Decoding
     (Dynamic fetch from Blockscout/Sourcify + Viem)
                           │
                           ▼
          4. Deterministic Finding Detection
   (Rules: value transfers, roles, upgrades, approvals)
                           │
                           ▼
        5. Proposal-Description Consistency
          (Deterministic cross-reference checks)
                           │
                           ▼
            6. Sponsor Advisory Reviews
          ┌────────────────┴────────────────┐
          ▼                                 ▼
   OpenServ SERV                         Dolphin
(Consistency Review)               (Adversarial Risks)
          └────────────────┬────────────────┘
                           ▼
       7. Consolidated Assessment & Evidence
    (Structured outcome: Review recommended / Clean / Incomplete)
```

1. **Proposal Retrieval**: Queries the target Governor contract on Ethereum Mainnet or Base Mainnet using JSON-RPC calls (`state`, `proposalSnapshot`) to verify proposal existence and current lifecycle status.
2. **Event & Execution Data Recovery**: Recovers the canonical `ProposalCreated` event log containing target contracts, call values, function signatures, and calldata payloads. If an optional proposal creation transaction hash or explorer URL is provided, Callscope fetches the transaction receipt directly via `eth_getTransactionReceipt`, avoiding slow block range filtering.
3. **ABI Resolution & Calldata Decoding**: Resolves verified contract ABIs dynamically from Blockscout and Sourcify, unwraps EIP-1967 proxy implementations, and decodes 4-byte selectors, typed arguments, and legacy Compound Bravo signatures using Viem.
4. **Deterministic Finding Detection**: Runs decoded actions against rule-based security checks to identify sensitive operations (native transfers, role grants, admin changes, proxy upgrades, infinite approvals, and undecoded payloads).
5. **Proposal-Description Consistency Analysis**: Compares claims made in the proposal description against the decoded executable actions to detect unmentioned operations or parameter mismatches.
6. **OpenServ SERV & Dolphin Advisory Reviews**: Dispatches parallel prompts to OpenServ SERV and Dolphin. SERV evaluates whether the description accurately reflects the executable payload, while Dolphin performs adversarial threat modeling. Both require explicit action-index citations.
7. **Consolidated Assessment & Evidence Trail**: Synthesizes deterministic findings, consistency markers, and advisory reviews into a single structured assessment accompanied by full parameter tables and raw calldata.

---

## Core Capabilities

- **Supported Networks**: Production support for **Ethereum Mainnet** (`chainId: 1`) and **Base Mainnet** (`chainId: 8453`).
- **Governor & Proposal Lookup**: Direct lookup by Governor contract address and numeric Proposal ID.
- **Creation Transaction Recovery**: Accepts an optional transaction hash or explorer URL to decode proposals immediately via direct receipt retrieval without requiring full block-range event scans.
- **Dynamic ABI Resolution**: Automatically queries Blockscout and Sourcify for contract ABIs and resolves implementation contracts behind EIP-1967 proxies. Built-in fallbacks cover canonical ABIs (ERC-20, OpenZeppelin TimelockController, AccessControl).
- **Executable Action Decoding**: Decodes targets, call values, function names, and typed arguments (addresses, token values, basis points, durations, role identifiers).
- **Sensitive Operation Detection**:
  - Native ETH / ETH value transfers (`value > 0`).
  - AccessControl modifications (`grantRole`, `revokeRole`) with canonical role hash matching (`DEFAULT_ADMIN_ROLE`, `PROPOSER_ROLE`, `EXECUTOR_ROLE`, `CANCELLER_ROLE`, `TIMELOCK_ADMIN_ROLE`, `MINTER_ROLE`, `PAUSER_ROLE`, `UPGRADER_ROLE`).
  - Ownership transfers (`transferOwnership`).
  - Proxy upgrades (`upgradeTo`, `upgradeToAndCall`).
  - Admin changes (`changeAdmin`).
  - Infinite/unbounded ERC-20 approvals (`approve` with maximum `uint256` value).
  - Opaque or undecoded calldata calls.
- **Description-Action Consistency**: Deterministically checks whether decoded targets and functions correspond to claims in the proposal title and description.
- **Advisory Sponsor Reviews**: Gated LLM reviews with strict JSON output schemas, timeout boundaries, and citation requirements.
- **Evidence Inspection**: Provides deep-links to verified block explorers (Etherscan, Basescan, Blockscout), raw calldata viewers, and decoded parameter tables.

---

## Assessment Outcomes

Every Callscope analysis resolves into one of three distinct assessment outcomes:

| Assessment Outcome | Condition | Implication for Delegates |
| :--- | :--- | :--- |
| **Review recommended** | Sensitive operations detected (admin changes, role grants, upgrades, value transfers, infinite approvals), material description discrepancies, or undecoded actions. | **Action required**: Delegates should manually inspect the flagged actions and verify authorization before voting. |
| **No significant issue detected** | All executable actions fully decoded; no sensitive operations, discrepancies, or high-severity findings detected. | **Advisory only**: Standard operations detected. Accompanied by mandatory disclaimer: *This does not constitute an audit or guarantee of safety.* |
| **Analysis incomplete** | Proposal creation logs could not be recovered (e.g. RPC log search limits) or one or more calldata payloads could not be decoded due to unverified ABIs. | **Incomplete verification**: Calldata could not be fully proven. Callscope **never** issues a clean assessment when calldata remains opaque. |

### Key Assessment Principles

1. **Deterministic Authority**: The deterministic engine dictates the primary assessment status. AI advisory reviews cannot downgrade a `Review recommended` assessment or clear sensitive findings.
2. **Fail-Closed on Opaque Calls**: If any executable action cannot be decoded due to a missing or unresolved ABI, the analysis is marked `Analysis incomplete` or flagged as a high-severity finding. Undecoded calldata is never presumed safe.
3. **Advisory Role of AI**: OpenServ SERV and Dolphin provide supplemental analysis. Their outputs are clearly delineated in the interface as advisory commentary, not deterministic security assertions.
4. **Independent Relevance**: Individual findings (e.g. native value transfers or parameter updates) remain documented in the evidence table even if they do not change the top-level assessment status.

---

## Sponsor Integrations

Callscope integrates two specialized AI models to provide orthogonal review perspectives alongside deterministic checks:

### OpenServ SERV (`serv-mini` / `serv-swift`)
- **Role**: Proposal-description and executable-action consistency reviewer.
- **Function**: Compares the author's stated proposal text against the verified executable actions. Identifies unmentioned actions, misrepresented recipient addresses, and discrepancies between narrative intent and execution calldata.
- **Constraints**: Requires structured JSON responses with explicit citations of verified action indices. Cannot introduce unverifiable claims.

### Dolphin (`deepseek-ai/DeepSeek-V4.1-Flash`)
- **Role**: Adversarial risk and threat-modeling reviewer.
- **Function**: Analyzes decoded actions from the perspective of an external adversary or governance attacker. Evaluates potential privilege escalation paths, timelock bypasses, multisig centralization risks, and dependency assumptions.
- **Constraints**: Generates up to three prioritized threat scenarios, each citing specific action indices or deterministic finding IDs.

### Fail-Safe Integration Design
- Both integrations operate with strict timeout bounds (~15s) executed in parallel.
- If sponsor API keys are not configured or upstream inference fails, the application completes deterministic analysis and surfaces findings with clear provider status tags (`not_configured` or `unavailable`), ensuring zero disruption to core functionality.

---

## Supported Networks & Compatibility

### Supported Networks

| Network | Chain ID | Default RPC Provider | Explorer Support |
| :--- | :--- | :--- | :--- |
| **Ethereum Mainnet** | `1` | Tenderly Gateway (`gateway.tenderly.co/public/mainnet`) | Etherscan / Blockscout |
| **Base Mainnet** | `8453` | Tenderly Gateway (`base.gateway.tenderly.co`) | Basescan / Blockscout |

### Governance Standard Compatibility

- **OpenZeppelin Governor**: Full support for standard `ProposalCreated` event signatures:
  - `ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)` (unindexed and indexed `proposalId` / `proposer` variants).
- **Compound Bravo Governor**: Support for Bravo `ProposalCreated` events with legacy signature decoding:
  - `ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)` using function signatures to decode calldata arguments.
- **Timelock & Proxy Standards**: EIP-1967 transparent and beacon proxies, OpenZeppelin `AccessControl` and `TimelockController`.

### Unsupported Formats
- Custom governance implementations with proprietary, non-standard event schemas.
- Off-chain voting systems (e.g. Snapshot spaces) without on-chain execution payloads.
- Multi-signature wallets (e.g. Safe) that do not emit standard Governor creation events.

---

## Real Product Evidence

The live application was verified against three real-world Base Mainnet proposals representing distinct execution patterns:

### Scenario 1: Unlock DAO (Sensitive Operations & Transfers)
- **Governor Address**: `0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9`
- **Proposal ID**: `27419154582993156392805749742953507877176483681373228046916881327937839104508`
- **Creation Tx**: `0xa7ba89ff0db229f6f00b01d9d5f006c1db8c0591ffba8c7cb1c6f6b5e0d5b385`
- **Outcome**:
  - Proposal metadata and state retrieved successfully.
  - 6 executable actions decoded (token `transfer` calls).
  - Deterministic findings flagged for token distribution actions.
  - Assessment status: **`Review recommended`**.
  - Both OpenServ SERV and Dolphin returned structured advisory reviews citing action indices.

### Scenario 2: Summer SIP 4.2 with Creation Tx (Clean Parameter Updates)
- **Governor Address**: `0x4cEeE1b6289624d381383C1Bb42B118d5f2c3274`
- **Proposal ID**: `67980167403673109499075429330278697663140272061888632626477705936897665178458`
- **Creation Tx**: `0x6c1eec8ddfaa65a308c4b404852e2fdda0d911365bde23ceb51986ca8ca04554`
- **Outcome**:
  - Proposal metadata and state retrieved successfully.
  - 2 executable actions decoded (`setQuorumNumerator`, `setProposalThreshold`).
  - Zero sensitive findings detected; description consistency marked consistent.
  - Assessment status: **`No significant issue detected`** (accompanied by mandatory limitation notice).
  - Both OpenServ SERV and Dolphin returned structured reviews confirming parameter alignment.

### Scenario 3: Summer SIP 4.2 without Creation Tx (Partial Recovery Handling)
- **Governor Address**: `0x4cEeE1b6289624d381383C1Bb42B118d5f2c3274`
- **Proposal ID**: `67980167403673109499075429330278697663140272061888632626477705936897665178458`
- **Creation Tx**: Omitted.
- **Outcome**:
  - Proposal on-chain state verified via RPC calls.
  - Public RPC block-range query throttled; creation event log was unrecovered within timeout limits.
  - Executable actions could not be decoded.
  - Assessment status: **`Analysis incomplete`**.
  - Displayed a high-severity finding: proposal event recovery unfulfilled.
  - AI sponsor reviews gracefully marked unavailable rather than hallucinating over missing actions.

---

## Technology Stack

The Callscope repository consists of the following core dependencies:

- **Frontend Framework**: [React 18.3](https://react.dev/) with [TypeScript 5.6](https://www.typescriptlang.org/)
- **Build Tool & Bundler**: [Vite 5.4](https://vitejs.dev/) with `@vitejs/plugin-react`
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **EVM Client & ABI Utilities**: [Viem 2.21](https://viem.sh/) (EIP-1193, ABI encoding/decoding, contract calls)
- **Test Runner**: [Vitest 2.1](https://vitest.dev/)
- **Deployment Platform**: [Vercel](https://vercel.com/) (Vercel Serverless Functions via Node.js runtime)

---

## Local Setup

### Prerequisites

- Node.js version 18.x or 20.x
- npm version 9.x or higher

### 1. Clone the Repository

```bash
git clone https://github.com/Anekenonso/CallScope.git
cd CallScope
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the sample environment file to create a local configuration:

```bash
cp .env.example .env.local
```

Configure the environment variables in `.env.local`:

```ini
# RPC Endpoints (Optional: defaults to public Tenderly gateway if left blank)
ETHEREUM_RPC_URL=
BASE_RPC_URL=

# OpenServ SERV Provider (Optional: deterministic analysis runs without keys)
SERV_API_KEY=
SERV_MODEL=serv-mini

# Dolphin Provider (Optional: deterministic analysis runs without keys)
DOLPHIN_API_KEY=
DOLPHIN_MODEL=deepseek-ai/DeepSeek-V4.1-Flash
```

- **RPC Endpoints**: Free public archive RPCs are used by default. For production-grade rate limits, provide dedicated endpoints (Alchemy, Infura, QuickNode, Tenderly).
- **Sponsor API Keys**: Both `SERV_API_KEY` and `DOLPHIN_API_KEY` are optional. If omitted, Callscope performs complete deterministic on-chain decoding, finding detection, and consistency checks, marking sponsor reviews as unconfigured.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Run Verification Commands

Run the test and build commands as configured in `package.json`:

```bash
# Run static type checking
npm run typecheck

# Run unit tests
npm test

# Run live network integration tests (requires network access)
npm run test:live

# Build the production bundle
npm run build

# Preview the production build locally
npm run preview
```

---

## Limitations

To maintain technical integrity, reviewers and users should be aware of Callscope's current operational boundaries:

1. **Static Analysis Only**: Callscope decodes calldata and analyzes parameters statically. It does not fork state or simulate execution. It cannot predict dynamic reverts caused by contract state, timestamp checks, or balance changes that occur between voting and execution.
2. **Unverified Contract ABIs**: If a target contract is not verified on Blockscout or Sourcify and does not match canonical interfaces (ERC-20, Timelock, AccessControl), its calldata cannot be decoded into structured parameters and will be flagged as opaque.
3. **RPC Log Filtering Constraints**: Many public RPC nodes restrict historical log query block ranges. For older proposals, providing the proposal creation transaction hash or explorer URL is recommended to ensure instant decoding.
4. **Nested or Indirect Execution**: If a governance proposal calls an intermediate executor (e.g. an arbitrary multicall or custom relayer) that dynamically unpacks internal instructions, Callscope decodes the outer call but cannot introspect internal delegatecalls without trace simulation.
5. **No Source Code Audit**: Callscope verifies that calldata matches the stated actions; it does not audit the implementation code of the target contracts for reentrancy bugs, logic flaws, or oracle manipulation vulnerabilities.

---

## What Callscope Is Not

To maintain strict evaluation boundaries, Callscope is explicitly scoped:
- **Not an automated voting platform**: Callscope does not cast votes or execute transactions.
- **Not a transaction simulator**: It performs static calldata decoding and rule analysis; it does not simulate EVM state transitions or execute forks.
- **Not a smart contract security auditor**: It does not audit contract source code for logic bugs, economic exploits, or reentrancy vectors.
- **Not a wallet or DAO management platform**: It provides read-only inspection for delegates and reviewers.
- **Not an AI chatbot**: All analysis outputs are structured, reproducible findings tied directly to verified calldata and event logs.
- **Not a guarantee of proposal safety**: A clean analysis indicates no recognized sensitive operations were detected, not that the proposal is risk-free.

---

## License

This project is licensed under the MIT License. Built for the OpenServ SERV Hackathon.
