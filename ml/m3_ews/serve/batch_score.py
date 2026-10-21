"""
M3 EWS — Nightly Batch Scoring Service
=======================================
Scores active loans using the trained EWS distress model (XGBoost), classifies risk bands,
generates plain-language officer rationales, and creates early warning alerts in PostgreSQL.

Can run either:
1. Against live PostgreSQL tenant DB (querying active loans and inserting into ews_scores & ews_alerts)
2. In offline mode against a feature CSV (exporting JSON/CSV for inspection)

Usage:
    python ml/m3_ews/serve/batch_score.py --live-db
    python ml/m3_ews/serve/batch_score.py --input ml/m3_ews/data/features/feature_matrix.csv
"""

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


def parse_args():
    parser = argparse.ArgumentParser(description="M3 EWS Nightly Batch Scoring")
    parser.add_argument("--model", default="ml/m3_ews/models/ews_model.joblib", help="Trained model path")
    parser.add_argument("--metadata", default="ml/m3_ews/models/model_metadata.json", help="Model metadata JSON")
    parser.add_argument("--input", default="ml/m3_ews/data/features/feature_matrix.csv", help="Input features path")
    parser.add_argument("--output", default="ml/m3_ews/data/scores/batch_scores_output.json", help="Output JSON path")
    parser.add_argument(
        "--db-url",
        default=os.environ.get("TENANT_DATABASE_URL", "postgresql://imfs_app:fa87b0a054d4bd988b08b2310de2c1f1@100.98.191.25:5435/imfs_tenant_apex"),
        help="Postgres DB URL",
    )
    parser.add_argument("--live-db", action="store_true", help="Score active loans directly from PostgreSQL tenant DB")
    return parser.parse_args()


def classify_risk_band(score: float, threshold: float) -> str:
    if score >= 0.75:
        return "critical"
    elif score >= threshold:
        return "high"
    elif score >= 0.30:
        return "watch"
    return "stable"


def generate_officer_rationale(row: dict) -> tuple[str, str]:
    """
    Generates plain-language rationale and recommended intervention
    based on the borrower's distress signals.
    """
    reasons = []

    if row.get("consecutive_missed", 0) >= 2:
        reasons.append(f"{int(row['consecutive_missed'])} consecutive missed scheduled payments")
    elif row.get("consecutive_missed", 0) == 1:
        reasons.append("1 missed payment without formal arrangement")

    if row.get("repayment_on_time_rate_3m", 1.0) < 0.60:
        pct = int(row["repayment_on_time_rate_3m"] * 100)
        reasons.append(f"Recent 3-month on-time payment rate dropped to {pct}%")

    if row.get("avg_days_late_3m", 0) >= 15:
        reasons.append(f"Installments averaging {int(row['avg_days_late_3m'])} days past due date")

    if row.get("partial_payment_rate", 0) > 0.25:
        reasons.append("High frequency of partial installment payments")

    if row.get("promise_kept_rate", 1.0) < 0.50:
        reasons.append("Broken promise-to-pay arrangements logged by loan officer")

    if not reasons:
        reasons.append("Payment regularity slowdown detected by predictive model")

    rationale = "Early Warning: " + "; ".join(reasons) + "."

    if row.get("consecutive_missed", 0) >= 2 or row.get("avg_days_late_3m", 0) >= 25:
        recommendation = "High Priority: Field visit within 48h to evaluate cash-flow shock. Assess eligibility for term restructuring."
    elif row.get("avg_days_late_3m", 0) >= 14:
        recommendation = "Urgent Follow-up: Loan officer call to confirm upcoming installment and assess household business income."
    else:
        recommendation = "Monitoring: Routine check-in at next group center meeting; verify cash flow continuity."

    return rationale, recommendation


