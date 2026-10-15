"""CLI demo: predict risk_pct + band for one JSON feature object."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.schema import FEATURE_COLUMNS, risk_band  # noqa: E402

MODEL_PATH = ROOT / "artifacts" / "risk_xgb.joblib"


def predict(features: dict) -> dict:
    pipe = joblib.load(MODEL_PATH)
    row = pd.DataFrame([{c: features.get(c) for c in FEATURE_COLUMNS}])
    for c in FEATURE_COLUMNS:
        if row[c].isna().any():
            raise ValueError(f"Missing feature: {c}")
    pct = float(pipe.predict(row)[0])
    return {"risk_pct": round(pct, 2), "risk_band": risk_band(pct), "features_used": FEATURE_COLUMNS}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", type=Path, help="Path to feature JSON")
    args = ap.parse_args()
    if args.json:
        features = json.loads(args.json.read_text(encoding="utf-8"))
    else:
        # Tiny default sample
        features = {
            "contract_amount": 100000,
            "interest_amount": 15000,
            "installment": 4800,
            "tenure": 24,
            "balance_capital": 40000,
            "balance_interest": 5000,
            "balance_total": 45000,
            "bal_penalty": 500,
            "bal_charges": 200,
            "arr_cap": 3000,
            "arr_int": 400,
            "paid_capital": 60000,
            "paid_interest": 10000,
            "paid_total": 70000,
            "paid_pct": 60,
            "total_paid": 70000,
            "over_payment": 0,
            "arrears_total": 3400,
            "arrears_ratio": 0.075,
            "utilization": 0.45,
            "branch": "Colombo",
            "center": "C001",
            "product_category": "Micro",
            "product_type": "Group",
            "product": "Group Enterprise",
            "gender": "female",
            "area_type": "rural",
            "income_band": "low",
            "is_group_loan": True,
        }
    print(json.dumps(predict(features), indent=2))


if __name__ == "__main__":
    main()
