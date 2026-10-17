"""Generate PAR-shaped synthetic loans for local M1 training (gitignored output)."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.schema import TARGET, add_derived, compute_risk_pct  # noqa: E402

OUT_DEFAULT = ROOT / "data" / "synthetic" / "loan_risk_synthetic_v1.csv"

BRANCHES = ["Colombo", "Kandy", "Galle", "Jaffna", "Kurunegala"]
CENTERS = [f"C{i:03d}" for i in range(1, 21)]
PRODUCTS = [
    ("Micro", "Group", "Group Enterprise"),
    ("Micro", "Individual", "Individual Working Capital"),
    ("SME", "Individual", "SME Growth"),
    ("Agriculture", "Group", "Agri Seasonal"),
    ("Housing", "Individual", "Home Improvement"),
]


def generate(n: int = 5000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for _ in range(n):
        cat, ptype, prod = PRODUCTS[int(rng.integers(0, len(PRODUCTS)))]
        amount = float(rng.choice([50_000, 75_000, 100_000, 150_000, 250_000, 500_000]))
        tenure = int(rng.choice([12, 24, 36, 48, 60]))
        interest_amount = round(amount * float(rng.uniform(0.08, 0.22)), 2)
        installment = round((amount + interest_amount) / tenure, 2)
        paid_pct = float(rng.beta(2.5, 1.2) * 100)
        paid_pct = float(np.clip(paid_pct, 0, 100))
        balance_total = round(amount * (1 - paid_pct / 100) * float(rng.uniform(0.85, 1.05)), 2)
        balance_capital = round(balance_total * float(rng.uniform(0.7, 0.95)), 2)
        balance_interest = round(max(balance_total - balance_capital, 0), 2)
        # Heavier arrears for a minority (~PAR-like)
        stressed = rng.random() < 0.12
        arr_cap = round(balance_capital * float(rng.uniform(0.05, 0.45)), 2) if stressed else 0.0
        arr_int = round(balance_interest * float(rng.uniform(0.0, 0.3)), 2) if stressed else 0.0
        bal_penalty = round(arr_cap * float(rng.uniform(0.0, 0.15)), 2) if stressed else 0.0
        bal_charges = round(float(rng.uniform(0, 2000)) if stressed else 0.0, 2)
        paid_total = round(amount + interest_amount - balance_total, 2)
        paid_capital = round(amount - balance_capital, 2)
        paid_interest = round(max(paid_total - paid_capital, 0), 2)
        rows.append(
            {
                "branch": BRANCHES[int(rng.integers(0, len(BRANCHES)))],
                "center": CENTERS[int(rng.integers(0, len(CENTERS)))],
                "product_category": cat,
                "product_type": ptype,
                "product": prod,
                "contract_amount": amount,
                "interest_amount": interest_amount,
                "installment": installment,
                "tenure": tenure,
                "balance_capital": balance_capital,
                "balance_interest": balance_interest,
                "balance_total": balance_total,
                "bal_penalty": bal_penalty,
                "bal_charges": bal_charges,
                "arr_cap": arr_cap,
                "arr_int": arr_int,
                "paid_capital": paid_capital,
                "paid_interest": paid_interest,
                "paid_total": paid_total,
                "paid_pct": round(paid_pct, 2),
                "total_paid": paid_total,
                "over_payment": round(max(float(rng.normal(0, 500)), 0), 2) if rng.random() < 0.05 else 0.0,
                "gender": "female" if rng.random() < 0.6 else "male",
                "area_type": "rural" if rng.random() < 0.55 else "urban",
                "is_group_loan": ptype == "Group" or rng.random() < 0.15,
                "income_band": rng.choice(["low", "mid", "high"], p=[0.5, 0.35, 0.15]),
            }
        )
    df = pd.DataFrame(rows)
    df = add_derived(df)
    df[TARGET] = compute_risk_pct(df)
    return df


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("-n", type=int, default=5000)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("-o", type=Path, default=OUT_DEFAULT)
    args = p.parse_args()
    df = generate(args.n, args.seed)
    args.o.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.o, index=False)
    print(f"Wrote {len(df)} rows -> {args.o}")
    print(df[TARGET].describe().to_string())


if __name__ == "__main__":
    main()
