# CallScope API Spend & Credit Protection Log

This log records token consumption and dollar spend across all live provider runs, adhering to the spend caps:
- SERV guard experiment: ≤ $0.15
- Tier timing runs: ≤ $0.40
- Model comparison: ≤ $0.20
- Preserved buffer for judges: ≥ $0.50

---

| Timestamp | Provider | Model | Call Type | Prompt Tokens | Completion Tokens | Total Cost (USD) | Cumulative Spend | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-11-14T01:46:08Z | serv | serv-swift | Eval Phase 2 Run (4 fixtures) | 3,420 | 850 | $0.00098 | $0.00098 | Recorded in phase-f-eval-raw.json |
| 2026-11-14T01:46:25Z | dolphin | DeepSeek-V4.1-Flash | Eval Phase 2 Run (4 fixtures) | 4,120 | 1,210 | $0.00091 | $0.00189 | Recorded in phase-f-eval-raw.json |
| 2026-11-14T06:11:42Z | serv | serv-swift | Guard Experiment (2 injection + 4 pinned) | 2,850 | 380 | $0.00168 | $0.00357 | Recorded in guard-2026-11-14.json |

---

## Spend Cap Status
- **SERV Allocated Budget:** $0.95
- **SERV Total Spent:** $0.00266
- **SERV Remaining:** $0.94734
- **Dolphin Total Spent:** $0.00091
- **Judge Credit Buffer:** >$0.50 preserved intact.
