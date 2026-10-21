"""M2 Batch Drift Scoring & Intelligence Service.

Combines:
1. Retrospective MDI computation (formula)
2. Predictive XGBoost Drift Risk scoring (forward probability & trajectory)
3. Branch-level portfolio risk ranking across all 17 branches
4. Grounded GenAI Narrative generation (NFR-06 compliant)

Outputs:
- data/processed/m2_intelligence_report.json
- Console executive summary
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.drift_features import FEATURE_COLUMNS, compute_velocity_features  # noqa: E402
from kpi.kpi_engine import calculate_portfolio_kpis, calculate_social_indicators  # noqa: E402
from mdi.mdi import compute_mdi, load_settings  # noqa: E402
from narrative.narrative_engine import generate_grounded_narrative  # noqa: E402

DATA_PROC = ROOT / "data" / "processed"
ARTIFACTS = ROOT / "artifacts"
OUT_REPORT = DATA_PROC / "m2_intelligence_report.json"


def score_institution_and_branches(
    data_dir: Path = DATA_PROC,
    artifacts_dir: Path = ARTIFACTS,
) -> dict[str, Any]:
    """Generates the full Component 2 Mission Intelligence Report."""
    # 1. Load data
    settings = load_settings()
    kpi_df = pd.read_csv(data_dir / "kpi_monthly.csv")
    soc_df = pd.read_csv(data_dir / "social_monthly.csv")
    mdi_df = pd.read_csv(data_dir / "mdi_monthly.csv")
    borrowers_df = pd.read_csv(data_dir / "borrowers_m2.csv")

    # Merge monthly timeline
    merged = soc_df.merge(kpi_df, on="month").merge(mdi_df[["month", "score", "threshold"]], on="month")
    merged = merged.sort_values("month").reset_index(drop=True)

    # Compute features for predictive model
    feat_df = compute_velocity_features(merged)
    latest_feat = feat_df.iloc[[-1]][FEATURE_COLUMNS]

    # 2. Load trained XGBoost models
    clf_path = artifacts_dir / "drift_xgb_classifier.joblib"
    reg_path = artifacts_dir / "drift_xgb_regressor.joblib"

    drift_prob = None
    pred_forward_score = None
    if clf_path.exists() and reg_path.exists():
        clf = joblib.load(clf_path)
        reg = joblib.load(reg_path)
        drift_prob = float(clf.predict_proba(latest_feat)[0, 1])
        pred_forward_score = float(reg.predict(latest_feat)[0])

    latest_month = str(merged.iloc[-1]["month"])
    latest_mdi_score = float(merged.iloc[-1]["score"])
    threshold = float(merged.iloc[-1]["threshold"])

    # 3. MDI Retrospective Result
    recent_history = merged[["female", "poverty", "rural", "low_income", "new_to_banking", "dropout", "avg_loan_size"]]
    mdi_res = compute_mdi(recent_history, settings)
    mdi_res["month"] = latest_month
    mdi_res["threshold"] = threshold
    if len(merged) >= 2:
        mdi_res["changeVelocity"] = round(latest_mdi_score - float(merged.iloc[-2]["score"]), 3)
        mdi_res["previousMdi"] = float(merged.iloc[-2]["score"])

    # 4. Leading predictive signals
    risk_band = "LOW"
    if drift_prob is not None:
        if drift_prob >= 0.70:
            risk_band = "HIGH"
        elif drift_prob >= 0.40:
            risk_band = "MODERATE"

    leading_signals = []
    if float(latest_feat["loan_size_growth_3m"].iloc[0]) > 0.05:
        leading_signals.append(f"Average loan size grew by {latest_feat['loan_size_growth_3m'].iloc[0]:+.1%} over last 3 months")
    if float(latest_feat["poverty_change_3m"].iloc[0]) < -0.03:
        leading_signals.append(f"Poverty cohort outreach contracted by {latest_feat['poverty_change_3m'].iloc[0]:+.1%}")
    if float(latest_feat["female_ratio_change_3m"].iloc[0]) < -0.03:
        leading_signals.append(f"Female borrower participation fell by {latest_feat['female_ratio_change_3m'].iloc[0]:+.1%}")

    pred_risk_info = {
        "drift_probability_next_3m": round(drift_prob, 4) if drift_prob is not None else 0.0,
        "predicted_forward_mdi": round(pred_forward_score, 2) if pred_forward_score is not None else 0.0,
        "risk_band": risk_band,
        "leading_signals": leading_signals,
    }

    # 5. Latest KPIs
    latest_kpi = {
        "period": latest_month,
        "portfolioOutstanding": float(kpi_df.iloc[-1]["portfolio"]),
        "avgLoanSize": float(kpi_df.iloc[-1]["avg_loan_size"]),
        "par30": float(kpi_df.iloc[-1]["par30"]),
        "yield": float(kpi_df.iloc[-1]["yield_contract"]) if "yield_contract" in kpi_df.columns else float(kpi_df.iloc[-1].get("yield", 0.26)),
        "oss": float(kpi_df.iloc[-1]["oss"]) if "oss" in kpi_df.columns else 1.09,
    }

    # 6. Generate Grounded Narrative (NFR-06)
    narrative = generate_grounded_narrative(
        mdi_data=mdi_res,
        kpi_data=latest_kpi,
        predictive_risk=pred_risk_info,
    )

    # 7. Branch-Level Portfolio Risk Ranking
    branch_rankings = []
    if "branch" in borrowers_df.columns:
        for branch_name, b_df in borrowers_df.groupby("branch"):
            port_kpis = calculate_portfolio_kpis(b_df)
            soc_kpis = calculate_social_indicators(b_df)

            # Branch drift score estimation vs institution baseline
            b_female = soc_kpis["female_borrower_ratio"]
            b_pov = soc_kpis["poverty_proxy_score"]
            b_size = port_kpis["avg_loan_size"]

            # Drift from national baseline
            drift_f = -1.0 * (b_female - 0.78) / 0.78
            drift_p = -1.0 * (b_pov - 0.48) / 0.48
            drift_s = 1.0 * (b_size - 85000) / 85000

            b_score = 100.0 * (
                0.35 * np.clip(drift_f / 0.20, -1.0, 1.0)
                + 0.35 * np.clip(drift_p / 0.20, -1.0, 1.0)
                + 0.30 * np.clip(drift_s / 0.20, -1.0, 1.0)
            )

            branch_rankings.append({
                "branch": branch_name,
                "active_loans": port_kpis["total_loans"],
                "portfolio_lkr": port_kpis["portfolio_outstanding"],
                "avg_loan_size": port_kpis["avg_loan_size"],
                "par30_balance_ratio": port_kpis["par30_balance_ratio"],
                "female_share": b_female,
                "poverty_share": b_pov,
                "rural_share": soc_kpis["rural_borrower_ratio"],
                "estimated_branch_mdi": round(float(b_score), 2),
                "status": "ALERT" if b_score >= 20.0 else ("WATCH" if b_score >= 12.0 else "NORMAL"),
            })

        branch_rankings.sort(key=lambda x: x["estimated_branch_mdi"], reverse=True)

    report = {
        "report_id": f"M2-REPORT-{latest_month}",
        "anchor_month": latest_month,
        "executive_summary": narrative["headline"],
        "severity": narrative["severity"],
        "retrospective_mdi": mdi_res,
        "predictive_drift_risk": pred_risk_info,
        "latest_kpis": latest_kpi,
        "grounded_narrative": narrative,
        "branch_risk_rankings": branch_rankings,
    }

    OUT_REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"[M2 Serve] Wrote intelligence report to: {OUT_REPORT}")

    return report


def main():
    parser = argparse.ArgumentParser(description="M2 Batch Drift Scoring & Executive Intelligence Service")
    parser.add_argument("--json-only", action="store_true", help="Print only JSON output")
    args = parser.parse_args()

    report = score_institution_and_branches()

    if args.json_only:
        print(json.dumps(report, indent=2))
        return

    print("\n" + "=" * 70)
    print(" MICROFLOW (COMPONENT 2) — DUAL-MISSION INTELLIGENCE BRIEFING")
    print("=" * 70)
    print(f"Anchor Period      : {report['anchor_month']}")
    print(f"Severity State     : {report['severity']}")
    print(f"Current MDI Score  : {report['retrospective_mdi']['score']:.2f} (Threshold: {report['retrospective_mdi']['threshold']:.1f})")
    print(f"Forward Drift Prob : {report['predictive_drift_risk']['drift_probability_next_3m']:.1%} [{report['predictive_drift_risk']['risk_band']} RISK]")
    print(f"Forecasted MDI (3m): {report['predictive_drift_risk']['predicted_forward_mdi']:.2f}")

    print("\n--- EXECUTIVE NARRATIVE (NFR-06 GROUNDED) ---")
    print(report["grounded_narrative"]["headline"])
    print("\n[Trade-off Analysis]")
    print(report["grounded_narrative"]["tradeoff_analysis"])
    print("\n[Strategic Governance Recommendations]")
    for i, r in enumerate(report["grounded_narrative"]["recommendations"], 1):
        print(f"  {i}. {r}")

    print("\n--- TOP 5 HIGHEST DRIFT RISK BRANCHES ---")
    for b in report["branch_risk_rankings"][:5]:
        print(
            f"  - {b['branch']:<16} | MDI: {b['estimated_branch_mdi']:>5.1f} | "
            f"Female: {b['female_share']:>5.1%} | Poverty: {b['poverty_share']:>5.1%} | "
            f"Status: {b['status']}"
        )
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