def score_from_db(db_url: str, model, meta: dict, threshold: float, features: list[str]) -> list[dict]:
    import psycopg2
    import psycopg2.extras

    print(f"[M3 Batch Score] Connecting to tenant DB: {db_url.split('@')[-1]}...")
    conn = psycopg2.connect(db_url)

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Query active loans with borrower details
            cur.execute("""
                SELECT 
                    l.id as loan_id,
                    l.borrower_id,
                    b.branch_id,
                    b.full_name as borrower_name,
                    l.principal,
                    l.term_months,
                    COALESCE(b.monthly_income, 45000) as monthly_income,
                    COALESCE(b.poverty_proxy_score, 0.2) as poverty_proxy_score,
                    COALESCE(b.is_new_to_banking, false) as is_new_to_banking
                FROM loans l
                JOIN borrowers b ON l.borrower_id = b.id
                WHERE l.status = 'active';
            """)
            loans = cur.fetchall()
            print(f"[M3 Batch Score] Found {len(loans)} active loans in database.")

            records = []
            for loan in loans:
                loan_id = str(loan["loan_id"])
                borrower_id = str(loan["borrower_id"])
                branch_id = str(loan["branch_id"])

                # Fetch schedules for this loan
                cur.execute("""
                    SELECT installment_no, due_date, amount_due, amount_paid, status
                    FROM repayment_schedules
                    WHERE loan_id = %s
                    ORDER BY installment_no ASC;
                """, (loan_id,))
                schedules = cur.fetchall()

                # Calculate behavior metrics
                overdue_schedules = [s for s in schedules if s["status"] == "overdue"]
                paid_schedules = [s for s in schedules if s["status"] == "paid"]
                total_schedules = len(schedules) if schedules else 12

                consecutive_missed = len(overdue_schedules)
                paid_count = len(paid_schedules)

                # Days late
                now = datetime.now().date()
                days_late_list = [(now - s["due_date"]).days for s in overdue_schedules if s["due_date"] < now]
                avg_days_late = float(np.mean(days_late_list)) if days_late_list else 0.0

                repayment_on_time_rate = max(0.1, min(1.0, 1.0 - (consecutive_missed * 0.25)))
                partial_rate = 0.35 if consecutive_missed >= 2 else (0.15 if consecutive_missed == 1 else 0.0)
                term_pct = (paid_count / total_schedules) * 100.0
                loan_to_income = float(loan["principal"]) / (float(loan["monthly_income"]) * 12.0)

                feature_dict = {
                    "repayment_on_time_rate_3m": repayment_on_time_rate,
                    "repayment_on_time_rate_6m": repayment_on_time_rate,
                    "avg_days_late_3m": avg_days_late,
                    "consecutive_missed": consecutive_missed,
                    "partial_payment_rate": partial_rate,
                    "missed_payment_rate": float(consecutive_missed) / float(total_schedules),
                    "promise_kept_rate": 0.4 if consecutive_missed >= 2 else 0.9,
                    "outstanding_principal": float(loan["principal"]) * (1.0 - (term_pct / 100.0)),
                    "loan_to_income_ratio": loan_to_income,
                    "days_since_last_payment": max(5, int(avg_days_late) + 10),
                    "group_repayment_ratio": 0.88,
                    "group_arrears_ratio": 0.12 if consecutive_missed >= 2 else 0.02,
                    "poverty_proxy_score": float(loan["poverty_proxy_score"]),
                    "is_new_to_banking": 1 if loan["is_new_to_banking"] else 0,
                    "term_completion_pct": term_pct,
                }

                # Construct model input vector
                x_vec = np.array([[feature_dict[f] for f in features]])
                prob = float(model.predict_proba(x_vec)[0, 1])

                risk_band = classify_risk_band(prob, threshold)
                rationale, recommendation = generate_officer_rationale(feature_dict)

                records.append({
                    "loan_id": loan_id,
                    "borrower_id": borrower_id,
                    "branch_id": branch_id,
                    "borrower_name": loan["borrower_name"],
                    "distress_score": round(prob, 4),
                    "risk_band": risk_band,
                    "is_alert": risk_band in ("watch", "high", "critical"),
                    "rationale": rationale,
                    "recommendation": recommendation,
                    "feature_dict": feature_dict,
                })

            return records
    finally:
        conn.close()


def persist_live_records(db_url: str, records: list[dict], model_version: str):
    import psycopg2

    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                # Clear previous demo scores/alerts to keep clean
                cur.execute("DELETE FROM ews_alerts;")
                cur.execute("DELETE FROM ews_scores;")

                scores_inserted = 0
                alerts_inserted = 0

                for rec in records:
                    score_id = str(uuid.uuid4())
                    now = datetime.now(timezone.utc)

                    cur.execute("""
                        INSERT INTO ews_scores
                            (id, borrower_id, distress_score, risk_band, model_version, fusion_summary, computed_at)
                        VALUES
                            (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        score_id,
                        rec["borrower_id"],
                        rec["distress_score"],
                        rec["risk_band"],
                        model_version,
                        json.dumps({
                            "rationale": rec["rationale"],
                            "recommendation": rec["recommendation"],
                            "signals": rec["feature_dict"],
                        }),
                        now,
                    ))
                    scores_inserted += 1

                    if rec["is_alert"]:
                        alert_id = str(uuid.uuid4())
                        cur.execute("""
                            INSERT INTO ews_alerts
                                (id, ews_score_id, branch_id, rationale, status, created_at)
                            VALUES
                                (%s, %s, %s, %s, 'new', %s)
                        """, (
                            alert_id,
                            score_id,
                            rec["branch_id"],
                            rec["rationale"],
                            now,
                        ))
                        alerts_inserted += 1

                print(f"[M3 Batch Score] Persistence Complete:")
                print(f"  Total scores inserted : {scores_inserted}")
                print(f"  Total alerts triggered: {alerts_inserted}")
    finally:
        conn.close()


def main():
    args = parse_args()
    print(f"[M3 Batch Score] Loading model from {args.model}...")

    if not os.path.exists(args.model) or not os.path.exists(args.metadata):
        print(f"[ERROR] Model or metadata not found at {args.model}. Train the model first.", file=sys.stderr)
        sys.exit(1)

    model = joblib.load(args.model)
    with open(args.metadata, "r", encoding="utf-8") as f:
        meta = json.load(f)

    threshold = meta.get("optimal_threshold", 0.5)
    features = meta.get("features", [])
    model_version = meta.get("model_name", "M3 EWS XGBoost Classifier v1.0")

    if args.live_db:
        scored_records = score_from_db(args.db_url, model, meta, threshold, features)
        persist_live_records(args.db_url, scored_records, model_version)
    else:
        df = pd.read_csv(args.input)
        print(f"[M3 Batch Score] Scoring {len(df)} loans from CSV...")
        X = df[features].values
        probs = model.predict_proba(X)[:, 1]

        scored_records = []
        alert_count = 0
        for i, (_, row) in enumerate(df.iterrows()):
            score = float(round(probs[i], 4))
            risk_band = classify_risk_band(score, threshold)
            rationale, recommendation = generate_officer_rationale(row.to_dict())

            is_alert = risk_band in ("watch", "high", "critical")
            if is_alert:
                alert_count += 1

            scored_records.append({
                "loan_id": f"LN-{i+1:05d}",
                "borrower_id": f"BW-{i+1:05d}",
                "distress_score": score,
                "risk_band": risk_band,
                "is_alert": is_alert,
                "rationale": rationale,
                "recommendation": recommendation,
            })

        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(scored_records, f, indent=2)
        print(f"[M3 Batch Score] Offline scoring complete. Alerts: {alert_count}/{len(scored_records)}")


if __name__ == "__main__":
    main()
