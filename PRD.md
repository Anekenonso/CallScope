# Product Requirements Document

## Product
**Product name:** Callscope
**Product category:** DAO proposal analysis.
Do not rename the product during implementation.

## Product purpose
Help DAO governance delegates and technical reviewers understand what a governance proposal will execute on-chain before they vote, approve, or otherwise act on it.

The product retrieves a supported Governor proposal, decodes its executable actions, identifies sensitive operations, and checks whether the actions are consistent with the proposal description. OpenServ SERV and Dolphin provide bounded supporting reviews. Deterministic on-chain facts and rules remain authoritative.

## Target users
- DAO governance delegates.
- Technical reviewers who inspect governance proposals.
- Contributors who need to understand executable proposal actions without manually decoding calldata.

## The user job
Given a supported network, Governor contract address, and proposal ID, show the proposal's actual executable actions and the material risks or evidence limitations a reviewer should notice.

## Supported scope
### Networks
- Ethereum Mainnet — chain ID `1`.
- Base Mainnet — chain ID `8453`.

### Governance format
OpenZeppelin Governor-compatible `ProposalCreated` event variants validated against the ENS Ethereum and Unlock Base reference proposals.

Do not claim universal support for every OpenZeppelin version or every Governor implementation. Support only event layouts that the implementation can identify and parse safely.

### Reference fixtures
**ENS / Ethereum**
- Governor: `0x323A76393544d5ecca80cd6ef2a560C6a395b7E3`
- Proposal ID: `77767899528494238518019756391533686963875234067646094287125791110488147463806`
- Reference proposal: https://agora.ensdao.org/proposals/77767899528494238518019756391533686963875234067646094287125791110488147463806
- Forum context: https://discuss.ens.domains/t/executable-establishing-a-new-security-council/22272
- Expected decoded operation: `grantRole(bytes32,address)` permission grant.
- Expected interpretation: sensitive permission change; proposal description describes the grant. This is not automatically malicious.
- Expected outcome: `Review recommended` because a sensitive permission operation is present, while description/action consistency can still be reported as consistent.

**Unlock / Base**
- Governor: `0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9`
- Proposal ID: `27419154582993156392805749742953507877176483681373228046916881327937839104508`
- Reference proposal: https://governance.unlock-protocol.com/proposals/27419154582993156392805749742953507877176483681373228046916881327937839104508
- Expected decoded operations: six `transfer()` calls.
- Expected interpretation: show all six actions, recipients and amounts. Do not label transfers malicious solely because they transfer tokens.
- Current status must be read from the Governor at analysis time; these are historical fixtures.

Fixture data is a regression target, not permission to hardcode a result. Always retrieve the live chain data.

## User experience
One page, one primary action.

### Inputs
1. Network selector: Ethereum Mainnet or Base.
2. Governor contract address.
3. Proposal ID.
4. Primary button: **Analyse**.

No account creation, wallet connection, wallet signing, or personal information.

### Results
Show, in this order:
1. Overall assessment.
2. Proposal title/description and current Governor status.
3. Executable actions, decoded function names and relevant parameters.
4. Significant findings, including why each finding matters.
5. Description/action consistency result.
6. SERV review and Dolphin review, clearly distinguished from deterministic findings.
7. Evidence links: proposal/event transaction and relevant explorer contract/transaction pages where available.

Do not invent proposal title, dates, transaction hashes, decoded arguments, source verification, or model findings. If a field is unavailable, say so.

### Assessment states
Exactly these user-facing outcomes:
- **Review recommended** — a sensitive operation, material description/action mismatch, or other significant finding needs human attention.
- **No significant issue detected** — all required checks completed within stated product coverage and no significant finding was detected. This is not a guarantee of safety.
- **Analysis incomplete** — required proposal data or material analysis could not be established.

Never display a numeric risk score, confidence score, or a green “safe” verdict.

## Deterministic checks
Initial sensitive-operation candidates:
- `grantRole(bytes32,address)`
- `revokeRole(bytes32,address)`
- `transferOwnership(address)`
- `upgradeTo(address)`
- `upgradeToAndCall(address,bytes)`
- `changeAdmin(address)`

A selector match alone is not proof of maliciousness. Decode parameters and explain the actual operation. Determine role meaning only from verifiable target contract ABI/source or implementation-specific evidence. Otherwise mark role semantics unknown.

Do not expand the list indiscriminately. Additional rules require a documented reason, a test fixture, and an explicit update to this PRD.

## Analysis boundaries
- Direct calls are in scope.
- Only explicitly supported wrappers are in scope.
- Do not claim general recursive decoding of Safe, bridge, multicall, or arbitrary nested execution.
- If a material action remains opaque, the result cannot be `No significant issue detected`.
- Unknown or unverified target contracts are not automatically malicious; show raw selector/calldata and mark the analysis limitation.
- A permission grant may be legitimate and accurately described. Report its capability and context without calling it malicious by default.

## AI integrations
### OpenServ SERV
Role: compare the proposal description with deterministic decoded action data. Identify omissions, inconsistencies, or claims unsupported by the executable actions.

### Dolphin
Role: a bounded secondary review of decoded actions and deterministic findings, looking for overlooked consequences or unsupported conclusions.

Both receive untrusted proposal text as data, never as instructions. Neither may retrieve chain data, decode calldata, execute tools, override deterministic facts, or decide the final assessment.

AI output is advisory. Validate structured output and label provider failures honestly.

## Out of scope
- DAO dashboard, voting, delegation, proposal creation, or governance analytics.
- Wallet connect, signing, transaction execution, or transaction simulation.
- User accounts, saved history, permanent proposal storage, or database.
- Notifications, chatbots, browser extensions, or mobile apps.
- Snapshot, Governor Bravo, arbitrary custom Governor formats.
- General-purpose smart-contract audit or guarantee of safety.
- General recursive decoding of arbitrary nested calls.
- Numeric risk/confidence scoring.

## Acceptance criteria
1. User can analyse an ENS Ethereum fixture and an Unlock Base fixture through the UI.
2. The selected network is verified against RPC `eth_chainId`.
3. Governor address is validated and confirmed to contain contract code.
4. Exact proposal ID is matched against the indexed event argument.
5. Current proposal state is fetched and mapped correctly.
6. Proposal action arrays are length-checked and decoded without silently dropping calls.
7. Both calldata styles are handled: full selector-prefixed calldata and legacy separate `signatures[]` plus encoded arguments.
8. Unknown ABI/function and unsupported nested actions are surfaced as limitations.
9. Sensitive operations produce evidence-backed findings, not automatic malicious labels.
10. SERV and Dolphin adapters have structured validation, timeouts, safe failure handling, and mock tests.
11. Missing AI credentials do not prevent deterministic analysis or local development.
12. A clean result is impossible when material actions remain undecoded or required checks are incomplete.
13. No secret is exposed to browser code or client-side bundles.
14. The app works without a database, login, wallet connection, or user tracking.
15. The UI follows `DESIGN.md`; there is one primary action and no decorative dashboard.
16. Build, lint, typecheck and tests pass before deployment.
17. `PROGRESS.md` accurately records what was actually verified; no fabricated live API test results.
