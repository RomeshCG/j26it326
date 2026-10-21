"""
M3 EWS — PAR -> EWS Feature Matrix Builder
==========================================
Consumes M1's cleaned partner PAR dataset (par30_clean_no_pii.csv) and any
support files from ml/shared/data/ (Findex, MIX, SPI) to produce an EWS
feature matrix that matches the schema expected by train_model.py.

Why this file exists
--------------------
The existing feature_engineering.py pulls live data from the tenant PostgreSQL
DB.  For the *training* phase we need to work from M1's offline, cleaned CSV
(which contains historical arrears, balances, and PAR30 labels across hundreds
of real partner loans) rather than from the demo DB.

Key rules (see docs/TEAM_DATA_AND_SYNTHETIC_GUIDE.md)
------------------------------------------------------
- Primary source  : ml/m3_ews/data/private/par30_clean_no_pii.csv  (git-ignored)
- Support sources : ml/shared/data/*.csv                           (git-ignored)
- Synthetic fill  : only for gaps (payment timelines / demographics);
                    always tagged data_source="synthetic"
- Never retrain   : M1's credit-score model — call POST /api/risk/assess instead
- Never post to   : M2 ledger tables — emit events only

Column mapping (PAR CSV -> EWS features)
----------------------------------------
PAR column                EWS feature name
-----------------------   -------------------------------------------------------
arrears_days              -> consecutive_missed  (arrears_days // 30)
paid_pct                  -> repayment_on_time_rate_3m, repayment_on_time_rate_6m
balance_outstanding       -> outstanding_principal
loan_amount               -> used to derive loan_to_income_ratio
monthly_income            -> loan_to_income_ratio denominator (fallback 0)
tenure_months             -> term_completion_pct (arrears_months / tenure_months)
par30_label               -> distress_label (1 if loan PAR30 within observation)
branch_code               -> encoded as branch_id integer (not exposed to model)
product_code              -> encoded as product_id integer (not exposed to model)
<any other column>        -> filled with synthetic defaults & tagged

Usage
-----
    python ml/m3_ews/features/par_to_ews_matrix.py \\
        --par-csv   ml/m3_ews/data/private/par30_clean_no_pii.csv \\
        --output    ml/m3_ews/data/features/feature_matrix.csv \\
        --min-rows  200

Optional synthetic fill
-----------------------
Pass --synthetic-fill N to pad the matrix with N synthetic rows if the PAR
CSV has fewer than --min-rows usable rows.  Synthetic rows are always tagged
data_source="synthetic" and use the same distribution as the real rows.
"""

import argparse
import csv
import math
import os
import random
import sys
from datetime import date
from pathlib import Path
from typing import Any


# ── Column name constants (PAR CSV) ──────────────────────────────────────────

# Core features needed for EWS matrix
EWS_FEATURES = [
    "repayment_on_time_rate_3m",
    "repayment_on_time_rate_6m",
    "avg_days_late_3m",
    "consecutive_missed",
    "partial_payment_rate",
    "missed_payment_rate",
    "promise_kept_rate",
    "outstanding_principal",
    "loan_to_income_ratio",
    "days_since_last_payment",
    "group_repayment_ratio",
    "group_arrears_ratio",
    "poverty_proxy_score",
    "is_new_to_banking",
    "term_completion_pct",
    "distress_label",
    "center",
    "branch",
    "disb_date",
    "data_source",   # "real" | "synthetic demo"
]


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert M1 PAR CSV to M3 EWS feature matrix"
    )
    parser.add_argument(
        "--par-csv",
        default="ml/m3_ews/data/private/par30_clean_no_pii.csv",
        help="Path to M1 cleaned PAR dataset (never commit this file)",
    )
    parser.add_argument(
        "--output",
        default="ml/m3_ews/data/features/feature_matrix.csv",
        help="Output feature matrix path (gitignored)",
    )
    parser.add_argument(
        "--min-rows",
        type=int,
        default=200,
        help="Minimum usable rows; synthetic fill activates below this threshold",
    )
    parser.add_argument(
        "--synthetic-fill",
        type=int,
        default=0,
        help="Force-add N synthetic rows on top of real rows (0 = auto-fill only)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="RNG seed for synthetic fill reproducibility",
    )
    return parser.parse_args()


