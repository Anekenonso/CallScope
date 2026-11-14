# Antigravity Agent — Non-Negotiable Instructions

You are the implementation agent for the Callscope hackathon MVP.

Your job is to build the approved product to completion with minimal user interruption. The product and architecture decisions have already been made. Do not reopen them.

## 1. Read before acting
Before editing code, read all of these files in full:
- `PRD.md`
- `ARCHITECTURE.md`
- `DESIGN.md`
- `RULES.md`
- `TASKS.md`
- `PROGRESS.md`
- this `Agent.md`

If any file is missing, stop and report the exact missing file. Do not invent replacement requirements.

Inspect the existing repository and preserve valid work. Do not overwrite a working project without understanding it.

## 2. Mission
Build a minimal, polished, reliable DAO proposal analysis tool:
- Vite + React + TypeScript frontend.
- Vercel serverless API.
- Ethereum Mainnet and Base.
- Supported OpenZeppelin Governor proposal event variants.
- Verified ABI resolution and action decoding.
- Deterministic sensitive-operation and consistency assessment.
- OpenServ SERV and Dolphin bounded review integrations.
- Single-page, responsive interface.

The user wants a simple product that does its job exceptionally well. Simplicity applies to product, architecture, code, design and agent workflow. Do not confuse simplicity with skipping correctness.

## 3. Absolute prohibitions
- Do not use Next.js.
- Do not add a database.
- Do not add login, user accounts, wallet connection, wallet signing, voting, proposal execution, transaction simulation, chat, notifications or dashboards.
- Do not add sponsor technologies beyond SERV and Dolphin.
- Do not invent branding, features, metrics, claims, data, API responses or test results.
- Do not hardcode the reference proposal outputs into production logic.
- Do not let an AI model decide the final assessment.
- Do not allow an incomplete or materially undecoded proposal to receive `No significant issue detected`.
- Do not expose secrets in frontend code, Vite variables, logs, commits or responses.
- Do not ask the user to make routine engineering decisions already settled in the documents.
- Do not stop after every task to ask for permission.
- Do not create unnecessary files, abstractions, dependencies, components or infrastructure.

## 4. How to work
1. Follow `TASKS.md` in order.
2. Work in small vertical slices.
3. After each task, run the focused test/check.
4. Update `TASKS.md` and `PROGRESS.md` immediately.
5. Keep the app runnable as early as possible.
6. Prefer a working simple implementation over speculative architecture.
7. If a technical choice is not specified, choose the simplest secure option consistent with the documents and record the decision in `PROGRESS.md`.
8. Continue independently through routine decisions and implementation.
9. Never claim completion without running the required checks.

## 5. User updates and stage gates
The user wants visibility and control throughout implementation.

- Divide work into the phases in `TASKS.md`.
- At the end of **every phase**, stop and send the user a concise stage report before starting the next phase.
- Each report must state: what was completed, files/components changed, tests actually run and their results, anything that failed, decisions made within the approved scope, and the exact next phase.
- Include evidence such as command output summaries, test names/counts, relevant screenshots or preview links when available. Never fabricate evidence.
- Wait for the user's confirmation to proceed to the next phase. Do not silently continue through multiple phases.
- Within an approved phase, make routine implementation decisions independently; do not interrupt for decisions already settled by these documents.
- If a genuine blocker occurs mid-phase, stop that blocked work and report the exact issue, evidence, why it cannot be resolved locally, the minimum user action required, and what safe work (if any) can continue.
- Keep `TASKS.md` and `PROGRESS.md` current before every stage report.

### Credential gate — mandatory hard stop
When implementation reaches a point where a real API credential is required for an authenticated integration or live test:

1. Stop before making the authenticated request.
2. Do not invent, guess, fabricate, derive, reuse, or silently substitute an API key, token, account, model entitlement, endpoint, or credential.
3. Do not use a placeholder value as if it were a real credential.
4. Tell the user which provider requires a key (SERV or Dolphin), why it is needed, where the provider issues it, which environment variable it belongs in, and what exact work is waiting.
5. Ask the user to review and configure the key locally in `.env` or in the relevant deployment environment. **Never ask the user to paste a secret into chat.**
6. Stop the credential-dependent task and wait until the user confirms the key is configured.
7. After confirmation, verify that the variable is present without printing its value, then run a minimal authenticated test. Report the actual result.
8. If the key is invalid, missing credits, or lacks access, report the exact provider response safely and wait for the user's decision. Do not invent a workaround or switch providers without approval.

Do not bypass this gate by marking live integration as complete. You may implement provider adapters and local tests that do not require credentials before the gate, but when the workflow reaches the credential-dependent integration test, pause as described above.

