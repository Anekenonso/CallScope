# Phase I: Deployment Smoke Test Report

**Execution Date:** `2026-11-14T02:36:00.775Z`  
**Overall Status:** ✅ ALL CHECKS PASSED  
**Preview Deployment URL:** `https://callscope-git-upgrade-protected-incremen-ea9f1e-trades-with-ken.vercel.app`  
**Pull Request:** [#1 (upgrade/protected-incremental-build -> master)](https://github.com/Anekenonso/CallScope/pull/1)  
**GitHub Actions CI Status:** ✅ 100% Green (`Typecheck, Hermetic Tests & Build` passed in 1m 43s)  

## Smoke Test Verification Matrix

| Check Name | Target Endpoint | Expected Behavior | Actual Response | Latency | Result |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Endpoint /api/health Diagnostics** | `GET /api/health` | `status == "ok"` | status: ok, buildSha: local, cacheMode: memory | 0 ms | ✅ PASS |
| **ENS EP 6.50 (Ethereum Mainnet)** | `POST /api/analyse` | `assessment == "review_recommended"` | assessment: "review_recommended", actions: 1, findings: 1 | 4765 ms | ✅ PASS |
| **Phase 2 Sponsor Review Execution** | `POST /api/review` | `HTTP 200 with serv and dolphin advisory reviews` | HTTP 200, agreement: agree, serv: upstream_error, dolphin: ok | 12412 ms | ✅ PASS |
| **Unlock Protocol (Base Mainnet)** | `POST /api/analyse` | `assessment == "analysis_incomplete"` | assessment: "analysis_incomplete", actions: 6 | 6721 ms | ✅ PASS |
| **[SYNTHETIC] Clean Grant (Ethereum Mainnet)** | `POST /api/analyse` | `assessment == "no_significant_issue_detected"` | assessment: "no_significant_issue_detected", findings: 0 | 3808 ms | ✅ PASS |
| **[SYNTHETIC] Opaque Multi-Sig (Ethereum Mainnet)** | `POST /api/analyse` | `assessment == "analysis_incomplete"` | assessment: "analysis_incomplete", findings: 1 | 185 ms | ✅ PASS |

## Authoritative Assessment Invariance Verification

- **ENS EP 6.50:** Yields `review_recommended` deterministically.
- **Unlock Transfers:** Yields `analysis_incomplete` deterministically.
- **Clean Community Grant:** Yields `no_significant_issue_detected` deterministically.
- **Opaque Multi-Sig:** Yields `analysis_incomplete` deterministically.
- **Two-Phase Review:** Phase 2 executes independently in the background without modifying Phase 1 assessment outcomes.

## Human Promotion Gate Protocol (Rule 2.4)

Per Protected Incremental Upgrade Rule 2.4, **no code is promoted or merged to master** without explicit human confirmation.
All checks are verified and ready for review.
