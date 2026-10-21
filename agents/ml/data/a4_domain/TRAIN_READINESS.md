# A4 domain classifier — training readiness

**Status (2026-10-20):** Batches 1–4 applied. Wave-2 expansion landed. **Improve-v1 trained** (engineering). **NO-GO** for production wire. Smoke vs improve reports are separate files.

---

## Corpus

| | Count |
|--|-------|
| Eligible accepted | **218** |
| finance / off_topic / mixed | 107 / 81 / 30 |
| Human-stamped (batches 1–4) | 74 |
| Wave-2 author-only | 78 |
| Excluded draft | `a4d-000104` |

Soft: `a4d-000134` still `requires_human` but accepted/eligible.

---

## Splits

| Manifest | Role |
|----------|------|
| `a4-domain-split-smoke-v1.json` | Historical smoke baseline |
| **`a4-domain-split-improve-v1.json`** | Current — test_reserved **frozen**; new groups → train/val only |
| Eval vault | Never train/val/select |

Improve partitions: train **156** / val **39** / test_reserved **23**.

---

## Experiments (val only; not research-final)

| Run | Macro-F1 | Off-topic recall | Doc |
|-----|----------|------------------|-----|
| smoke-v0 | 0.600 | 0.33 | [`SMOKE_TRAIN_SUMMARY.md`](./SMOKE_TRAIN_SUMMARY.md) |
| improve `lr_mindf1` | **0.799** (full) / **0.779** (smoke groups) | 0.71 / 0.83 | [`IMPROVE_TRAIN_SUMMARY.md`](./IMPROVE_TRAIN_SUMMARY.md) |

Preferred features: word+char TF-IDF, **`min_df=1`**, LR C=1.0, seed 42.

```powershell
cd agents
$env:ALLOW_A4_DOMAIN_TRAIN='1'
$env:A4_DOMAIN_CANDIDATE='improve-v1'
$env:A4_DOMAIN_VARIANT='lr_mindf1'
python -m ml.train_a4_domain
python -m ml.evaluate_a4_domain
```

---

## Decision

**NO-GO integration.** Continue data quality (politics/travel negatives, human audit of wave-2) before any Stage-0 hybrid wire. Optional: LinearSVC ablation documented but not required.
