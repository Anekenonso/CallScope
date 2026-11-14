# Build Status — Baseline Capture

Captured on: **2026-11-12 (upgrade branch)**

## Branch & Commit

| Field | Value |
|---|---|
| **Branch** | `upgrade/protected-incremental-build` |
| **Commit SHA** | `ccab0dafc8199bbb5ff0558e885b89b9e3e9de1f` |
| **Protected tag** | `callscope-pre-upgrade-2026-11-12` |
| **Origin/master SHA** | `ccab0dafc8199bbb5ff0558e885b89b9e3e9de1f` |
| **Working tree** | Clean — no uncommitted changes |

---

## Baseline Check Results

### 1. `pnpm typecheck` (`tsc --noEmit`)
- **Result:** ✅ PASS
- **Exit code:** 0
- **Errors:** 0

### 2. `pnpm test` (`vitest run tests/unit/`)
- **Result:** ✅ PASS
- **Test files:** 27 passed (27)
- **Tests:** 232 passed (232)
- **Duration:** ~105 s

**Test file breakdown:**

| File | Tests | Status |
|---|---|---|
| `final-reliability-gaps.test.ts` | 19 | ✅ |
| `claims-ledger.test.ts` | 15 | ✅ |
| `ui-components.test.tsx` | 20 | ✅ |
| `dolphin-scenarios.test.ts` | 11 | ✅ |
| `serv-investigator.test.ts` | 13 | ✅ |
| `role-capabilities.test.ts` | 9 | ✅ |
| `sponsor-providers.test.ts` | 16 | ✅ |
| `chain.test.ts` | 14 | ✅ |
| `decode-actions.test.ts` | 11 | ✅ |
| `two-phase-and-cache.test.ts` | 11 | ✅ |
| `detect-findings.test.ts` | 10 | ✅ |
| `reliability-fixes.test.ts` | 6 | ✅ |
| `decoupled-baseline-consistency.test.ts` | 3 | ✅ |
| `stateless-review-and-health.test.ts` | 10 | ✅ |
| `provider-retry-and-backoff.test.ts` | 6 | ✅ |
| `eval-harness.test.ts` | 5 | ✅ |
| `build-assessment.test.ts` | 8 | ✅ |
| `api-handler.test.ts` | 8 | ✅ |
| `sponsor-review-normalization.test.ts` | 5 | ✅ |
| `prompt-injection-resistance.test.ts` | 4 | ✅ |
| `validation.test.ts` | 9 | ✅ |
| `stage-tagged-errors.test.ts` | 4 | ✅ |
| `check-consistency.test.ts` | 5 | ✅ |
| `real-render.test.tsx` | 1 | ✅ |
| `address-and-layout.test.tsx` | 3 | ✅ |
| `fixtures-coverage.test.ts` | 3 | ✅ |
| `honest-benchmark.test.ts` | 3 | ✅ |

### 3. `pnpm build` (`tsc && node bundle-api.mjs && vite build`)
- **Result:** ✅ PASS (from original task-4124 sequential run)
- **SSR bundles:**
  - `api/analyse.js` — 154.77 kB (built in 14.20 s)
  - `api/review.js` — 176.21 kB (built in 6.07 s)
  - `api/health.js` — 1.32 kB (built in 1.17 s)
- **Client:**
  - `dist/index.html` — 1.21 kB (gzip: 0.65 kB)
  - `dist/assets/index-*.css` — 36.67 kB (gzip: 5.99 kB)
  - `dist/assets/index-*.js` — 202.21 kB (gzip: 60.50 kB)

> [!NOTE]
> A concurrent second build (task-4175) produced an `EBUSY: resource busy or locked` error on `favicon.svg`. This is Windows file-lock contention between two simultaneous `vite build` processes writing to the same `dist/` directory. It is **not** a code error. The original sequential baseline (task-4124) succeeded cleanly.

### 4. `pnpm check:readme`
- **Result:** ✅ PASS
- **Output:** `✅ README consistency check passed. All constants, RPCs, and fixtures match code.`
- **Exit code:** 0

---

## CI Status (GitHub Actions)

| Run | Commit | Status | Duration |
|---|---|---|---|
| Latest | `ccab0da` | ✅ Success | 47 s |
| Previous | Multiple | ❌ Failing | — |

**CI fix applied:** `fix(ci): use Node 22 Corepack for pnpm setup to avoid action-setup bug`

Root cause: `pnpm/action-setup@v4` bundled pnpm v9 self-installer crashed with `onlyBuiltDependencies?.sort is not a function` on pnpm v11 lockfile format. Fixed by replacing with `corepack enable && corepack prepare pnpm@11.23.0 --activate`.

---

## Pre-Existing Technical Debt (Phase A inventory)

| Item | Location | Severity |
|---|---|---|
| Prebundled serverless artifacts in VCS | `api/analyse.js`, `api/review.js`, `api/health.js` | Low — documented and freshness-checked |
| `api/_analyse.ts` size | 572 lines (single orchestration file) | Low |
| No ESLint configured | root | Low |
| No runtime Zod validation on API boundary | `api/_analyse.ts`, `api/_review.ts` | Medium |
| No coverage thresholds configured | `vite.config.ts` | Low |
| `serv_prompt_guard` / `serv_shadow_agent` declared in prompt, not verified as a live OpenServ API field | `server/providers/serv.ts` | Medium — Phase B investigates |
| In-memory LRU fallback for cache when no KV configured | `server/cache.ts` | Low — expected Vercel behavior |

---

## Upgrade Branch Status

The upgrade branch `upgrade/protected-incremental-build` has completed:
- **Phase A**: Baseline capture, backup tag, implementation plan (`fc41606`)
- **Phase B**: OpenServ SERV API & model verification (`a3e5fc6`)
- **Phase C**: OpenServ SERV multi-turn ReAct tool execution loop (`c4b31a2`)
- **Phase D**: Dolphin Lighthouse verification and engine rebuttal loop (`bb6fb70`)
- **Phase E**: Live measured sponsor ablation benchmark (`a744f69`)
- **Phase F**: Sponsor contribution evaluation harness (`eval/sponsor-contribution.ts`)

Current checks:
- `pnpm check:readme`: ✅ PASS
- `pnpm typecheck`: ✅ PASS (0 errors)
- `pnpm test`: ✅ PASS (27 files, 229 unit tests hermetic offline)
- `pnpm build`: ✅ PASS (all 3 SSR bundles + Vite client)


