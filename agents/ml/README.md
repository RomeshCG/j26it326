# A3 Isolation Forest — Phase A (train / eval) v2

Genuine **sklearn Isolation Forest** on **synthetic** microfinance branch-volume
features. Runtime FastAPI (Phase B) loads `artifacts/a3-iforest-v2.joblib` via
`app/iforest_scorer.py` with the frozen validation threshold.

## Methodology (concise)

### What this is
- Unsupervised IF fitted on **normal-only** synthetic train rows (≥2k).
- Pipeline: **RobustScaler** (fit on train) → IsolationForest.
- Threshold chosen on **validation only** via bootstrap-median of F1-optimal
  points under precision/recall floors; test is one-shot and independent of v1.
- Scores are **not probabilities**.

### What this is not
- Not trained on real MFI production traffic.
- Not a calibrated classifier.
- Heuristic feature explanations (Phase B) are **not** IF importances / SHAP.

### Features (strict allowlist — branch-relative)
See `features.py` → `FEATURE_ALLOWLIST` (10 scale-invariant / relative features).
Causal past-only rolling 7-day baselines; raw absolute txn levels are **not**
model inputs. Labels (`is_anomaly`, `anomaly_type`, `difficulty`) are never
training inputs.

### Evaluation split (anti-leakage) — v2
| Split | Days | Branches | Labels |
|-------|------|----------|--------|
| Warmup | `[0, 7)` | all | no rows emitted |
| **Train** | `[7, 180)` | `0–11` only | Normal only |
| **Val** | `[180, 210)` | `0–11` | ~40 stratified labelled anomalies |
| **Test** | `[210, 250)` on `0–11`, plus `[180, 250)` on holdout **`12–15`** | Includes unseen branches | ~40 stratified labelled anomalies |

- **Temporal leakage:** future days are not in train; rolling windows use past only.
- **Branch-pattern leakage:** holdout branches never appear in train.
- Anomalies are stratified by type × difficulty; injection uses a **separate RNG**.
- **v2 test is fresh** — do not retune against the inspected v1 test set.

### Score semantics
- `decision_function`: pipeline IF (lower ⇒ more anomalous).
- `score = 1 / (1 + exp(decision))` ∈ (0,1) — monotonic display transform; **not** a probability.
- `confidence = score * 100` — UI mapping only.
- Threshold: bootstrap median of val thresholds maximizing F1 under
  precision ≥ 0.40 and recall ≥ 0.30 when possible (requires ≥30 val positives).

### Metrics reported
Precision, recall, F1, PR-AUC, FPR (plus ROC-AUC), by anomaly type/difficulty,
seen vs holdout-branch test slices, and threshold stability (mean/std/p10/p90).

### Synthetic-data limitations
- Generator defines the world; metrics can look strong if anomalies are too easy.
- Reports include easy vs subtle recall and near-perfect-F1 warnings.
- Do not claim external validity to live Sri Lankan MFI ledgers without further study.

## Commands

```powershell
cd agents
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

python -m ml.generate_synthetic_volume
python -m ml.train_iforest
python -m ml.evaluate_iforest
```

Stdlib check (no ML deps required):

```powershell
cd agents
python -m ml.test_phase_a_stdlib
```

## Artifacts (gitignored)
- `data/synthetic/*.csv`, `volume_manifest.json`
- `artifacts/a3-iforest-v2.joblib`
- `artifacts/a3-iforest-v2.meta.json`
- `artifacts/a3-iforest-v2.evaluation.json`

Do **not** commit CSVs or `.joblib` binaries.
