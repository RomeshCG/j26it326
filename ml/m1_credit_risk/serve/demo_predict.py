"""CLI demo: P(overdue) + band for one loan, using origination-time features only."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.schema import V2_FEATURES, add_v2_features, overdue_band  # noqa: E402

MODEL_PATH = ROOT / "artifacts" / "overdue_xgb.joblib"
RAW_INPUTS = ["contract_amount", "interest_amount", "installment", "tenure",
              "branch", "product_category", "product_type", "product"]


def predict(features: dict) -> dict:
    missing = [c for c in RAW_INPUTS if features.get(c) is None]
    if missing:
        raise ValueError(f"Missing feature(s): {missing}")
    row = add_v2_features(pd.DataFrame([{c: features[c] for c in RAW_INPUTS}]))[V2_FEATURES]
    prob = float(joblib.load(MODEL_PATH).predict_proba(row)[0, 1])
    return {"overdue_prob": round(prob, 4), "risk_band": overdue_band(prob), "features_used": RAW_INPUTS}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", type=Path, help="Path to feature JSON")
    args = ap.parse_args()
    if args.json:
        features = json.loads(args.json.read_text(encoding="utf-8"))
    else:
        features = {
            "contract_amount": 50000, "interest_amount": 20000, "installment": 1950, "tenure": 36,
            "branch": "Kandy", "product_category": "Micro Loan",
            "product_type": "Weekly", "product": "SASIRI LOAN 01 (sl01)",
        }
    print(json.dumps(predict(features), indent=2))


if __name__ == "__main__":
    main()
