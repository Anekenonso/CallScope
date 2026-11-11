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

