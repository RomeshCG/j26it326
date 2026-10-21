"""MDI tests: 3 cases (improving, same, worsening). Run: python mdi/test_mdi.py"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from mdi import compute_mdi, load_settings  # noqa: E402

S = load_settings()
BASE = {"female": 0.78, "poverty": 0.50, "rural": 0.77, "low_income": 0.65,
        "new_to_banking": 0.20, "dropout": 0.03, "avg_loan_size": 100000.0}


def series(factor_adverse: float) -> pd.DataFrame:
    """6 months: first 3 = BASE; last 3 move by `factor_adverse` (relative, adverse direction)."""
    rows = []
    for m in range(6):
        row = dict(BASE)
        if m >= 3:
            for key, ind in S["indicators"].items():
                row[key] = BASE[key] * (1 + ind["direction"] * factor_adverse)
        rows.append(row)
    return pd.DataFrame(rows)


better = compute_mdi(series(-0.10), S)
same = compute_mdi(series(0.0), S)
worse = compute_mdi(series(+0.15), S)

assert better["score"] < same["score"] < worse["score"], (better["score"], same["score"], worse["score"])
assert same["score"] == 0 and same["state"] == "normal"
assert better["score"] < 0 and better["state"] == "normal"
assert worse["state"] == "alert"
assert abs(sum(t["weight"] for t in worse["contributingTrends"]) - 1) < 1e-9
print(f"MDI tests passed: better={better['score']}, same={same['score']}, worse={worse['score']} ({worse['state']})")
