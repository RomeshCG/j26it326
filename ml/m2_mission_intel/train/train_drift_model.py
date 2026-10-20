"""Train Predictive Mission Drift Model (XGBoost).

Predicts forward Mission Drift risk (probability of MDI >= 20.0 in upcoming periods)
and forecasts continuous forward MDI score from leading operational and demographic indicators.

Artifacts saved:
- artifacts/drift_xgb_classifier.joblib
- artifacts/drift_xgb_regressor.joblib
- artifacts/drift_model_metadata.json
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from xgboost import XGBClassifier, XGBRegressor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.drift_features import (  # noqa: E402
    FEATURE_COLUMNS,
    TARGET_BINARY,
    TARGET_CONTINUOUS,
    generate_branch_scenario_dataset,
)

DATA_PROC = ROOT / "data" / "processed"
ARTIFACTS_DIR = ROOT / "artifacts"


def train_drift_models(
    df: pd.DataFrame,
    artifacts_dir: Path = ARTIFACTS_DIR,
    random_seed: int = 42,
) -> dict:
    """Trains and evaluates both classifier and regressor models."""
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    X = df[FEATURE_COLUMNS]
    y_bin = df[TARGET_BINARY]
    y_cont = df[TARGET_CONTINUOUS]

    print(f"[M2 ML] Dataset shape: {df.shape}")
    print(f"[M2 ML] Target distribution (Drift events): {y_bin.value_counts().to_dict()} ({y_bin.mean():.1%} positive)")

    # Stratified split for classifier
    X_train, X_test, y_bin_train, y_bin_test, y_cont_train, y_cont_test = train_test_split(
        X, y_bin, y_cont, test_size=0.25, random_state=random_seed, stratify=y_bin
    )

    # 1. XGBoost Classifier (Probability of Drift Alert)
    pos_weight = float((len(y_bin_train) - y_bin_train.sum()) / max(1, y_bin_train.sum()))
    clf = XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=pos_weight,
        random_state=random_seed,
        eval_metric="logloss",
    )
    clf.fit(X_train, y_bin_train)

    y_bin_pred = clf.predict(X_test)
    y_bin_proba = clf.predict_proba(X_test)[:, 1]

    clf_auc = float(roc_auc_score(y_bin_test, y_bin_proba))
    clf_acc = float(accuracy_score(y_bin_test, y_bin_pred))
    clf_prec = float(precision_score(y_bin_test, y_bin_pred, zero_division=0))
    clf_rec = float(recall_score(y_bin_test, y_bin_pred, zero_division=0))
    clf_f1 = float(f1_score(y_bin_test, y_bin_pred, zero_division=0))

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=random_seed)
    cv_scores = cross_val_score(clf, X, y_bin, cv=cv, scoring="roc_auc")

    # 2. XGBoost Regressor (Continuous Forward MDI Score)
    reg = XGBRegressor(
        n_estimators=120,
        max_depth=4,
        learning_rate=0.06,
        subsample=0.85,
        colsample_bytree=0.85,
        objective="reg:squarederror",
        random_state=random_seed,
    )
    reg.fit(X_train, y_cont_train)

    y_cont_pred = reg.predict(X_test)
    reg_mae = float(mean_absolute_error(y_cont_test, y_cont_pred))
    reg_r2 = float(r2_score(y_cont_test, y_cont_pred))

    # Feature importances
    importances = clf.feature_importances_
    feat_imp = [
        {"feature": name, "importance": round(float(imp), 4)}
        for name, imp in sorted(zip(FEATURE_COLUMNS, importances), key=lambda x: x[1], reverse=True)
    ]

    # Save artifacts
    clf_path = artifacts_dir / "drift_xgb_classifier.joblib"
    reg_path = artifacts_dir / "drift_xgb_regressor.joblib"
    meta_path = artifacts_dir / "drift_model_metadata.json"

    joblib.dump(clf, clf_path)
    joblib.dump(reg, reg_path)

    metadata = {
        "model_name": "M2 Mission Drift Early Warning Predictor",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "n_samples": int(len(df)),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "features": FEATURE_COLUMNS,
        "classifier_metrics": {
            "roc_auc": round(clf_auc, 4),
            "accuracy": round(clf_acc, 4),
            "precision": round(clf_prec, 4),
            "recall": round(clf_rec, 4),
            "f1": round(clf_f1, 4),
            "cv_roc_auc_mean": round(float(np.mean(cv_scores)), 4),
            "cv_roc_auc_std": round(float(np.std(cv_scores)), 4),
        },
        "regressor_metrics": {
            "mae": round(reg_mae, 4),
            "r2": round(reg_r2, 4),
        },
        "feature_importances": feat_imp,
    }

    meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"\n[M2 ML] Classifier ROC-AUC: {clf_auc:.4f} (CV Mean: {np.mean(cv_scores):.4f} +/- {np.std(cv_scores):.4f})")
    print(f"[M2 ML] Classifier F1: {clf_f1:.4f}, Precision: {clf_prec:.4f}, Recall: {clf_rec:.4f}")
    print(f"[M2 ML] Regressor MAE: {reg_mae:.4f}, R2: {reg_r2:.4f}")
    print("\n[M2 ML] Top 5 Leading Drivers of Forward Mission Drift:")
    for item in feat_imp[:5]:
        print(f"  - {item['feature']}: {item['importance']:.2%}")
    print(f"\nSaved models to:\n  {clf_path}\n  {reg_path}\n  {meta_path}")

    return metadata


def main():
    parser = argparse.ArgumentParser(description="Train M2 Mission Drift XGBoost models")
    parser.add_argument("--scenarios", type=int, default=50, help="Number of simulated branch-month scenarios")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    borrowers_file = DATA_PROC / "borrowers_m2.csv"
    kpi_file = DATA_PROC / "kpi_monthly.csv"
    soc_file = DATA_PROC / "social_monthly.csv"

    if not borrowers_file.exists():
        raise SystemExit(f"Missing borrowers data: {borrowers_file}\nRun make_m2_synthetic.py first.")

    borrowers_df = pd.read_csv(borrowers_file)
    kpi_df = pd.read_csv(kpi_file)
    soc_df = pd.read_csv(soc_file)

    print("[M2 ML] Generating multi-branch scenario matrix...")
    dataset = generate_branch_scenario_dataset(
        borrowers_df, kpi_df, soc_df, n_scenarios=args.scenarios, random_seed=args.seed
    )

    dataset.to_csv(DATA_PROC / "drift_training_matrix.csv", index=False)
    print(f"[M2 ML] Saved feature matrix to {DATA_PROC / 'drift_training_matrix.csv'}")

    train_drift_models(dataset, random_seed=args.seed)


if __name__ == "__main__":
    main()
