"""CLI demo: P(overdue) + band for one loan, using origination-time features only."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from scoring import RAW_INPUTS, score

SAMPLE = {
    "contract_amount": 50000, "interest_amount": 20000, "installment": 1950, "tenure": 36,
    "branch": "Kandy", "product_category": "Micro Loan",
    "product_type": "Weekly", "product": "SASIRI LOAN 01 (sl01)",
}


def predict(features: dict) -> dict:
    return {**score(features), "features_used": RAW_INPUTS}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", type=Path, help="Path to feature JSON")
    args = ap.parse_args()
    features = json.loads(args.json.read_text(encoding="utf-8")) if args.json else SAMPLE
    print(json.dumps(predict(features), indent=2))


if __name__ == "__main__":
    main()
