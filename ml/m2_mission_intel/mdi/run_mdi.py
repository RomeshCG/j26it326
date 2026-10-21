"""Compute MDI for every month with enough history; write data/processed/mdi_monthly.csv.

Run:  python mdi/run_mdi.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from mdi import compute_mdi, load_settings  # noqa: E402

PROC = Path(__file__).resolve().parents[1] / "data" / "processed"


def main() -> None:
    s = load_settings()
    soc = pd.read_csv(PROC / "social_monthly.csv")
    kpi = pd.read_csv(PROC / "kpi_monthly.csv")[["month", "avg_loan_size"]]
    df = soc.merge(kpi, on="month").sort_values("month").reset_index(drop=True)

    need = s["baseline_months"] + s["window_months"]
    rows = []
    for i in range(need - 1, len(df)):
        r = compute_mdi(df.iloc[: i + 1], s)
        rows.append({
            "month": df.loc[i, "month"], "score": r["score"], "state": r["state"],
            "threshold": s["alert_threshold"],
            "contributingTrends": json.dumps(r["contributingTrends"]),
            "data_source": df.loc[i, "data_source"],
        })
    out = pd.DataFrame(rows)
    out.to_csv(PROC / "mdi_monthly.csv", index=False)
    print(out[["month", "score", "state", "threshold"]].to_string(index=False))
    last = json.loads(out.iloc[-1]["contributingTrends"])
    print("\nTop drivers in", out.iloc[-1]["month"])
    for t in last[:4]:
        print(f"  {t['label']}: {t['relativeChange']:+.1%} -> {t['contribution']:+.1f}")


if __name__ == "__main__":
    main()
