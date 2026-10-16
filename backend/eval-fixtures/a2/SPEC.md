# A2 Budget Threshold — Evaluation Oracle (v1)

**Spec ID:** `a2-budget-threshold-oracle-v1`  
**Implements against:** `A2_BUDGET_MODEL_VERSION` = `a2-budget-threshold-rules-v1`  
**Not measured:** ML accuracy, real M2 ledger monitoring, or operational alert usefulness.

This document is the **ground-truth oracle** for Slice 2B fixtures. Expected labels in
`a2-threshold-fixtures.v1.json` are derived from these written rules, not from copying
live function return values at authoring time.

## R1 — Threshold decision (valid inputs only)

After a body has passed input validation (R2):

> **Breach** if and only if `metricValue >= threshold` (equality counts as breach).

Otherwise **no breach**.

This matches the documented product rule in `docs/M4_INTEGRATION_GUIDE.md` and the
`rule` string recorded on evaluations (`metricValue >= threshold`).

## R2 — Input validation (reject before compare)

A request body is **invalid** (must not be evaluated as a threshold decision) when any of:

| Rule | Condition |
|------|-----------|
| R2.1 | Body is not a plain JSON object |
| R2.2 | `metricName` missing/empty/too long after trim |
| R2.3 | `metricValue` is not a finite number |
| R2.4 | `threshold` is not a finite number |
| R2.5 | Absolute magnitude of either number exceeds `1e15` |
| R2.6 | `threshold <= 0` (v1 requires a **strictly positive** threshold) |
| R2.7 | `metricValue < 0` (v1 utilization/spend cannot be negative) |
| R2.8 | Optional `source` present but not exactly `manual_api_v1` |
| R2.9 | Optional `branchId` present but not a UUID |

Fixtures in this pack exercise R2.3, R2.4, R2.6, and R2.7 (plus R1 boundaries).

## Measurement

- **Valid-decision agreement:** among fixtures with `category: "threshold_decision"`,
  fraction where `validate` succeeds and `breached` equals the oracle boolean.
- **Invalid-input rejection rate:** among fixtures with `category: "input_rejection"`,
  fraction where `validate` returns `ok: false`.

These are **rule-agreement** rates for a deterministic policy, not model accuracy.
