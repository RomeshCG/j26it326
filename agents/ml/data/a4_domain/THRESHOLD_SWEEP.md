# A4 domain — validation threshold / hybrid sweep

**Status:** Engineering only. Tuned on improve-v1 **validation** only (n=39). Test/vault **unused**.

## Stage-0 only

- FA=7 FR=12 finance_recall=0.40 · Stage-0 false-refuse finance=12

## Recommended enforce policy: `ml_tau` @ τ=0.45

Allow generative knowledge iff `pred == finance && pFinance >= 0.45`.

| Metric | Value |
|--------|-------|
| FA | **3** |
| FR | **4** |
| Finance recall | **0.80** |
| Rescued Stage-0 misses | **11** / 12 |

**Challenge:** `hybrid_v1` (Stage-0 allow unless off_topic veto + rescue) had FA=7 on the same val set — worse false accepts. Kept as optional `A4_DOMAIN_ML_POLICY=hybrid_v1` only.

## ML-only τ sweep

- ml_finance_tau_0.35: FA=5 FR=2 fin_rec=0.9 rescued=12
- ml_finance_tau_0.40: FA=5 FR=3 fin_rec=0.85 rescued=12
- **ml_finance_tau_0.45: FA=3 FR=4 fin_rec=0.8 rescued=11** ← pick
- ml_finance_tau_0.50: FA=1 FR=8 fin_rec=0.6 rescued=8
- ml_finance_tau_0.55: FA=0 FR=9 fin_rec=0.55 rescued=7

## Activation

Default runtime mode remains **`off`** (Stage-0 only). Do not set `enforce` without explicit approval.
