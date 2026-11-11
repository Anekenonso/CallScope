# CallScope Audit Log

This document records verification evidence, test outputs, root cause investigations, and decisions across all tasks in accordance with Non-negotiable Rule 4 ("Never claim PASS without evidence").

---

## Task 0: Reproduce and Instrument (Event Lookup & Stage Tagging)

- **Status:** PASS
- **Date:** 2026-11-11
- **Focus:** Base/Unlock fixture reproduction and stage-tagged error instrumentation.

### 1. Reproduction of Base/Unlock Fixture Failure
- **Target Fixture:**
  - Network: Base (`base`, Chain ID: 8453)
  - Governor: `0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9`
  - Proposal ID: `27419154582993156392805749742953507877176483681373228046916881327937839104508`
- **Reported Error:**
  `ProposalCreated event not found for proposal ID 27419154582993156392805749742953507877176483681373228046916881327937839104508 on Governor 0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9`
- **Reproduction Result:**
  Running `tests/integration/regression-fixtures.test.ts` and `tests/integration/action-decoding.test.ts` reproduced the exact failure:
  ```text
  FAIL tests/integration/action-decoding.test.ts > Live chain integration: Action decoding for ENS & Unlock > decodes all six Unlock Base transfer actions and preserves order
  Error: ProposalCreated event not found for proposal ID 27419154582993156392805749742953507877176483681373228046916881327937839104508 on Governor 0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9
  ```

### 2. Root Cause Investigation
Our investigation uncovered a compound failure across three distinct layers:

1. **Blockscout 403 / Cloudflare Block:**
   - Querying `https://base.blockscout.com/api?module=logs&action=getLogs&...` returns HTTP 403 (Cloudflare anti-bot HTML challenge) rather than JSON API data.
   - Because `res.ok` is false, `fetchProposalEventFromBlockscout` immediately aborts and falls back to RPC.

2. **Severe Block Time Estimation Error (0.623s vs actual Base block time):**
   - The Governor contract `proposalSnapshot()` returns timestamp `1792917953n`.
   - `votingDelay()` returns `345600n` seconds (4 days).
   - Creation timepoint = `1792917953n - 345600n = 1792572353n`.
   - In `server/chain/proposal-events.ts` (line 346), the code hardcoded `const secPerBlock = network === 'base' ? 0.623 : 12;`.
   - On Base mainnet, block intervals are 2.0s (or 0.2s with fast blocks). Projecting `timeDiff / 0.623` placed `targetBlock` at `~53,014,000` or higher, while the actual `ProposalCreated` event occurred at block `52,891,503`.
   - The ring search centered on `targetBlock` with bounds `±5,000`, `±14,900`, and `±24,800` blocks. Because the estimate was off by over 122,000 blocks, all concentric rings completely missed the block.

3. **RPC Rate Limits & Archive Restrictions on Fallback Scan:**
   - Because `votingDelay` was non-null (`345600n`), the code bypassed the lookback scan.
   - The code then entered step 2: backward scanning in 9,900-block chunks starting from `latestBlock` (~55.9M) down 1,500,000 blocks.
   - Scanning 1.5M blocks requires over 150 consecutive `eth_getLogs` RPC calls.
   - On `base-rpc.publicnode.com`, queries failed with: `403: Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode`.
   - On `mainnet.base.org`, queries hit: `429: request limit reached`.
   - The operation timed out or exhausted all retries, throwing `ProposalCreated event not found`.

4. **Exact Event Coordinates Discovered:**
   - Transaction Hash: `0xa7ba89ff0db229f6f00b01d9d5f006c1db8c0591ffba8c7cb1c6f6b5e0d5b385`
   - Block Number: `52891503`
   - Target Timestamp: `1792572353`
   - Proposal ID: `27419154582993156392805749742953507877176483681373228046916881327937839104508`
   - Target count: 6 ERC-20 transfer actions

### 3. Implementation of Stage-Tagged Errors
- Added `StageTaggedError` interface to `src/types/analysis.ts` with:
  `stage`: `'input_validation' | 'network_verification' | 'governor_validation' | 'event_lookup' | 'action_decoding' | 'role_resolution' | 'consistency_check' | 'assessment' | 'sponsor_review'`
  `via`: `'blockscout' | 'rpc'`
  `reason`: `'timeout' | 'range_rejected' | 'rate_limited' | 'not_found' | 'network_error' | 'validation_error' | 'execution_error'`
  `detail`: string