# ── PAR -> EWS mapping helpers ─────────────────────────────────────────────────

def _float(val: Any, default: float = 0.0) -> float:
    try:
        if val is None or val == "":
            return default
        return float(val)
    except (TypeError, ValueError):
        return default


def _int(val: Any, default: int = 0) -> int:
    try:
        if val is None or val == "":
            return default
        return int(float(val))
    except (TypeError, ValueError):
        return default


def _clamp(val: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, val))


def map_par_row_to_ews(row: dict) -> dict:
    """
    Converts one PAR CSV row to an EWS feature dict.
    Supports both M1 canonical PAR format (par30_clean_no_pii.csv)
    and legacy normalized PAR export format.
    """
    # 1. Outstanding balance
    balance = _float(row.get("balance_total") or row.get("balance_outstanding") or row.get("balance_capital"), 0.0)

    # 2. Loan Amount & Tenure
    loan_amount = _float(row.get("contract_amount") or row.get("loan_amount"), balance)
    tenure_months = max(1, _int(row.get("tenure") or row.get("tenure_months"), 12))

    # 3. Arrears & Installments
    installment = _float(row.get("installment"), 0.0)
    arr_total = _float(row.get("arrears_total"), 0.0)
    if arr_total == 0.0:
        arr_total = _float(row.get("arr_cap"), 0.0) + _float(row.get("arr_int"), 0.0)

    if installment > 0 and arr_total > 0:
        arrears_months = max(0, int(arr_total // installment))
        arrears_days = _int(row.get("arrears_days"), int((arr_total / installment) * 30))
    else:
        arrears_days = _int(row.get("arrears_days"), 0)
        arrears_months = _int(row.get("arrears_months"), arrears_days // 30)

    # 4. Paid percentage
    raw_paid_pct = _float(row.get("paid_pct"), 100.0)
    # If paid_pct is 0..100 scale, normalize to 0..1
    paid_pct = _clamp(raw_paid_pct / 100.0 if raw_paid_pct > 1.0 else raw_paid_pct)

    # 5. Distress / PAR30 Ground Truth Label
    # Traditional PAR30 = arrears > 1 instalment (>= 30 days overdue)
    if "par30_label" in row and row["par30_label"] != "":
        distress = _int(row["par30_label"], 0)
    elif installment > 0:
        distress = 1 if (arr_total >= installment and arr_total > 0) else 0
    else:
        distress = 1 if arrears_days >= 30 else 0

    # 6. Repayment behavior metrics (honest non-leaky pre-default features)
    repay_3m = _clamp(paid_pct)
    repay_6m = _clamp(paid_pct)

    # Average days late estimated from friction (1 - paid_pct)
    avg_days_late_3m = min(20.0, max(0.0, (1.0 - paid_pct) * 20.0))

    bal_penalty = _float(row.get("bal_penalty"), 0.0)
    bal_charges = _float(row.get("bal_charges"), 0.0)
    over_pay = _float(row.get("over_payment"), 0.0)

    # Past penalty flag without identity target leakage
    consecutive_missed = 1 if (bal_penalty > 0 and arr_total > 0) else 0

    partial_pct = _clamp(over_pay / (installment + 100.0))
    missed_pct = _clamp(bal_penalty / (loan_amount * 0.05 + 100.0))
    promise_kept = _clamp(paid_pct * 0.85 + (0.15 if over_pay > 0 else 0.0))

    # Demographics, leverage & maturity
    monthly_est = max(15000.0, installment * 3.5)
    loan_to_income = _clamp(loan_amount / monthly_est, 0.0, 10.0)

    # Days since payment computed directly from real partner last_paid_date column
    last_paid_str = str(row.get("last_paid_date", "")).strip()
    days_since_pay = 20
    if last_paid_str and len(last_paid_str) >= 10:
        try:
            parts = [int(p) for p in last_paid_str[:10].split("-")]
            lp_date = date(parts[0], parts[1], parts[2])
            ref_date = date(2026, 8, 1)
            days_since_pay = max(0, min(180, (ref_date - lp_date).days))
        except Exception:
            days_since_pay = 20

    grp_repay = _clamp(paid_pct * 0.95)
    grp_arrears = _clamp(bal_charges / (loan_amount * 0.03 + 50.0))
    
    area = str(row.get("area_type", "rural")).lower()
    poverty_score = 0.45 if "rural" in area else 0.28
    
    age = _int(row.get("age"), 35)
    new_to_banking = 1 if age < 25 else 0

    left_tenure = _int(row.get("left_tenure"), max(0, tenure_months - arrears_months))
    term_completion_pct = _clamp((tenure_months - left_tenure) / tenure_months if tenure_months > 0 else 0.5)

    return {
        "repayment_on_time_rate_3m": round(repay_3m, 4),
        "repayment_on_time_rate_6m": round(repay_6m, 4),
        "avg_days_late_3m":          round(avg_days_late_3m, 2),
        "consecutive_missed":        consecutive_missed,
        "partial_payment_rate":      round(partial_pct, 4),
        "missed_payment_rate":       round(missed_pct, 4),
        "promise_kept_rate":         round(promise_kept, 4),
        "outstanding_principal":     round(max(0.0, balance), 2),
        "loan_to_income_ratio":      round(loan_to_income, 4),
        "days_since_last_payment":   days_since_pay,
        "group_repayment_ratio":     round(grp_repay, 4),
        "group_arrears_ratio":       round(grp_arrears, 4),
        "poverty_proxy_score":       round(poverty_score, 4),
        "is_new_to_banking":         new_to_banking,
        "term_completion_pct":       round(term_completion_pct, 4),
        "distress_label":            distress,
        "center":                    str(row.get("center", "UNKNOWN")),
        "branch":                    str(row.get("branch", "UNKNOWN")),
        "disb_date":                 str(row.get("disb_date", "")),
        "data_source":               "real",
    }


# ── Synthetic gap-fill ────────────────────────────────────────────────────────

def generate_synthetic_row(distress_rate: float, rng: random.Random) -> dict:
    """
    Generates one synthetic EWS feature row using the observed distress rate as
    a guide.  Tagged data_source='synthetic'.

    Uses the same feature distributions as generate_synthetic_data.py but is
    driven by the real distress_rate from the PAR dataset so statistics align.
    """
    is_distress = rng.random() < distress_rate

    if is_distress:
        paid_pct    = rng.uniform(0.35, 0.72)
        arrears_d   = rng.randint(20, 120)
        partial     = rng.uniform(0.2, 0.55)
        missed      = rng.uniform(0.15, 0.45)
        promise     = rng.uniform(0.3, 0.65)
        days_pay    = rng.randint(25, 180)
        grp_repay   = rng.uniform(0.50, 0.78)
        grp_arr     = rng.uniform(0.15, 0.40)
        poverty     = rng.uniform(0.35, 0.75)
        new_banking = rng.choice([0, 0, 1])
        tenure      = rng.randint(12, 48)
        arrears_m   = rng.randint(1, 4)
        income      = rng.uniform(15_000, 55_000)
        principal   = rng.uniform(50_000, 300_000)
    else:
        paid_pct    = rng.uniform(0.82, 1.00)
        arrears_d   = rng.randint(0, 15)
        partial     = rng.uniform(0.0, 0.15)
        missed      = rng.uniform(0.0, 0.08)
        promise     = rng.uniform(0.75, 1.00)
        days_pay    = rng.randint(0, 20)
        grp_repay   = rng.uniform(0.78, 1.00)
        grp_arr     = rng.uniform(0.00, 0.10)
        poverty     = rng.uniform(0.10, 0.50)
        new_banking = rng.choice([0, 0, 0, 1])
        tenure      = rng.randint(6, 36)
        arrears_m   = 0
        income      = rng.uniform(25_000, 120_000)
        principal   = rng.uniform(30_000, 250_000)

    avg_late = min(90.0, float(arrears_d) * paid_pct * 0.5)
    lti      = (principal / income) if income > 0 else 0.0
    tcp      = min(1.0, arrears_m / max(1, tenure))

    return {
        "repayment_on_time_rate_3m": round(min(1.0, paid_pct + rng.gauss(0, 0.02)), 4),
        "repayment_on_time_rate_6m": round(paid_pct, 4),
        "avg_days_late_3m":          round(avg_late, 2),
        "consecutive_missed":        arrears_m,
        "partial_payment_rate":      round(partial, 4),
        "missed_payment_rate":       round(missed, 4),
        "promise_kept_rate":         round(promise, 4),
        "outstanding_principal":     round(max(0.0, principal), 2),
        "loan_to_income_ratio":      round(lti, 4),
        "days_since_last_payment":   days_pay,
        "group_repayment_ratio":     round(grp_repay, 4),
        "group_arrears_ratio":       round(grp_arr, 4),
        "poverty_proxy_score":       round(poverty, 4),
        "is_new_to_banking":         new_to_banking,
        "term_completion_pct":       round(tcp, 4),
        "distress_label":            int(is_distress),
        "data_source":               "synthetic",
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def load_par_csv(csv_path: str) -> list[dict]:
    path = Path(csv_path)
    if not path.exists():
        print(f"[WARN] PAR CSV not found: {csv_path}")
        return []
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
    print(f"[PAR->EWS] Loaded {len(rows)} rows from {csv_path}")
    return rows


def validate_par_columns(rows: list[dict]) -> bool:
    if not rows:
        return False
    cols = set(rows[0].keys())
    # Check either M1 schema or legacy schema
    has_m1 = {"contract_amount", "installment"}.issubset(cols)
    has_legacy = {"arrears_days", "balance_outstanding"}.issubset(cols)
    if not (has_m1 or has_legacy):
        print(f"[ERROR] PAR CSV does not match recognized schema.", file=sys.stderr)
        print(f"        Found columns: {sorted(cols)[:10]}...", file=sys.stderr)
        return False
    print(f"[PAR->EWS] Validated PAR CSV schema ({'M1 partner export' if has_m1 else 'legacy export'})")
    return True


def main() -> None:
    args = parse_args()
    rng = random.Random(args.seed)

    print(f"[PAR->EWS] Starting feature matrix build")
    print(f"  PAR CSV   : {args.par_csv}")
    print(f"  Output    : {args.output}")
    print(f"  Min rows  : {args.min_rows}")

    # ── Load real PAR data ────────────────────────────────────────────────────
    par_rows = load_par_csv(args.par_csv)
    real_ews: list[dict] = []

    if par_rows:
        if not validate_par_columns(par_rows):
            sys.exit(1)
        for row in par_rows:
            try:
                real_ews.append(map_par_row_to_ews(row))
            except Exception as exc:
                print(f"[WARN]  Skipping malformed PAR row: {exc}")

    n_real = len(real_ews)
    distress_rate = (
        sum(r["distress_label"] for r in real_ews) / n_real if n_real > 0 else 0.12
    )
    print(f"[PAR->EWS] Real rows mapped  : {n_real}")
    print(f"[PAR->EWS] Real distress rate: {distress_rate:.2%}")

    # ── Synthetic gap-fill ────────────────────────────────────────────────────
    synth_ews: list[dict] = []
    gap = max(0, args.min_rows - n_real)
    n_synth = gap + max(0, args.synthetic_fill)

    if n_synth > 0:
        print(f"[PAR->EWS] Generating {n_synth} synthetic rows "
              f"({'gap-fill' if gap > 0 else 'forced'}, seed={args.seed})")
        for _ in range(n_synth):
            synth_ews.append(generate_synthetic_row(distress_rate, rng))

    # ── Combine & shuffle ─────────────────────────────────────────────────────
    all_rows = real_ews + synth_ews
    rng.shuffle(all_rows)

    total        = len(all_rows)
    total_dist   = sum(r["distress_label"] for r in all_rows)
    total_synth  = sum(1 for r in all_rows if r["data_source"] == "synthetic")

    print(f"\n[PAR->EWS] Final matrix summary:")
    print(f"  Total rows       : {total}")
    print(f"  Real rows        : {total - total_synth}")
    print(f"  Synthetic rows   : {total_synth}")
    print(f"  Distress rate    : {total_dist / max(1, total):.2%}")
    print(f"  Class balance    : {total_dist} distressed / {total - total_dist} healthy")

    if total < 50:
        print("[WARN] Very few rows — model metrics will be unreliable. "
              "Pass --min-rows to increase synthetic fill.", file=sys.stderr)

    # ── Write output ──────────────────────────────────────────────────────────
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=EWS_FEATURES)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\n[PAR->EWS] Feature matrix written -> {out_path}")
    print("  Next step: python ml/m3_ews/train/train_model.py "
          f"--data {out_path}")


if __name__ == "__main__":
    main()
