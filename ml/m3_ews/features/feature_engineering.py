"""
M3 EWS — Feature Engineering Script
=====================================
Connects to the tenant PostgreSQL DB, pulls raw loan/collection/group data,
and computes a feature matrix suitable for training the EWS distress model.

Output: CSV saved to ml/m3_ews/data/features/feature_matrix.csv (gitignored)

Usage:
    python ml/m3_ews/features/feature_engineering.py \
        --db-url postgresql://user:pass@localhost/imfs_tenant_apex \
        --output ml/m3_ews/data/features/feature_matrix.csv \
        --reference-date 2026-10-01

Features per borrower (as of reference date):
    - repayment_on_time_rate_3m      : % installments paid on time in last 3 months
    - repayment_on_time_rate_6m      : % installments paid on time in last 6 months
    - avg_days_late_3m               : average days late on paid installments (last 3 months)
    - consecutive_missed             : max consecutive missed installments
    - partial_payment_rate           : % collections with outcome 'partial'
    - missed_payment_rate            : % collections with outcome 'missed'
    - promise_kept_rate              : % promise_to_pay followed by actual payment
    - outstanding_principal          : current outstanding principal (LKR)
    - loan_to_income_ratio           : principal / monthly_income (0 if income unknown)
    - days_since_last_payment        : days since last collection with amount > 0
    - group_repayment_ratio          : latest group_repayment_stats.repayment_ratio (0 if individual)
    - group_arrears_ratio            : latest group_repayment_stats.arrears_ratio (0 if individual)
    - poverty_proxy_score            : borrower.poverty_proxy_score (0 if null)
    - is_new_to_banking              : borrower.is_new_to_banking (0/1)
    - term_completion_pct            : installments past due-date / total installments
    [target]
    - distress_label                 : 1 if loan hit PAR30 within 90 days of reference date
"""

import argparse
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import psycopg2
import psycopg2.extras


# ── CLI args ──────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="M3 EWS feature engineering")
    parser.add_argument(
        "--db-url",
        default=os.environ.get("TENANT_DATABASE_URL"),
        help="Tenant PostgreSQL connection URL",
    )
    parser.add_argument(
        "--output",
        default="ml/m3_ews/data/features/feature_matrix.csv",
        help="Output CSV path",
    )
    parser.add_argument(
        "--reference-date",
        default=str(date.today()),
        help="ISO date to treat as 'today' for feature computation (default: today)",
    )
    return parser.parse_args()


# ── DB helpers ────────────────────────────────────────────────────────────────

def fetch_all(cur, sql, params=None):
    cur.execute(sql, params or [])
    return cur.fetchall()


def fetch_df(cur, sql, params=None):
    cur.execute(sql, params or [])
    cols = [desc[0] for desc in cur.description]
    rows = cur.fetchall()
    return pd.DataFrame(rows, columns=cols)


# ── Main feature computation ──────────────────────────────────────────────────