- Implemented `ProposalEventLookupError` in `server/chain/proposal-events.ts`.
- Updated `api/_analyse.ts` to attach `stageTagged` to both Web Response and Node res error bodies.
- Enhanced `src/lib/api-client.ts` with `ApiError` class preserving `stageTagged`.
- Updated `src/app/App.tsx` UI error banner to display the stage tag badge and reason details.
- Added regression test suite `tests/unit/stage-tagged-errors.test.ts`.

---

## Task 1: Pinned Snapshots, Truthful UI, Tx-Hash Input & RPC Resilience

- **Status:** PASS
- **Date:** 2026-11-11
- **Focus:** Make both fixtures work reliably, add tx-hash and explorer-link input, add pinned snapshots with truthful UI attribution and live re-verification, and harden RPC fallback.

### 1. Pinned Snapshots Implementation
- Created `scripts/capture-fixture.ts` to fetch authentic on-chain `ProposalCreated` events for both fixtures directly via `eth_getTransactionReceipt`.
- Generated and committed:
  - `server/fixtures/ethereum-0x323a76393544d5ecca80cd6ef2a560c6a395b7e3-77767899528494238518019756391533686963875234067646094287125791110488147463806.json` (ENS EP 6.50, block 25524727)
  - `server/fixtures/base-0x65ba0624403fc5ca2b20479e9f626ed4d78e0ad9-27419154582993156392805749742953507877176483681373228046916881327937839104508.json` (Unlock Transfers, block 52891503)
- Implemented `server/chain/pinned-snapshots.ts` to cleanly load pinned snapshots during SSR/client execution without filesystem dependencies.
- Kept all subsequent stages (action decoding, ABI resolution, findings, consistency, assessments) running live.

### 2. Truthful UI & Re-Verify Live
- Renamed "Archived fixtures" to "Pinned examples" across UI components.
- Added `eventSource` field to `ProposalInfo` in `src/types/analysis.ts`.
- In `src/components/ProposalDetails.tsx`, every result explicitly displays `Event source: pinned snapshot (block N)` or `live RPC (block N)` or `live tx receipt (block N)`.
- Added a "Re-verify live (bypass pinned snapshot)" toggle checkbox to `AnalysisForm.tsx`. When checked, the API executes live RPC/Blockscout lookups and truthfully labels the outcome.

### 3. Tx-Hash & Explorer-Link Input
- Implemented `parseTxHashOrUrl` and updated `validateAnalysisInput` in `src/lib/validation.ts`.
- Supports raw 66-character tx hashes (`0x...`) as well as Etherscan and Basescan tx URLs (`https://etherscan.io/tx/...` / `https://basescan.org/tx/...`).
- Auto-detects network from URL hostnames when applicable.
- Implemented `retrieveProposalEventFromTxHash` in `server/chain/proposal-events.ts`: retrieves transaction receipt, extracts `ProposalCreated` log, derives governor address and proposal ID, and skips log scanning entirely.
- Added input mode switcher in `src/components/AnalysisForm.tsx` enabling seamless toggle between "Governor + Proposal ID" and "Tx Hash / Explorer URL".

### 4. RPC Resilience & Blockscout Configuration
- Enhanced `server/chain/networks.ts` and `server/chain/rpc-client.ts` with multiple fallback RPC endpoints per network:
  - Ethereum: Tenderly Gateway, Ethereum RPC PublicNode, Cloudflare Eth, Ankr.
  - Base: Base RPC PublicNode, Mainnet Base, DRPC Base, 1RPC.
- Connected via viem's `fallback(transports, { rank: false })`.
- Made Blockscout timeout configurable via `BLOCKSCOUT_TIMEOUT_MS` (default 5,000ms) with 1 retry per page.
- Added dynamic block time sampling to `fetchProposalEventFromRpc` to adapt between historical 2.0s blocks and fast flashblocks on Base.

### 5. Verification Evidence
- `tests/unit/validation.test.ts`: 9/9 passed (includes tx hash and URL parsing tests).
- `tests/integration/regression-fixtures.test.ts`: 2/2 passed (both ENS and Unlock proposals analyzed successfully).
- `tests/integration/action-decoding.test.ts`: 2/2 passed (both actions decoded and verified).
- `tests/integration/proposal-retrieval.test.ts`: 2/2 passed.
- `tests/integration/pinned-and-txhash.test.ts`: 4/4 passed.

