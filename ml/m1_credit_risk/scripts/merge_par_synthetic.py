"""Merge cleaned PAR (primary) with synthetic rows / demographic enrichment.

Outputs (gitignored):
  data/processed/train_par_synth_v1.csv

Usage (from ml/):
  python m1_credit_risk/scripts/generate_synthetic.py -n 3000
  python m1_credit_risk/scripts/merge_par_synthetic.py
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.schema import FEATURE_COLUMNS, TARGET, add_derived, compute_risk_pct  # noqa: E402

PAR_DEFAULT = ROOT / "data" / "private" / "par30_clean_no_pii.csv"
SYNTH_DEFAULT = ROOT / "data" / "synthetic" / "loan_risk_synthetic_v1.csv"
OUT_DEFAULT = ROOT / "data" / "processed" / "train_par_synth_v1.csv"


def enrich_demographics(df: pd.DataFrame, seed: int = 42) -> pd.DataFrame:
    """Fill unknown demographics with meeting priors (women/rural/group-heavy)."""
    out = df.copy()
    rng = np.random.default_rng(seed)
    n = len(out)

    g = out["gender"].astype(str).str.lower()
    mask = g.isin(["unknown", "nan", ""]) | out["gender"].isna()
    out.loc[mask, "gender"] = rng.choice(["female", "male"], size=int(mask.sum()), p=[0.6, 0.4])

    a = out["area_type"].astype(str).str.lower()
    mask = a.isin(["unknown", "nan", ""]) | out["area_type"].isna()
    out.loc[mask, "area_type"] = rng.choice(["rural", "urban"], size=int(mask.sum()), p=[0.55, 0.45])

    ib = out["income_band"].astype(str).str.lower()
    mask = ib.isin(["unknown", "nan", ""]) | out["income_band"].isna()
    out.loc[mask, "income_band"] = rng.choice(
        ["low", "mid", "high"], size=int(mask.sum()), p=[0.5, 0.35, 0.15]
    )

    # Group flag: product_type contains "group", else ~60% prior for unknowns
    if "product_type" in out.columns:
        pt = out["product_type"].astype(str).str.lower()
        out.loc[pt.str.contains("group", na=False), "is_group_loan"] = True
    if out["is_group_loan"].dtype == object:
        out["is_group_loan"] = out["is_group_loan"].map(
            {"true": True, "false": False, "True": True, "False": False}
        )
    need = out["is_group_loan"].isna()
    if need.any():
        out.loc[need, "is_group_loan"] = rng.random(int(need.sum())) < 0.6
    out["is_group_loan"] = out["is_group_loan"].astype(bool)

    # Recompute label after any numeric fills
    out = add_derived(out)
    out[TARGET] = compute_risk_pct(out)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--par", type=Path, default=PAR_DEFAULT)
    ap.add_argument("--synth", type=Path, default=SYNTH_DEFAULT)
    ap.add_argument("--synth-rows", type=int, default=3000, help="How many synthetic rows to append (0 = enrich only)")
    ap.add_argument("-o", type=Path, default=OUT_DEFAULT)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    if not args.par.exists():
        raise SystemExit(f"Missing PAR clean file: {args.par}")

    par = pd.read_csv(args.par)
    par = enrich_demographics(par, seed=args.seed)
    par["data_source"] = "par"

    frames = [par]

    if args.synth_rows > 0:
        if not args.synth.exists():
            raise SystemExit(
                f"Missing synthetic file: {args.synth}\n"
                "Run: python m1_credit_risk/scripts/generate_synthetic.py -n 3000"
            )
        synth = pd.read_csv(args.synth).head(args.synth_rows).copy()
        synth["data_source"] = "synthetic"
        frames.append(synth)

    # Align to training columns + source + target
    keep = FEATURE_COLUMNS + [TARGET, "data_source"]
    merged = pd.concat(frames, ignore_index=True, sort=False)
    for c in FEATURE_COLUMNS + [TARGET]:
        if c not in merged.columns:
            raise SystemExit(f"Merged data missing column: {c}")
    merged = merged[keep]

    args.o.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(args.o, index=False)
    print(f"Wrote {len(merged)} rows -> {args.o}")
    print(merged["data_source"].value_counts().to_string())
    print(merged[TARGET].describe().to_string())


if __name__ == "__main__":
    main()
