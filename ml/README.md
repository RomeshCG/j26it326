# IMFS Machine Learning

Shared ML workspace for M1 / M2 / M3. M4 agents live in `/agents`.

## Layout

```text
ml/
  shared/                 # common helpers (ask group before changing)
  m1_credit_risk/         # M1 — XGBoost, SHAP, risk explanations
  m2_mission_intel/       # M2 — KPI / MDI support + grounded narratives
  m3_ews/                 # M3 — early warning models
  notebooks/              # experiments only (per member)
```

## Ownership

- Commit freely in your module folder (`m1_credit_risk`, `m2_mission_intel`, or `m3_ews`)
- Changes under `shared/` should be agreed with the group
- Do not write directly into another component’s database tables — use that component’s API

## datasets (do not commit)

See **[docs/SHARED_DATASETS.md](../docs/SHARED_DATASETS.md)** — primary PAR extract (from M1) + public downloads for M2/M3/M4.

Large or customer-demo datasets must stay local.

Ignored by git (see root `.gitignore`):

- `ml/**/data/raw/`
- `ml/**/data/synthetic/`
- `ml/**/data/private/`
- `ml/**/artifacts/`
- common data file types under those folders (`.csv`, `.parquet`, etc.)

Put generator **code** in git. Put generated **files** only on your machine (or a private drive), not on GitHub.

## M1 quick start

```powershell
cd ml
.\.venv\Scripts\Activate.ps1
python m1_credit_risk/scripts/generate_synthetic.py -n 3000
python m1_credit_risk/scripts/merge_par_synthetic.py
python m1_credit_risk/train/train_xgb.py --data m1_credit_risk/data/processed/train_par_synth_v1.csv
python m1_credit_risk/explain/shap_local.py --data m1_credit_risk/data/processed/train_par_synth_v1.csv
python m1_credit_risk/serve/demo_predict.py
```

**Notebook (guided EDA + train + SHAP):** see [`notebooks/m1/README.md`](notebooks/m1/README.md) and open `notebooks/m1/01_eda_train_shap.ipynb`.