def compute_features(conn, ref_date: date) -> pd.DataFrame:
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    ref_str = ref_date.strftime("%Y-%m-%d")
    window_3m = (ref_date - timedelta(days=90)).strftime("%Y-%m-%d")
    window_6m = (ref_date - timedelta(days=180)).strftime("%Y-%m-%d")
    horizon_90d = (ref_date + timedelta(days=90)).strftime("%Y-%m-%d")

    # 1. Active loans as of reference date
    loans_df = fetch_df(cur, """
        SELECT
            l.id              AS loan_id,
            l.borrower_id,
            l.group_id,
            l.principal,
            l.term_months,
            l.activated_at,
            b.monthly_income,
            b.poverty_proxy_score,
            b.is_new_to_banking
        FROM loans l
        JOIN borrowers b ON b.id = l.borrower_id
        WHERE l.status = 'active'
          AND l.activated_at::date <= %s
    """, [ref_str])

    if loans_df.empty:
        print("[WARN] No active loans found. Check the DB or reference date.")
        return pd.DataFrame()

    # 2. Repayment schedules (all installments up to reference date)
    schedules_df = fetch_df(cur, """
        SELECT
            rs.loan_id,
            rs.installment_no,
            rs.due_date,
            rs.amount_due,
            rs.amount_paid,
            rs.status
        FROM repayment_schedules rs
        JOIN loans l ON l.id = rs.loan_id
        WHERE l.status = 'active'
          AND l.activated_at::date <= %s
    """, [ref_str])

    # 3. Collections (visit outcomes)
    collections_df = fetch_df(cur, """
        SELECT
            c.loan_id,
            c.visit_date,
            c.outcome,
            c.amount_collected,
            c.promise_date
        FROM collections c
        JOIN loans l ON l.id = c.loan_id
        WHERE l.status = 'active'
          AND c.visit_date::date <= %s
    """, [ref_str])

    # 4. Group repayment stats (latest per group)
    group_stats_df = fetch_df(cur, """
        SELECT DISTINCT ON (group_id)
            group_id,
            repayment_ratio,
            arrears_ratio
        FROM group_repayment_stats
        WHERE period <= %s
        ORDER BY group_id, period DESC
    """, [ref_str])
    group_stats = group_stats_df.set_index("group_id")

    # 5. PAR30 label: did this loan become PAR30 within 90 days AFTER ref_date?
    #    (Only useful if you have historical data past ref_date; for initial training
    #     label everything currently PAR30 as distress=1.)
    par_df = fetch_df(cur, """
        SELECT DISTINCT loan_id
        FROM par_status
        WHERE par_bucket IN ('PAR30', 'PAR90')
          AND computed_at::date BETWEEN %s AND %s
    """, [ref_str, horizon_90d])
    par30_loan_ids = set(par_df["loan_id"].tolist())

    # ── Feature computation per loan ─────────────────────────────────────────
    records = []
    for _, loan in loans_df.iterrows():
        lid = loan["loan_id"]

        s = schedules_df[schedules_df["loan_id"] == lid].copy()
        s["due_date"] = pd.to_datetime(s["due_date"])

        c = collections_df[collections_df["loan_id"] == lid].copy()
        c["visit_date"] = pd.to_datetime(c["visit_date"])

        # ── Schedule-based features ───────────────────────────────────────────
        overdue_s = s[s["due_date"].dt.date <= ref_date]
        total_due = len(overdue_s)

        s_3m = overdue_s[overdue_s["due_date"].dt.date >= date.fromisoformat(window_3m)]
        s_6m = overdue_s[overdue_s["due_date"].dt.date >= date.fromisoformat(window_6m)]

        def on_time_rate(subset):
            if len(subset) == 0:
                return 1.0
            paid_on_time = subset[subset["status"] == "paid"]
            return len(paid_on_time) / len(subset)

        repayment_on_time_rate_3m = on_time_rate(s_3m)
        repayment_on_time_rate_6m = on_time_rate(s_6m)

        # Outstanding principal (sum of remaining principalDue on unpaid schedules)
        unpaid = s[s["status"].isin(["upcoming", "partial"])]
        outstanding_principal = float(unpaid["amount_due"].sum()) - float(unpaid["amount_paid"].sum())
        outstanding_principal = max(outstanding_principal, 0)

        # term_completion_pct
        term_completion_pct = total_due / max(loan["term_months"], 1)

        # consecutive missed
        statuses = overdue_s.sort_values("due_date")["status"].tolist()
        max_consec = cur_consec = 0
        for st in statuses:
            if st == "missed":
                cur_consec += 1
                max_consec = max(max_consec, cur_consec)
            else:
                cur_consec = 0
        consecutive_missed = max_consec

        # Average days late for paid installments (3m)
        avg_days_late_3m = 0.0
        # (Simplified — schedule doesn't store actual_payment_date yet; use 0 as placeholder)

        # ── Collection-based features ─────────────────────────────────────────
        c_3m = c[c["visit_date"].dt.date >= date.fromisoformat(window_3m)]
        n_visits = len(c_3m)

        partial_payment_rate = (
            len(c_3m[c_3m["outcome"] == "partial"]) / n_visits if n_visits > 0 else 0.0
        )
        missed_payment_rate = (
            len(c_3m[c_3m["outcome"] == "missed"]) / n_visits if n_visits > 0 else 0.0
        )

        # promise_kept_rate: promises followed by actual payment
        promises = c[c["outcome"] == "promise_to_pay"].copy()
        kept = 0
        for _, p in promises.iterrows():
            if p["promise_date"] is not None:
                follow_up = c[
                    (c["visit_date"].dt.date >= p["promise_date"].date()
                     if hasattr(p["promise_date"], "date") else True)
                    & (c["amount_collected"] > 0)
                ]
                if len(follow_up) > 0:
                    kept += 1
        promise_kept_rate = kept / len(promises) if len(promises) > 0 else 1.0

        paid_visits = c[c["amount_collected"] > 0]
        days_since_last_payment = (
            (ref_date - paid_visits["visit_date"].dt.date.max()).days
            if not paid_visits.empty
            else 999
        )

        # ── Borrower / group features ─────────────────────────────────────────
        monthly_income = float(loan["monthly_income"] or 0)
        principal = float(loan["principal"])
        loan_to_income_ratio = principal / monthly_income if monthly_income > 0 else 0.0

        poverty_proxy_score = float(loan["poverty_proxy_score"] or 0)
        is_new_to_banking = int(loan["is_new_to_banking"] or 0)

        # Group features
        gid = loan["group_id"]
        if gid and gid in group_stats.index:
            group_repayment_ratio = float(group_stats.loc[gid, "repayment_ratio"])
            group_arrears_ratio = float(group_stats.loc[gid, "arrears_ratio"])
        else:
            group_repayment_ratio = 0.0
            group_arrears_ratio = 0.0

        # ── Label ─────────────────────────────────────────────────────────────
        distress_label = 1 if lid in par30_loan_ids else 0

        records.append({
            "loan_id": lid,
            "borrower_id": loan["borrower_id"],
            "repayment_on_time_rate_3m": round(repayment_on_time_rate_3m, 4),
            "repayment_on_time_rate_6m": round(repayment_on_time_rate_6m, 4),
            "avg_days_late_3m": round(avg_days_late_3m, 2),
            "consecutive_missed": consecutive_missed,
            "partial_payment_rate": round(partial_payment_rate, 4),
            "missed_payment_rate": round(missed_payment_rate, 4),
            "promise_kept_rate": round(promise_kept_rate, 4),
            "outstanding_principal": round(outstanding_principal, 2),
            "loan_to_income_ratio": round(loan_to_income_ratio, 4),
            "days_since_last_payment": days_since_last_payment,
            "group_repayment_ratio": round(group_repayment_ratio, 4),
            "group_arrears_ratio": round(group_arrears_ratio, 4),
            "poverty_proxy_score": round(poverty_proxy_score, 4),
            "is_new_to_banking": is_new_to_banking,
            "term_completion_pct": round(term_completion_pct, 4),
            "distress_label": distress_label,
        })

    cur.close()
    return pd.DataFrame(records)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    if not args.db_url:
        print("[ERROR] --db-url or TENANT_DATABASE_URL env var is required", file=sys.stderr)
        sys.exit(1)

    ref_date = date.fromisoformat(args.reference_date)
    print(f"[M3 EWS] Feature engineering · reference date = {ref_date}")

    try:
        conn = psycopg2.connect(args.db_url)
    except Exception as e:
        print(f"[ERROR] Cannot connect to DB: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        df = compute_features(conn, ref_date)
    finally:
        conn.close()

    if df.empty:
        print("[WARN] Empty feature matrix — nothing written.")
        sys.exit(0)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    print(f"[M3 EWS] Written {len(df)} rows to {output_path}")
    print(f"  Distress rate : {df['distress_label'].mean():.2%}")
    print(f"  Features      : {[c for c in df.columns if c not in ('loan_id','borrower_id','distress_label')]}")


if __name__ == "__main__":
    main()
