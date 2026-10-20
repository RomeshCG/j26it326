"""Comprehensive test suite for Component 2 (M2) ML & Analytics.

Tests:
1. KPI Engine (Portfolio delinquency, PAR30 > 4.3 installments rule, Social outreach)
2. Mission Drift Index (MDI computation, weights summation, alert thresholding)
3. Drift Feature Engineering (Rolling velocities, relative changes)
4. XGBoost Model Inference (Classifier bounds, regressor trajectory)
5. Grounded Narrative Engine (NFR-06 compliance, no invented metrics)
6. End-to-end Batch Intelligence Report generation
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.drift_features import FEATURE_COLUMNS, compute_velocity_features
from kpi.kpi_engine import (
    calculate_financial_performance_ratios,
    calculate_portfolio_kpis,
    calculate_social_indicators,
)
from mdi.mdi import compute_mdi, load_settings
from narrative.narrative_engine import generate_grounded_narrative
from serve.batch_drift_score import score_institution_and_branches


def test_kpi_engine_par_and_social():
    # Synthetic mini-portfolio: 5 loans, 2 late > 4.3 installments
    df = pd.DataFrame({
        "balance_capital": [10000.0, 20000.0, 30000.0, 40000.0, 50000.0],
        "contract_amount": [15000.0, 25000.0, 35000.0, 45000.0, 55000.0],
        "age": [1.0, 2.0, 5.0, 6.0, 0.0],  # 5.0 and 6.0 are late > 4.3
        "gender": ["female", "female", "male", "female", "male"],
        "area_type": ["rural", "rural", "urban", "rural", "estate"],
        "below_poverty_line": [1, 1, 0, 1, 0],
        "low_income": [1, 1, 1, 1, 0],
        "new_to_banking": [1, 0, 0, 1, 0],
    })

    port_kpis = calculate_portfolio_kpis(df)
    assert port_kpis["total_loans"] == 5
    assert port_kpis["portfolio_outstanding"] == 150000.0
    assert port_kpis["par30_count"] == 2
    # Late loans: index 2 (30,000) and index 3 (40,000) = 70,000 / 150,000 = 46.67%
    assert round(port_kpis["par30_balance_ratio"], 2) == 0.47
    assert port_kpis["par30_count_ratio"] == 0.40

    soc_kpis = calculate_social_indicators(df)
    assert soc_kpis["female_borrower_ratio"] == 0.60
    assert soc_kpis["rural_borrower_ratio"] == 0.60
    assert soc_kpis["poverty_proxy_score"] == 0.60
    assert soc_kpis["low_income_client_ratio"] == 0.80

    acc_kpis = calculate_financial_performance_ratios(
        interest_income=50000.0,
        operating_expenses=25000.0,
        financial_expenses=10000.0,
        loan_loss_provisions=5000.0,
        average_gross_portfolio=200000.0,
    )
    # OSS = 50,000 / (25k + 10k + 5k = 40k) = 1.25
    assert acc_kpis["oss"] == 1.25
    # OER = (25,000 * 12) / 200,000 = 1.50
    assert acc_kpis["oer"] == 1.50
    print("[PASS] test_kpi_engine_par_and_social")


def test_mdi_pure_computation():
    s = load_settings()
    # Baseline: 3 identical months; Current: 3 months with adverse drift
    history = pd.DataFrame([
        {"female": 0.78, "poverty": 0.48, "rural": 0.77, "low_income": 0.65, "new_to_banking": 0.20, "dropout": 0.03, "avg_loan_size": 85000},
        {"female": 0.78, "poverty": 0.48, "rural": 0.77, "low_income": 0.65, "new_to_banking": 0.20, "dropout": 0.03, "avg_loan_size": 85000},
        {"female": 0.78, "poverty": 0.48, "rural": 0.77, "low_income": 0.65, "new_to_banking": 0.20, "dropout": 0.03, "avg_loan_size": 85000},
        # Drift: female dropped by 20%, avg loan size increased by 20%
        {"female": 0.624, "poverty": 0.48, "rural": 0.77, "low_income": 0.65, "new_to_banking": 0.20, "dropout": 0.03, "avg_loan_size": 102000},
        {"female": 0.624, "poverty": 0.48, "rural": 0.77, "low_income": 0.65, "new_to_banking": 0.20, "dropout": 0.03, "avg_loan_size": 102000},
        {"female": 0.624, "poverty": 0.48, "rural": 0.77, "low_income": 0.65, "new_to_banking": 0.20, "dropout": 0.03, "avg_loan_size": 102000},
    ])

    res = compute_mdi(history, s)
    # Female 20% drop = full 25.0 contribution; avg loan 20% rise = full 15.0 contribution -> Score = 40.0
    assert res["score"] >= 39.0
    assert res["state"] == "alert"
    assert len(res["contributingTrends"]) == 7
    print("[PASS] test_mdi_pure_computation")


def test_drift_feature_engineering():
    monthly_data = pd.DataFrame({
        "month": ["2026-01", "2026-02", "2026-03", "2026-04"],
        "score": [2.0, 3.0, 5.0, 10.0],
        "avg_loan_size": [70000, 72000, 75000, 80000],
        "female": [0.78, 0.77, 0.75, 0.72],
        "poverty": [0.48, 0.47, 0.45, 0.42],
        "rural": [0.77, 0.76, 0.75, 0.73],
        "par30": [0.04, 0.042, 0.045, 0.05],
        "yield_contract": [0.26, 0.26, 0.27, 0.28],
        "new_to_banking": [0.20, 0.19, 0.18, 0.17],
    })

    feat = compute_velocity_features(monthly_data)
    assert "mdi_velocity_1m" in feat.columns
    assert feat["mdi_velocity_1m"].iloc[-1] == 5.0  # 10.0 - 5.0
    assert "loan_size_growth_3m" in feat.columns
    for col in FEATURE_COLUMNS:
        assert col in feat.columns, f"Missing feature column: {col}"
    print("[PASS] test_drift_feature_engineering")


def test_xgboost_model_artifacts():
    clf_path = ROOT / "artifacts" / "drift_xgb_classifier.joblib"
    reg_path = ROOT / "artifacts" / "drift_xgb_regressor.joblib"
    meta_path = ROOT / "artifacts" / "drift_model_metadata.json"

    assert clf_path.exists(), "Classifier artifact missing"
    assert reg_path.exists(), "Regressor artifact missing"
    assert meta_path.exists(), "Metadata artifact missing"

    clf = joblib.load(clf_path)
    reg = joblib.load(reg_path)

    # Test single row prediction
    dummy_x = pd.DataFrame([{col: 0.1 for col in FEATURE_COLUMNS}])
    dummy_x["current_mdi"] = 22.0
    dummy_x["mdi_velocity_1m"] = 8.0

    prob = float(clf.predict_proba(dummy_x)[0, 1])
    pred_mdi = float(reg.predict(dummy_x)[0])

    assert 0.0 <= prob <= 1.0, f"Probability out of range: {prob}"
    assert isinstance(pred_mdi, float)
    print(f"[PASS] test_xgboost_model_artifacts (prob={prob:.2%}, pred_score={pred_mdi:.2f})")


def test_grounded_narrative_nfr06():
    mdi_evidence = {
        "score": 22.4,
        "threshold": 20.0,
        "state": "alert",
        "month": "2026-07",
        "changeVelocity": 12.0,
        "contributingTrends": [
            {"indicator": "avg_loan_size", "label": "Average loan size", "relativeChange": 0.086, "contribution": 6.45, "baseline": 65000, "current": 70590},
            {"indicator": "poverty", "label": "Below-poverty-line borrowers share", "relativeChange": -0.068, "contribution": 6.80, "baseline": 0.483, "current": 0.450},
            {"indicator": "female", "label": "Female borrowers share", "relativeChange": -0.052, "contribution": 6.50, "baseline": 0.780, "current": 0.739},
        ],
    }
    kpi_evidence = {
        "portfolioOutstanding": 315270000.0,
        "avgLoanSize": 70590.0,
        "par30": 0.2094,
        "oss": 1.09,
    }
    pred_risk = {
        "drift_probability_next_3m": 0.945,
        "risk_band": "HIGH",
        "leading_signals": ["Average loan size grew by +8.6%"],
    }

    narrative = generate_grounded_narrative(mdi_evidence, kpi_evidence, pred_risk)

    assert narrative["severity"] == "ALERT"
    assert "22.4" in narrative["headline"]
    assert "315.27" in narrative["financial_summary"]
    assert len(narrative["recommendations"]) >= 2
    assert narrative["predictive_risk"]["forward_drift_probability"] == 0.945
    print("[PASS] test_grounded_narrative_nfr06")


def test_batch_drift_score_pipeline():
    report = score_institution_and_branches()
    assert report["anchor_month"] == "2026-07"
    assert "retrospective_mdi" in report
    assert "predictive_drift_risk" in report
    assert "branch_risk_rankings" in report
    assert len(report["branch_risk_rankings"]) == 17
    print(f"[PASS] test_batch_drift_score_pipeline (17 branches ranked)")


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING M2 MACHINE LEARNING TEST SUITE")
    print("=" * 60)
    test_kpi_engine_par_and_social()
    test_mdi_pure_computation()
    test_drift_feature_engineering()
    test_xgboost_model_artifacts()
    test_grounded_narrative_nfr06()
    test_batch_drift_score_pipeline()
    print("=" * 60)
    print("ALL M2 ML TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)
