"""Build the v3 (expert-enriched) training set: real PAR rows + expert-prior borrower fields.

Usage (from ml/):
  python m1_credit_risk/scripts/make_expert_dataset.py
Output (gitignored): data/processed/train_v3_expert.csv
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.expert_synth import CONFIG_DEFAULT, calibrate, check_relative_risk, load_config, synthesize  # noqa: E402
from features.schema import add_overdue_label  # noqa: E402

PAR_DEFAULT = ROOT / "data" / "private" / "par30_clean_no_pii.csv"
OUT_DEFAULT = ROOT / "data" / "processed" / "train_v3_expert.csv"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--par", type=Path, default=PAR_DEFAULT)
    ap.add_argument("--config", type=Path, default=CONFIG_DEFAULT)
    ap.add_argument("-o", type=Path, default=OUT_DEFAULT)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-calibrate", action="store_true", help="use the multipliers as given")
    args = ap.parse_args()

    cfg = load_config(args.config)
    if cfg.get("placeholder"):
        print("WARNING: expert_priors.toml still has placeholder numbers. Output is tagged "
              "'expert_prior_placeholder'; do not report results from it.\n")

    df = add_overdue_label(pd.read_csv(args.par))
    if args.no_calibrate:
        work, out = cfg, synthesize(df, cfg, seed=args.seed)
    else:
        work, out = calibrate(df, cfg, seed=args.seed)
    args.o.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.o, index=False)
    print(f"Wrote {len(out)} rows -> {args.o}\n")

    print("Observed vs expert relative risk (observed should be close to expert):")
    print(check_relative_risk(out, work, expert_cfg=cfg).to_string(index=False))


if __name__ == "__main__":
    main()