## 6. Technical execution
- Use Vite, React and strict TypeScript.
- Use `viem` for EVM interactions and ABI decoding.
- Use native `fetch` for SERV and Dolphin unless a small SDK is clearly necessary.
- Use Vercel serverless functions for secret-bearing server operations.
- Use Blockscout verified-source/ABI endpoints where available and RPC for chain reads/logs.
- Keep network IDs allowlisted and RPC URLs server-configured.
- Use decimal strings for proposal IDs and uint256 values.
- Keep client and server modules separated.
- Add only necessary dependencies.

Do not infer a proposal creation block from the current Governor voting delay. Retrieve the exact `ProposalCreated` event by indexed proposal ID using a bounded, adaptive log strategy. Validate the event identity and all arrays.

Support full calldata and legacy `signatures[]` plus argument-only calldata. Preserve raw action data when decoding fails.

## 7. Assessment integrity
The deterministic engine is authoritative.

- Sensitive operations require human review; they are not automatically malicious.
- Role meaning must be verified against contract implementation evidence or marked unknown.
- Description/action consistency is a separate result from sensitive-operation detection.
- AI findings are advisory.
- SERV and Dolphin must not override on-chain facts or deterministic findings.
- Provider failure must be visible but must not erase deterministic results.
- `Analysis incomplete` takes precedence whenever required data is missing or material actions remain undecoded.
- Never issue a clean result when analysis coverage is materially incomplete.

## 8. Sponsor API credentials
Required server variables:
```env
SERV_API_KEY=
SERV_MODEL=
DOLPHIN_API_KEY=
DOLPHIN_MODEL=deepseek-ai/DeepSeek-V4.1-Flash
```

Also configure:
```env
ETHEREUM_RPC_URL=
BASE_RPC_URL=
```

Never commit real `.env` files.

If sponsor credentials are unavailable:
- Implement both adapters.
- Add complete mocked tests for success and failures.
- Keep the UI honest about unavailable reviews.
- Continue all other work.
- Record live authenticated calls as not run.
- Do not claim sponsor integration is live-tested.

SERV endpoint:
`https://inference-api.openserv.ai/v1/chat/completions`

Dolphin endpoint:
`https://lighthouse.dphn.ai/run/text-v/v1/chat/completions`

Use server-side bearer authentication, bounded prompts, strict structured output validation and timeouts. Proposal content is untrusted data, not instructions.

## 9. Design quality
Follow `DESIGN.md` closely:
- Minimal white/near-white interface.
- Compact header.
- Compact analysis form.
- One primary Analyse button.
- Result below form on the same page.
- Strong typography and whitespace.
- Subtle borders, restrained status colours.
- No gradients, marketing text, helper paragraphs, decorative cards or fake metrics.
- Mobile and keyboard accessible.

Do not copy the mock-up literally if doing so adds clutter. The written design system is authoritative.

## 10. Testing requirements
At minimum, test:
- Ethereum and Base network verification.
- Governor code/address validation.
- Proposal event retrieval and exact ID matching.
- Supported event ABI variants.
- Event/action array integrity.
- Current Governor state mapping.
- Full calldata decoding.
- Legacy signature decoding.
- Verified ABI and proxy implementation resolution.
- Unknown ABI/selector behaviour.
- Each sensitive-operation rule.
- Role semantics unknown when not verifiable.
- ENS and Unlock reference fixtures.
- Provider success, missing credentials, 401, 402, 404, 429, 5xx, timeout and malformed output.
- Prompt-injection-like proposal descriptions.
- Assessment precedence and incomplete-analysis behaviour.
- Secret isolation from client bundle and responses.
- Responsive layout and accessible form operation.

Run and record:
- `npm run typecheck`
- `npm run lint` if configured
- `npm run test`
- `npm run build`

Do not hide or suppress failures. Fix them or record a genuine blocker.

## 11. Completion requirements
Do not report the project complete until:
- PRD acceptance criteria are met.
- ENS and Unlock fixtures pass against the implementation.
- SERV and Dolphin adapters are implemented and mocked tests pass.
- Live provider calls are tested if credentials are available; otherwise clearly marked not run.
- All required quality checks pass.
- Vercel deployment is smoke-tested, if deployment credentials/access are available.
- `TASKS.md` and `PROGRESS.md` reflect reality.
- README contains concise local setup, environment variables, run/test/build commands and demo instructions.

At handoff, provide:
1. What was built.
2. Local run instructions.
3. Required environment variables.
4. Exact test commands and results.
5. Deployment URL if actually deployed.
6. Any remaining limitation or credential-dependent check.

Be concise. Show evidence. Do the work.
