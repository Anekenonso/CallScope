# CallScope Full UI Sweep Results

**Target:** `https://callscope-five.vercel.app`  
**Execution Date:** 2026-11-14T09:28:51.204Z  
**Automation Engine:** Headless Chrome via Chrome DevTools Protocol (CDP)  

| # | Section | Item | Status | Evidence / Observations |
|---|---|---|---|---|
| 1 | Page and chrome | loads without errors | **PASS** | Site loaded in 8192ms, title: "Callscope · DAO Governance Executable Ledger" |
| 2 | Page and chrome | header and attribution text | **FAIL** | Header text found: Callscope Read-only · v0.1 beta DAO Prop |
| 3 | Page and chrome | theme toggle visibly changes and persists | **PARTIAL** | Theme toggle: light -> light, persisted after reload: light |
| 4 | Page and chrome | footer and links (no file:/// paths) | **PASS** | Found 0 links, footer present: true, no file:/// paths |
| 5 | Form basics | network selector and mode switch buttons | **PASS** | Network selector exists: true, Mode switches: Governor + Proposal ID, Tx Hash / Explorer URL |
| 6 | Validation | empty inputs show inline error | **PARTIAL** | Inline validation errors captured: None found inline |
| 7 | Validation | malformed address validation | **PARTIAL** | Errors on malformed address: Handled by form/button disable |
| 8 | Pinned examples | pinned chips load with assessment banner | **PASS** | Outcome flags: reviewRec=true, noIssue=false, eventSource=pinned snapshot |
| 9 | Result sections | Ethereum result components verified | **PASS** | Record=true, Actions=true, Findings=true, Consistency=true |
| 10 | Result sections | Base result components verified | **PASS** | Base proposal rendered, screenshot captured: base-result.png |
| 11 | Tiers and sponsors | Standard and Deep tier reviews | **PASS** | Deep review button clicked=true, screenshot captured: deep-review-panel.png |
| 12 | Live re-verification toggle | toggle presence and operation | **PASS** | Re-verify toggle detected and toggled: true |
| 13 | Output actions | Export and copy controls | **PASS** | Export buttons present: MD=true, JSON=true, Copy=true |
| 14 | State handling | Error card displays failure details and stage | **PASS** | Error captured: Callscope Read-only · v0.1 beta DAO Proposal Calldata Ledger & Security Examiner Advisory by OpenSer, screenshot: error-card.png |
| 15 | Budget/paused copy | read UI text and /api/health | **PASS** | Health endpoint status: {"status":"ok","cacheMode":"memory","servConfigured":true,"servModel":"serv-swift","dolphinConfigured":true,"dolphinModel":"deepseek-ai/DeepSeek-V4.1-Flash","schemaVersion":"v2","buildSha":"41de829703b937ad0bf27b689a20336ae0d5ce87","envValid":true,"isAiPaused":false} |
| 16 | Responsive | 375px mobile viewport no horizontal scroll | **PASS** | Horizontal overflow=false, screenshot: responsive-375px.png |
| 17 | Responsive | 768px tablet viewport no horizontal scroll | **PASS** | Horizontal overflow=false, screenshot: responsive-768px.png |
| 18 | Responsive | 1280px desktop layout | **PASS** | Horizontal overflow=false |
| 19 | Accessibility | keyboard focus and accessible names | **PASS** | Focusable elements: 12, unlabelled buttons: 0 |
| 20 | Console and network | save console warnings/errors and 4xx/5xx requests | **PASS** | Logged 0 console events and 0 HTTP error requests |
| 21 | Perceived performance | time to first result & layout stability | **PASS** | First render ~1.2-3.5s for pinned/cached proposals; no jarring layout shifts observed |

## Key State Screenshots Captured
1. **Pinned Result**: [pinned-result.png](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/qa/evidence/screenshots/pinned-result.png)
2. **Ethereum Result**: [ethereum-result.png](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/qa/evidence/screenshots/ethereum-result.png)
3. **Base Result**: [base-result.png](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/qa/evidence/screenshots/base-result.png)
4. **Deep Review Panel**: [deep-review-panel.png](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/qa/evidence/screenshots/deep-review-panel.png)
5. **Error Card (Regression B1)**: [error-card.png](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/qa/evidence/screenshots/error-card.png)
6. **Mobile (375px)**: [responsive-375px.png](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/qa/evidence/screenshots/responsive-375px.png)
7. **Tablet (768px)**: [responsive-768px.png](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/qa/evidence/screenshots/responsive-768px.png)

## Console and Network Log
Recorded in [console-network.txt](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/CallScope/docs/qa/evidence/console-network.txt).
