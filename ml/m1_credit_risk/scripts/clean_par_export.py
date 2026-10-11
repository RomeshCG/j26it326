"""Clean a partner PAR / portfolio export into M1 training CSV (local only).

Usage:
  python clean_par_export.py --input path/to/pr_raw.xlsx
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.schema import (  # noqa: E402
    PAR_RENAME,
    TARGET,
    add_derived,
    compute_risk_pct,
)

# Identity / free-text — drop from training share
PII_OR_ID = {
    "customer_name",
    "customer_nic",
    "contact_no",
    "contact_no.",
    "customer_code",
    "contract_number",
    "officer",
    "previous comment",
    "previous_comment",
}

NUMERIC_CANDIDATES = [
    "contract_amount",
    "interest_amount",
    "installment",
    "tenure",
    "balance_capital",
    "balance_interest",
    "balance_total",
    "bal_penalty",
    "bal_charges",
    "arr_cap",
    "arr_int",
    "paid_capital",
    "paid_interest",
    "paid_total",
    "paid_pct",
    "total_paid",
    "over_payment",
    "document_charges",
    "ins_charges",
    "other_charges",
    "age",
    "left_tenure",
    "last_paid_amount",
    "debtor",
    "stock",
    "portfolio",
    "index",
]


def _normalize_name(c: object) -> str:
    s = str(c).strip()
    return s.lower().replace(" ", "_")


def load_table(path: Path) -> pd.DataFrame:
    if path.suffix.lower() in {".xlsx", ".xls"}:
        raw = pd.read_excel(path, header=None)
    else:
        raw = pd.read_csv(path, header=None)

    # Portfolio report exports: title row, then header row, then data
    header_row = None
    for i in range(min(5, len(raw))):
        vals = [str(v).strip().lower() for v in raw.iloc[i].tolist()]
        if "branch" in vals and ("contract_amount" in vals or "arr_cap" in vals):
            header_row = i
            break

    if header_row is None:
        # Classic: first row is headers (named columns)
        if path.suffix.lower() in {".xlsx", ".xls"}:
            df = pd.read_excel(path)
        else:
            df = pd.read_csv(path)
        df.columns = [_normalize_name(c) if not str(c).startswith("Unnamed") else str(c) for c in df.columns]
        # Apply legacy PAR UPPERCASE rename if needed
        upper_map = {k.strip().lower().replace(" ", "_"): v for k, v in PAR_RENAME.items()}
        # Also try original keys normalized
        rename = {}
        for c in df.columns:
            key = str(c).strip()
            if key in PAR_RENAME:
                rename[c] = PAR_RENAME[key]
            elif _normalize_name(key) in { _normalize_name(k): v for k, v in PAR_RENAME.items() }:
                rename[c] = { _normalize_name(k): v for k, v in PAR_RENAME.items() }[_normalize_name(key)]
        return df.rename(columns=rename)

    headers = [_normalize_name(v) for v in raw.iloc[header_row].tolist()]
    df = raw.iloc[header_row + 1 :].copy()
    df.columns = headers
    df = df.loc[:, [c for c in df.columns if c and c != "nan"]]
    return df.reset_index(drop=True)


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [_normalize_name(c) for c in df.columns]

    drop = [c for c in df.columns if c in PII_OR_ID or c.startswith("unnamed")]
    df = df.drop(columns=drop, errors="ignore")

    for c in NUMERIC_CANDIDATES:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    # Required for risk label
    for c in ["arr_cap", "arr_int", "bal_penalty", "bal_charges", "paid_pct", "balance_total", "contract_amount"]:
        if c not in df.columns:
            df[c] = 0.0
        df[c] = df[c].fillna(0)

    # paid_pct sometimes stored 0–1
    if df["paid_pct"].max(skipna=True) <= 1.5:
        df["paid_pct"] = df["paid_pct"] * 100

    for col, default in [
        ("gender", "unknown"),
        ("area_type", "unknown"),
        ("income_band", "unknown"),
        ("is_group_loan", False),
    ]:
        if col not in df.columns:
            df[col] = default

    # Drop empty trailing rows
    if "branch" in df.columns:
        df = df[df["branch"].notna() & (df["branch"].astype(str).str.strip() != "")]

    df = add_derived(df)
    df[TARGET] = compute_risk_pct(df)
    return df.reset_index(drop=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument(
        "--output",
        type=Path,
        default=ROOT / "data" / "private" / "par30_clean_no_pii.csv",
    )
    args = ap.parse_args()
    if not args.input.exists():
        raise SystemExit(f"File not found: {args.input.resolve()}")

    raw = load_table(args.input)
    out = clean(raw)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.output, index=False)
    print(f"Cleaned {len(out)} rows -> {args.output}")
    print(f"Columns ({len(out.columns)}): {list(out.columns)}")
    print(out[TARGET].describe().to_string())


if __name__ == "__main__":
    main()
