"""Train XGBoost regressor for risk_pct; save model + metrics locally."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.schema import (  # noqa: E402
    BOOL_FEATURES,
    CATEGORICAL_FEATURES,
    FEATURE_COLUMNS,
    NUMERIC_FEATURES,
    TARGET,
    prepare_xy,
)

DATA_DEFAULT = ROOT / "data" / "synthetic" / "loan_risk_synthetic_v1.csv"
MODEL_DIR = ROOT / "artifacts"
MODEL_PATH = MODEL_DIR / "risk_xgb.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"


def build_pipeline() -> Pipeline:
    pre = ColumnTransformer(
        [
            ("num", "passthrough", NUMERIC_FEATURES + BOOL_FEATURES),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
        ]
    )
    model = XGBRegressor(
        n_estimators=120,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=4,
    )
    return Pipeline([("pre", pre), ("model", model)])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=DATA_DEFAULT)
    args = ap.parse_args()
    if not args.data.exists():
        raise SystemExit(f"Missing data: {args.data}\nRun: python scripts/generate_synthetic.py")

    df = pd.read_csv(args.data)
    missing = [c for c in FEATURE_COLUMNS + [TARGET] if c not in df.columns]
    if missing:
        raise SystemExit(f"Missing columns: {missing}")

    x, y = prepare_xy(df)
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)

    pipe = build_pipeline()
    pipe.fit(x_train, y_train)
    pred = pipe.predict(x_test)

    metrics = {
        "n_train": int(len(x_train)),
        "n_test": int(len(x_test)),
        "mae": float(mean_absolute_error(y_test, pred)),
        "r2": float(r2_score(y_test, pred)),
        "y_test_mean": float(np.mean(y_test)),
        "data": str(args.data),
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    print(f"Model -> {MODEL_PATH}")


if __name__ == "__main__":
    main()
