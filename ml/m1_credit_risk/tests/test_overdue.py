"""Fake-data checks for the overdue model (no PAR file needed).

Run from ml/:  python m1_credit_risk/tests/test_overdue.py   (or pytest)
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "train"))

from features.schema import (  # noqa: E402
    LEAKY_COLUMNS, V2_FEATURES, add_overdue_label, add_v2_features, overdue_band, prepare_xy_v2,
)
from train_xgb import build_pipeline  # noqa: E402


def fake(n=300):
    rng = np.random.default_rng(0)
    return pd.DataFrame({
        "contract_amount": rng.choice([25000, 50000, 100000], n).astype(float),
        "interest_amount": rng.uniform(8000, 30000, n),
        "installment": rng.uniform(1000, 4000, n),
        "tenure": rng.choice([24, 36, 48], n),
        "branch": rng.choice(["A", "B", "C"], n),
        "product_category": "Micro Loan",
        "product_type": "Weekly",
        "product": rng.choice(["P1", "P2"], n),
        "age": rng.integers(-2, 8, n).astype(float),
    })


def test_label_threshold():
    df = add_overdue_label(pd.DataFrame({"age": [-1.0, 0.0, 1.0, 1.5, 6.0]}))
    assert df["overdue"].tolist() == [0, 0, 0, 1, 1]


def test_no_leaky_features():
    assert not set(V2_FEATURES) & LEAKY_COLUMNS


def test_derived_ratios_guard_zero_amount():
    out = add_v2_features(fake(3).assign(contract_amount=0.0))
    assert np.isfinite(out[["installment_ratio", "interest_ratio"]]).all().all()


def test_pipeline_fits_and_predicts_probabilities():
    x, y = prepare_xy_v2(add_overdue_label(fake()))
    p = build_pipeline("xgb").fit(x, y).predict_proba(x)[:, 1]
    assert ((p >= 0) & (p <= 1)).all()


def test_bands():
    assert [overdue_band(p) for p in (0.1, 0.5, 0.9)] == ["low", "medium", "high"]


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("all M1 tests passed")
