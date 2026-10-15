"""Local SHAP explanation for one row → JSON sample for C1 UI."""

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

from features.schema import FEATURE_COLUMNS, risk_band  # noqa: E402

MODEL_PATH = ROOT / "artifacts" / "risk_xgb.joblib"
DATA_DEFAULT = ROOT / "data" / "synthetic" / "loan_risk_synthetic_v1.csv"
OUT_DEFAULT = ROOT / "artifacts" / "sample_explanation.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=DATA_DEFAULT)
    ap.add_argument("--row", type=int, default=0)
    ap.add_argument("-o", type=Path, default=OUT_DEFAULT)
    args = ap.parse_args()

    pipe = joblib.load(MODEL_PATH)
    df = pd.read_csv(args.data)
    row = df.iloc[[args.row]][FEATURE_COLUMNS]
    pred = float(pipe.predict(row)[0])

    # SHAP on transformed matrix (TreeExplainer on booster)
    transformed = pipe.named_steps["pre"].transform(row)
    booster = pipe.named_steps["model"]
    explainer = shap.TreeExplainer(booster)
    sv = explainer.shap_values(transformed)
    if isinstance(sv, list):
        sv = sv[0]
    values = np.asarray(sv).reshape(-1)

    feature_names = pipe.named_steps["pre"].get_feature_names_out()
    pairs = sorted(
        zip(feature_names.tolist(), values.tolist()),
        key=lambda t: abs(t[1]),
        reverse=True,
    )[:8]

    payload = {
        "row_index": args.row,
        "risk_pct": round(pred, 2),
        "risk_band": risk_band(pred),
        "top_factors": [
            {"feature": name, "shap": round(float(val), 4), "direction": "increases" if val > 0 else "decreases"}
            for name, val in pairs
        ],
    }
    args.o.parent.mkdir(parents=True, exist_ok=True)
    args.o.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
