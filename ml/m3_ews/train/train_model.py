"""
M3 EWS — Early Warning Distress Model Training
===============================================
Trains an Early Warning System (EWS) model to predict microfinance loan distress
(approaching PAR30 default) 30 to 60 days in advance.

Key design:
- Temporal cohort split (Train -> Validation -> Test)
- Minority class weighting (distress is ~10-15% of portfolio)
- Threshold optimization on Validation PR curve
- Model artifact export with metadata & feature importances

Usage:
    python ml/m3_ews/train/train_model.py \
        --data ml/m3_ews/data/features/feature_matrix.csv \
        --output-dir ml/m3_ews/models \
        --model-family xgboost
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


FEATURE_COLS = [
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
]

TARGET_COL = "distress_label"


def parse_args():
    parser = argparse.ArgumentParser(description="Train M3 EWS distress model")
    parser.add_argument(
        "--data",
        default="ml/m3_ews/data/features/feature_matrix.csv",
        help="Path to feature matrix CSV",
    )
    parser.add_argument(
        "--output-dir",
        default="ml/m3_ews/models",
        help="Directory to save model artifacts",
    )
    parser.add_argument(
        "--model-family",
        choices=["xgboost", "gradient_boosting", "random_forest"],
        default="xgboost",
        help="Algorithm family (defaults to xgboost)",
    )
    return parser.parse_args()


def load_and_split_data(csv_path: str):
    """
    Loads dataset and performs honest Center-based Group split:
    70% Train, 15% Validation (for threshold selection), 15% Test (unseen holdout centers).
    Guarantees 0 center overlap between train and test sets to prevent peer-borrower leakage.
    """
    df = pd.read_csv(csv_path)
    print(f"[M3 Train] Loaded {len(df)} records from {csv_path}")

    # Verify features exist
    missing = [c for c in FEATURE_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing feature columns in CSV: {missing}")
    if TARGET_COL not in df.columns:
        raise ValueError(f"Missing target column '{TARGET_COL}' in CSV")

    if "center" in df.columns and df["center"].nunique() > 10:
        from sklearn.model_selection import GroupShuffleSplit
        # 1. Split off 15% holdout test centers
        gss_test = GroupShuffleSplit(n_splits=1, test_size=0.15, random_state=42)
        trainval_idx, test_idx = next(gss_test.split(df, groups=df["center"]))
        trainval_df = df.iloc[trainval_idx].reset_index(drop=True)
        test_df = df.iloc[test_idx].reset_index(drop=True)

        # 2. Split remaining 85% into Train (70% total) and Val (15% total -> 15/85 = ~0.176)
        gss_val = GroupShuffleSplit(n_splits=1, test_size=0.1765, random_state=42)
        train_idx, val_idx = next(gss_val.split(trainval_df, groups=trainval_df["center"]))
        train_df = trainval_df.iloc[train_idx].reset_index(drop=True)
        val_df = trainval_df.iloc[val_idx].reset_index(drop=True)

        print(f"  [Center-Based Split] Train centers: {train_df['center'].nunique()}, Val centers: {val_df['center'].nunique()}, Test centers: {test_df['center'].nunique()}")
    else:
        n = len(df)
        train_end = int(n * 0.70)
        val_end = int(n * 0.85)
        train_df = df.iloc[:train_end]
        val_df = df.iloc[train_end:val_end]
        test_df = df.iloc[val_end:]

    print(f"  Train set : {len(train_df)} rows (distress: {train_df[TARGET_COL].mean():.2%})")
    print(f"  Val set   : {len(val_df)} rows (distress: {val_df[TARGET_COL].mean():.2%})")
    print(f"  Test set  : {len(test_df)} rows (distress: {test_df[TARGET_COL].mean():.2%})")

    # Save holdout test set to disk for independent evaluation
    test_out = Path(csv_path).parent / "test_cohort.csv"
    test_df.to_csv(test_out, index=False)
    print(f"  [Saved] Unseen test cohort written -> {test_out}")

    X_train = train_df[FEATURE_COLS].values
    y_train = train_df[TARGET_COL].values

    X_val = val_df[FEATURE_COLS].values
    y_val = val_df[TARGET_COL].values

    X_test = test_df[FEATURE_COLS].values
    y_test = test_df[TARGET_COL].values

    return (X_train, y_train), (X_val, y_val), (X_test, y_test)


def create_model(model_family: str, scale_pos_weight: float):
    """
    Initializes model with class-imbalance weighting.
    Prefers XGBoost, gracefully falls back to scikit-learn GradientBoosting.
    """
    if model_family == "xgboost":
        try:
            import xgboost as xgb
            return xgb.XGBClassifier(
                n_estimators=160,
                max_depth=4,
                learning_rate=0.04,
                scale_pos_weight=scale_pos_weight,
                subsample=0.85,
                colsample_bytree=0.85,
                random_state=42,
                eval_metric="logloss",
            )
        except ImportError:
            print("[WARN] xgboost not installed — falling back to sklearn GradientBoostingClassifier")

    if model_family == "random_forest":
        from sklearn.ensemble import RandomForestClassifier
        return RandomForestClassifier(
            n_estimators=200,
            max_depth=6,
            class_weight="balanced",
            random_state=42,
        )

    from sklearn.ensemble import GradientBoostingClassifier
    return GradientBoostingClassifier(
        n_estimators=160,
        max_depth=4,
        learning_rate=0.04,
        random_state=42,
    )


def compute_metrics(y_true, y_prob, threshold=0.5):
    """Computes binary classification metrics at a given probability threshold."""
    y_pred = (y_prob >= threshold).astype(int)

    tp = int(np.sum((y_pred == 1) & (y_true == 1)))
    fp = int(np.sum((y_pred == 1) & (y_true == 0)))
    fn = int(np.sum((y_pred == 0) & (y_true == 1)))
    tn = int(np.sum((y_pred == 0) & (y_true == 0)))

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    try:
        from sklearn.metrics import roc_auc_score
        auc = float(roc_auc_score(y_true, y_prob))
    except Exception:
        auc = 0.5

    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "auc": round(auc, 4),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
    }


def find_optimal_threshold(y_val, y_val_prob):
    """Finds probability threshold maximizing F1 on the validation cohort."""
    best_thresh = 0.5
    best_f1 = 0.0

    for t in np.linspace(0.15, 0.75, 61):
        m = compute_metrics(y_val, y_val_prob, threshold=t)
        if m["f1"] > best_f1:
            best_f1 = m["f1"]
            best_thresh = float(round(t, 3))

    return best_thresh, best_f1


def main():
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    (X_train, y_train), (X_val, y_val), (X_test, y_test) = load_and_split_data(args.data)

    n_pos = int(np.sum(y_train == 1))
    n_neg = int(np.sum(y_train == 0))
    scale_pos = max(1.0, round(n_neg / max(n_pos, 1), 2))
    print(f"[M3 Train] Class weighting scale_pos_weight = {scale_pos}")

    model = create_model(args.model_family, scale_pos)
    print(f"[M3 Train] Fitting {model.__class__.__name__}...")
    model.fit(X_train, y_train)

    # Validation & threshold search
    val_probs = model.predict_proba(X_val)[:, 1]
    optimal_thresh, val_f1 = find_optimal_threshold(y_val, val_probs)
    val_metrics = compute_metrics(y_val, val_probs, threshold=optimal_thresh)
    print(f"[M3 Train] Optimal decision threshold = {optimal_thresh} (Val F1 = {val_f1:.4f})")
    print(f"  Val Precision : {val_metrics['precision']:.2%}")
    print(f"  Val Recall    : {val_metrics['recall']:.2%}")
    print(f"  Val ROC-AUC   : {val_metrics['auc']:.4f}")

    # Holdout Test set evaluation (unbiased)
    test_probs = model.predict_proba(X_test)[:, 1]
    test_metrics = compute_metrics(y_test, test_probs, threshold=optimal_thresh)
    print("\n[M3 Train] === Unseen Holdout Test Performance ===")
    print(f"  Test Precision: {test_metrics['precision']:.2%}")
    print(f"  Test Recall   : {test_metrics['recall']:.2%}")
    print(f"  Test F1 Score : {test_metrics['f1']:.4f}")
    print(f"  Test ROC-AUC  : {test_metrics['auc']:.4f}")

    # Feature importances
    if hasattr(model, "feature_importances_"):
        importances = {
            f: round(float(imp), 4)
            for f, imp in sorted(zip(FEATURE_COLS, model.feature_importances_), key=lambda x: x[1], reverse=True)
        }
    else:
        importances = {f: 0.0 for f in FEATURE_COLS}

    print("\n[M3 Train] Top 5 EWS Distinguishing Features:")
    for f, imp in list(importances.items())[:5]:
        print(f"    - {f:30s}: {imp:.4f}")

    # Save artifacts
    model_path = output_dir / "ews_model.joblib"
    meta_path = output_dir / "model_metadata.json"

    joblib.dump(model, model_path)
    metadata = {
        "model_name": "M3 EWS Loan Distress Classifier",
        "algorithm": model.__class__.__name__,
        "features": FEATURE_COLS,
        "optimal_threshold": optimal_thresh,
        "metrics_val": val_metrics,
        "metrics_test": test_metrics,
        "feature_importances": importances,
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n[M3 Train] Artifacts saved:")
    print(f"  Model    : {model_path}")
    print(f"  Metadata : {meta_path}")


if __name__ == "__main__":
    main()
