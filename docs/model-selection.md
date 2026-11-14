# OpenServ Model Selection & Benchmark Analysis

**Date:** 2026-11-14  
**Comparison Target:** `serv-swift` vs `serv-standard` on Standard Extraction Call  
**Total Evaluation Spend:** `$0.006120` (Cap: ≤ $0.40)  
**Raw Evidence:** [`docs/evidence/raw/model-comparison-2026-11-14.json`](file:///docs/evidence/raw/model-comparison-2026-11-14.json)

---

## 1. Candidate Comparison Summary

| Model | Target Proposal | Mean Latency (p50) | JSON / Schema Validity | Quote Validity | Est. Cost / Call | Recommended? |
|---|---|---|---|---|---|---|
| **serv-swift** | ENS EP 6.50 | 4336 ms | 3/3 | 3/3 | $0.000345 | **YES (Preferred)** |
| **serv-swift** | Unlock Protocol | 9280 ms | 3/3 | 3/3 | $0.000345 | **YES (Preferred)** |
| **serv-standard** | ENS EP 6.50 | 13270 ms | 3/3 | 3/3 | $0.000675 | No (Higher latency & 2x cost) |
| **serv-standard** | Unlock Protocol | 10719 ms | 3/3 | 3/3 | $0.000675 | No (Higher latency & 2x cost) |

---

## 2. Decision & Recommendation
- **Decision:** Keep `serv-swift` pinned as the canonical production model.
- **Rationale:**
  1. `serv-swift` achieves high quote extraction accuracy on governance claims with substantially lower latency.
  2. `serv-swift` costs $0.125 / 1M prompt tokens compared to $0.250 / 1M for `serv-standard` (50% cost savings for DAO users and delegates).
  3. Zero JSON parse errors or schema violations observed across all test runs.

---

## 3. Pricing Corrections in Documentation
OpenServ API `/v1/models` returns pricing in standard milli-cents ($0.125 / 1M prompt, $0.650 / 1M completion). The earlier repository notes mis-transcribed this as $125 / $650. The official catalog in `eval/serv-model-catalog.json` confirms the corrected rates.
