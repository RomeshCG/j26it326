"""Checks for the expert-prior synthesis (fake loans, no PAR file needed).

Run from ml/:  python m1_credit_risk/tests/test_expert_synth.py   (or pytest)
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.expert_synth import BORROWER_FEATURES, calibrate, check_relative_risk, load_config, synthesize  # noqa: E402


def fake_loans(n=4000, seed=1):
    rng = np.random.default_rng(seed)
    return pd.DataFrame({
        "installment": rng.uniform(1000, 4000, n),
        "product_type": rng.choice(["Weekly", "Daily", "Monthly"], n, p=[0.97, 0.02, 0.01]),
        "age": rng.integers(-2, 8, n).astype(float),  # arrears age: must survive untouched
        "overdue": (rng.random(n) < 0.36).astype(int),
    })


CFG = load_config()
LOANS = fake_loans()


def test_adds_borrower_columns_and_keeps_real_columns():
    out = synthesize(LOANS, CFG)
    assert set(BORROWER_FEATURES) <= set(out.columns)
    assert (out["age"] == LOANS["age"]).all()          # arrears age not overwritten by borrower age
    assert (out["overdue"] == LOANS["overdue"]).all()  # real label untouched
    assert (out["data_source"] == "expert_prior_placeholder").all()


def test_deterministic_with_seed():
    a, b = synthesize(LOANS, CFG, seed=7), synthesize(LOANS, CFG, seed=7)
    assert a.equals(b)


def test_values_are_sane():
    out = synthesize(LOANS, CFG)
    assert (out["monthly_income"] > 0).all()
    assert (out["living_expenses"] <= 0.9 * out["monthly_income"] + 1).all()
    assert out["borrower_age"].between(18, 70).all()
    expected = 1 - out["living_expenses"] / out["monthly_income"] - out["debt_burden"] - out["instalment_load"]
    assert np.allclose(out["disposable_ratio"], expected, atol=0.01)


def test_higher_debt_burden_means_higher_overdue_rate():
    out = synthesize(LOANS, CFG)
    low = out.loc[out["debt_burden"] < 0.2, "overdue"].mean()
    high = out.loc[out["debt_burden"] >= 0.2, "overdue"].mean()
    assert high > low


def test_calibration_moves_observed_closer_to_expert():
    before = check_relative_risk(synthesize(LOANS, CFG), CFG)
    work, final = calibrate(LOANS, CFG, iters=4)
    after = check_relative_risk(final, work, expert_cfg=CFG)
    err = lambda t: (t["observed_rr"] - t["expert_rr"]).abs().mean()  # noqa: E731
    assert err(after) < err(before)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("all expert-synthesis tests passed")
