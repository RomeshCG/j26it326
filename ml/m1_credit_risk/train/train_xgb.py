"""Train the M1 overdue model on real PAR data (target: age > 1 period).

Reports grouped (by center) cross-validation against baselines, then fits the
final XGBoost pipeline on all rows. Outputs are local only (artifacts/ is gitignored).

Usage (from ml/):
  python m1_credit_risk/train/train_xgb.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.schema import (  # noqa: E402
    LEAKY_COLUMNS,
    OVERDUE_TARGET,
    V2_CATEGORICAL,
    V2_FEATURES,
    V2_NUMERIC,
    add_overdue_label,
    add_v2_features,
)

DATA_DEFAULT = ROOT / "data" / "private" / "par30_clean_no_pii.csv"
MODEL_DIR = ROOT / "artifacts"
MODEL_PATH = MODEL_DIR / "overdue_xgb.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"


def build_pipeline(kind: str = "xgb") -> Pipeline:
    assert not set(V2_FEATURES) & LEAKY_COLUMNS, "leaky column in feature list"
    pre = ColumnTransformer(
        [
            ("num", StandardScaler() if kind == "lr" else "passthrough", V2_NUMERIC),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), V2_CATEGORICAL),
        ]
    )
    if kind == "lr":
        clf = LogisticRegression(max_iter=2000)
    elif kind == "dummy":
        clf = DummyClassifier(strategy="prior")
    else:
        clf = XGBClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.05,
            subsample=0.9, colsample_bytree=0.9, random_state=42, n_jobs=4,
        )
    return Pipeline([("pre", pre), ("model", clf)])


def cross_validate(x: pd.DataFrame, y: pd.Series, groups: pd.Series, kind: str) -> dict:
    auc, ap, brier = [], [], []
    for tr, te in GroupKFold(5).split(x, y, groups):
        p = build_pipeline(kind).fit(x.iloc[tr], y.iloc[tr]).predict_proba(x.iloc[te])[:, 1]
        auc.append(roc_auc_score(y.iloc[te], p))
        ap.append(average_precision_score(y.iloc[te], p))
        brier.append(brier_score_loss(y.iloc[te], p))
    return {
        "auc_mean": float(np.mean(auc)), "auc_std": float(np.std(auc)),
        "pr_auc_mean": float(np.mean(ap)), "brier_mean": float(np.mean(brier)),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=DATA_DEFAULT)
    args = ap.parse_args()
    if not args.data.exists():
        raise SystemExit(f"Missing data: {args.data}")

    df = add_overdue_label(add_v2_features(pd.read_csv(args.data)))
    x, y, groups = df[V2_FEATURES], df[OVERDUE_TARGET], df["center"]

    metrics = {
        "n_rows": int(len(df)),
        "positive_rate": float(y.mean()),
        "cv": "GroupKFold(5) by center",
        "baseline_prior": cross_validate(x, y, groups, "dummy"),
        "logistic_regression": cross_validate(x, y, groups, "lr"),
        "xgboost": cross_validate(x, y, groups, "xgb"),
        "data": str(args.data),
    }
    final = build_pipeline("xgb").fit(x, y)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(final, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    print(f"Model -> {MODEL_PATH}")


if __name__ == "__main__":
    main()