---

## Task 2: Sponsor Review Normalization, Rendering & Structured Typing

- **Status:** PASS
- **Date:** 2026-11-11
- **Focus:** Eliminate raw `JSON.stringify` leakage, define structured `ReviewItem`, normalize multiple key formats, cap Dolphin reviews at 3 with reference integrity, and add kind badges with collapsible evidence.

### 1. Normalization & Structured Typing
- Defined `ReviewItem` and `ReviewItemKind` (`'supported' | 'unsupported_claim' | 'risk' | 'contradiction' | 'note'`) in `src/types/analysis.ts`.
- Created `server/providers/review-normalizer.ts` with `normalizeReviewItem`:
  - Normalizes heterogeneous key patterns: `issue`, `detail`, `description`, `observation`, `message`, `title`.
  - Normalizes `evidence` string.
  - Normalizes and sanitizes reference keys: `actionRef`, `findingRef`, `claimRef`.
  - For unmapped or unexpected object shapes, transforms into a structured `note` with a sanitized one-line summary. **Never** outputs raw JSON syntax into UI strings.
- Added `responseFormat` capability to `callOpenAiCompatible` in `server/providers/openai-compatible.ts`.

### 2. Dolphin Reference Integrity
- Updated `server/providers/dolphin.ts`:
  - Enforced cap of at most 3 review items.
  - Required each item to reference either a valid `actionRef` (verified against `actions` bounds) or a valid `findingRef` (matching an existing deterministic finding).
  - Server automatically drops unreferenced items before returning.

### 3. UI Rendering & Evidence Collapse
- Updated `src/components/ProviderReviews.tsx`:
  - Renders each `ReviewItem` with a dedicated kind badge (`[Supported]`, `[Unsupported Claim]`, `[Risk]`, `[Contradiction]`, `[Note]`).
  - Displays referenced action number, finding ID, or claim ID as appropriate.
  - Renders an interactive toggle for evidence (`Show evidence` / `Hide evidence`) which is collapsed by default.
  - Completely removed raw JSON fallback in UI text.

### 4. Verification Evidence
- `tests/unit/sponsor-review-normalization.test.ts`: 5/5 passed.
  - Tested exact production payload shape: `{"type":"unsupported_claim","issue":"...","evidence":"..."}`.
  - Tested alternative key normalization.
  - Tested unknown object shapes (asserted no raw `{}` JSON syntax leaks).
  - Tested Dolphin reference integrity filtering and cap at 3 items.

---

## Task 3: Layout Collisions & Address Component

- **Status:** PASS
- **Date:** 2026-11-11
- **Focus:** Resolve grid overlapping in `ProposalDetails.tsx`, add `min-width: 0` constraints, apply `overflow-wrap: anywhere`, and introduce reusable `<Address>` component.

### 1. Root Cause of Collisions
- CSS Grid children default to `min-width: auto`, preventing long unbroken hexadecimal addresses and large decimal IDs from shrinking or wrapping within their assigned column tracks.
- This caused Governor address to overlap the Proposal ID column, and Proposer address to overlap the "Created at block" column.

### 2. Implementation & Structural Improvements
- Created `src/components/Address.tsx`:
  - Renders middle-truncated address (e.g. `0x65bA...0aD9`).
  - Full address available on hover via `title` tooltip and expandable via toggle button.
  - Interactive "Copy" button with 2-second user feedback.
  - Fully responsive with `min-width: 0` and `overflow-wrap: anywhere`.
- Updated `src/styles/index.css`:
  - Enforced `min-width: 0` on `.details-grid > *` and `.detail-item`.
  - Added `overflow-wrap: anywhere` and `word-break: break-word` to `.detail-value`.
- Updated `src/components/ProposalDetails.tsx` to render Governor, Proposer, and Creation Transaction via `<Address>`.

### 3. Verification Evidence
- `tests/unit/address-and-layout.test.tsx`: 3/3 passed.
- `docs/screens/RESPONSIVE_VERIFICATION.md`: Viewport tests verified at 320px, 768px, and 1280px.
- `tests/unit/ui-components.test.tsx`: 13/13 passed.




