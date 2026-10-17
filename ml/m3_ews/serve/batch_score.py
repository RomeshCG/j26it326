"""
M3 EWS — Nightly Batch Scoring Service
=======================================
Scores active loans using the trained EWS distress model, classifies risk bands,
generates plain-language officer rationales, and creates early warning alerts.

Can run either:
1. Against live PostgreSQL tenant DB (inserting into ews_scores & ews_alerts)
2. In offline/mock mode against a feature CSV (exporting JSON/CSV for inspection)

Usage:
    python ml/m3_ews/serve/batch_score.py \
        --input ml/m3_ews/data/features/feature_matrix.csv \
        --output ml/m3_ews/data/scores/batch_scores_output.json
"""

import argparse
import json
import os
import sys
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
    parser.add_argument("--db-url", default=os.environ.get("TENANT_DATABASE_URL"), help="Optional DB URL to persist scores")
    return parser.parse_args()


def classify_risk_band(score: float, threshold: float) -> str:
    if score >= 0.75:
        return "critical"
    elif score >= threshold:
        return "high"
    elif score >= 0.30:
        return "moderate"
    return "low"


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

    if row.get("missed_payment_rate", 0) > 0.30:
        reasons.append("High proportion of uncollected field visits")

    if row.get("promise_kept_rate", 1.0) < 0.50:
        reasons.append("Repeated broken promises to pay during field visits")

    if row.get("group_arrears_ratio", 0) > 0.15:
        gap = round(row["group_arrears_ratio"] * 100, 1)
        reasons.append(f"Group arrears pressure elevated at {gap}%")

    if not reasons:
        reasons.append("Payment regularity slowdown detected by predictive model")

    rationale = "Early Warning: " + "; ".join(reasons) + "."

    # Recommended action based on severity
    if row.get("consecutive_missed", 0) >= 2 or row.get("avg_days_late_3m", 0) >= 25:
        recommendation = "High Priority: Field visit within 48h to evaluate cash-flow shock. Assess eligibility for term restructuring."
    elif row.get("group_arrears_ratio", 0) > 0.20:
        recommendation = "Group Focus: Convene peer group meeting to address mutual guarantee commitments before arrears escalate."
    else:
        recommendation = "Standard Follow-up: Call borrower to confirm upcoming installment date and verify business operational status."

    return rationale, recommendation


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

    df = pd.read_csv(args.input)
    print(f"[M3 Batch Score] Scoring {len(df)} loans...")

    X = df[features].values
    probs = model.predict_proba(X)[:, 1]

    scored_records = []
    alert_count = 0

    for i, (_, row) in enumerate(df.iterrows()):
        score = float(round(probs[i], 4))
        risk_band = classify_risk_band(score, threshold)
        rationale, recommendation = generate_officer_rationale(row.to_dict())

        is_alert = risk_band in ("critical", "high")
        if is_alert:
            alert_count += 1

        scored_records.append({
            "loan_id": row["loan_id"],
            "borrower_id": row["borrower_id"],
            "distress_score": score,
            "risk_band": risk_band,
            "is_alert": is_alert,
            "rationale": rationale,
            "recommendation": recommendation,
            "scored_at": datetime.now(timezone.utc).isoformat(),
            "model_version": meta.get("algorithm", "XGBoost-EWS-v1"),
        })

    # Output offline results
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(scored_records, f, indent=2)

    print(f"[M3 Batch Score] Scoring run complete:")
    print(f"  Total loans scored : {len(scored_records)}")
    print(f"  Alerts triggered   : {alert_count} ({alert_count / len(scored_records):.1%})")
    print(f"  Results saved to   : {out_path}")

    # ── DB persistence (tenant PostgreSQL on port 5435) ───────────────────────
    if args.db_url:
        _persist_to_db(args.db_url, scored_records)


def _persist_to_db(db_url: str, records: list[dict]) -> None:
    """
    Upserts EWS scores into ews_scores and creates new ews_alerts rows for
    high/critical loans that do not already have an open alert.

    Table expectations (must match Prisma tenant schema):
      ews_scores  (id uuid PK, loan_id uuid, distress_score numeric,
                   risk_band text, scored_at timestamptz, model_version text)
      ews_alerts  (id uuid PK, loan_id uuid, borrower_id uuid,
                   distress_score numeric, risk_band text, status text,
                   rationale text, recommendation text, created_at timestamptz)
    """
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("[WARN] psycopg2 not installed — skipping DB persistence. "
              "Install with: pip install psycopg2-binary", file=sys.stderr)
        return

    try:
        conn = psycopg2.connect(db_url)
    except Exception as exc:
        print(f"[WARN] Cannot connect to DB ({db_url}): {exc}", file=sys.stderr)
        return

    print(f"[M3 Batch Score] Persisting {len(records)} scores to DB...")

    try:
        with conn:
            with conn.cursor() as cur:
                # 1. Upsert ews_scores (one canonical row per loan per run date)
                upsert_score_sql = """
                    INSERT INTO ews_scores
                        (id, loan_id, distress_score, risk_band, scored_at, model_version)
                    VALUES
                        (gen_random_uuid(), %s, %s, %s, %s, %s)
                    ON CONFLICT (loan_id, DATE(scored_at))
                    DO UPDATE SET
                        distress_score = EXCLUDED.distress_score,
                        risk_band      = EXCLUDED.risk_band,
                        scored_at      = EXCLUDED.scored_at,
                        model_version  = EXCLUDED.model_version
                """

                # 2. Fetch already-open alert loan_ids to avoid duplicates
                cur.execute("""
                    SELECT DISTINCT loan_id::text
                    FROM ews_alerts
                    WHERE status = 'open'
                """)
                already_open: set[str] = {row[0] for row in cur.fetchall()}

                n_scores = 0
                n_alerts = 0

                for rec in records:
                    loan_id   = str(rec["loan_id"])
                    scored_at = rec["scored_at"]

                    cur.execute(upsert_score_sql, (
                        loan_id,
                        rec["distress_score"],
                        rec["risk_band"],
                        scored_at,
                        rec["model_version"],
                    ))
                    n_scores += 1

                    # Create alert only for high/critical loans without an open alert
                    if rec["is_alert"] and loan_id not in already_open:
                        cur.execute("""
                            INSERT INTO ews_alerts
                                (id, loan_id, borrower_id, distress_score,
                                 risk_band, status, rationale, recommendation, created_at)
                            VALUES
                                (gen_random_uuid(), %s, %s, %s, %s, 'open', %s, %s, %s)
                        """, (
                            loan_id,
                            str(rec["borrower_id"]),
                            rec["distress_score"],
                            rec["risk_band"],
                            rec["rationale"],
                            rec["recommendation"],
                            scored_at,
                        ))
                        already_open.add(loan_id)  # don't double-insert in same run
                        n_alerts += 1

        print(f"[M3 Batch Score] DB persistence complete:")
        print(f"  Scores upserted  : {n_scores}")
        print(f"  New alerts opened: {n_alerts}")

    except Exception as exc:
        print(f"[ERROR] DB persistence failed: {exc}", file=sys.stderr)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

