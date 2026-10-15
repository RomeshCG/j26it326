"""SHAP explanations for the overdue model: one-row JSON for the C1 UI + global importance.

Usage (from ml/):
  python m1_credit_risk/explain/shap_local.py --row 0
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.schema import V2_FEATURES, add_v2_features, overdue_band  # noqa: E402

MODEL_PATH = ROOT / "artifacts" / "overdue_xgb.joblib"
DATA_DEFAULT = ROOT / "data" / "private" / "par30_clean_no_pii.csv"
OUT_DEFAULT = ROOT / "artifacts" / "sample_explanation.json"
GLOBAL_OUT = ROOT / "artifacts" / "global_importance.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=DATA_DEFAULT)
    ap.add_argument("--row", type=int, default=0)
    ap.add_argument("-o", type=Path, default=OUT_DEFAULT)
    ap.add_argument("--sample", type=int, default=1000, help="rows for global importance")
    args = ap.parse_args()

    pipe = joblib.load(MODEL_PATH)
    df = add_v2_features(pd.read_csv(args.data))[V2_FEATURES]
    pre, model = pipe.named_steps["pre"], pipe.named_steps["model"]
    names = pre.get_feature_names_out().tolist()
    explainer = shap.TreeExplainer(model)  # values are in log-odds of P(overdue)

    # Global: mean |SHAP| over a sample
    sample = df.sample(min(args.sample, len(df)), random_state=42)
    sv_all = np.asarray(explainer.shap_values(pre.transform(sample)))
    importance = sorted(zip(names, np.abs(sv_all).mean(axis=0).tolist()), key=lambda t: -t[1])
    GLOBAL_OUT.parent.mkdir(parents=True, exist_ok=True)
    GLOBAL_OUT.write_text(
        json.dumps([{"feature": n, "mean_abs_shap": round(v, 4)} for n, v in importance[:15]], indent=2),
        encoding="utf-8",
    )

    # Local: one loan
    row = df.iloc[[args.row]]
    prob = float(pipe.predict_proba(row)[0, 1])
    values = np.asarray(explainer.shap_values(pre.transform(row))).reshape(-1)
    top = sorted(zip(names, values.tolist()), key=lambda t: abs(t[1]), reverse=True)[:8]
    payload = {
        "row_index": args.row,
        "overdue_prob": round(prob, 4),
        "risk_band": overdue_band(prob),
        "top_factors": [
            {"feature": n, "shap_logodds": round(v, 4), "direction": "increases" if v > 0 else "decreases"}
            for n, v in top
        ],
    }
    args.o.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))
    print(f"Global importance -> {GLOBAL_OUT}")


if __name__ == "__main__":
    main()
