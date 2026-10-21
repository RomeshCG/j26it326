"""
Train Isolation Forest on synthetic volume_train.csv (v2 features).

Pipeline: RobustScaler (train-fit) → IsolationForest.
Threshold: validation-only bootstrap median (never test).

Writes:
  agents/artifacts/a3-iforest-v2.joblib
  agents/artifacts/a3-iforest-v2.meta.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from ml.features import (
        FEATURE_ALLOWLIST,
        IFOREST_CONTAMINATION,
        IFOREST_MAX_SAMPLES,
        IFOREST_N_ESTIMATORS,
        MIN_PRECISION,
        MIN_RECALL,
        MIN_VAL_POSITIVES,
        MODEL_VERSION,
        SEED_IFOREST,
        SEED_THRESHOLD_BOOTSTRAP,
        THRESHOLD_BOOTSTRAP_SAMPLES,
    )
    from ml.scoring_utils import (
        anomaly_score_from_decision,
        select_threshold_with_stability,
    )
except ImportError:
    from features import (
        FEATURE_ALLOWLIST,
        IFOREST_CONTAMINATION,
        IFOREST_MAX_SAMPLES,
        IFOREST_N_ESTIMATORS,
        MIN_PRECISION,
        MIN_RECALL,
        MIN_VAL_POSITIVES,
        MODEL_VERSION,
        SEED_IFOREST,
        SEED_THRESHOLD_BOOTSTRAP,
        THRESHOLD_BOOTSTRAP_SAMPLES,
    )
    from scoring_utils import (
        anomaly_score_from_decision,
        select_threshold_with_stability,
    )

try:
    import joblib
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import IsolationForest
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import RobustScaler
except ImportError as exc:  # pragma: no cover
    print(
        "Missing dependencies. From agents/ with venv active:\n"
        "  pip install numpy pandas scikit-learn joblib\n"
        f"Original error: {exc}",
        file=sys.stderr,
    )
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "synthetic"
ART_DIR = ROOT / "artifacts"


def _load_xy(path: Path, *, labelled: bool):
    df = pd.read_csv(path)
    missing = [c for c in FEATURE_ALLOWLIST if c not in df.columns]
    if missing:
        raise SystemExit(f"{path} missing feature columns: {missing}")
    X = df.loc[:, list(FEATURE_ALLOWLIST)].astype(float)
    if X.isna().any().any():
        raise SystemExit(f"{path} contains NaN in feature columns")
    y = df["is_anomaly"].astype(int).to_numpy() if labelled else None
    return X, y, df


def main() -> int:
    parser = argparse.ArgumentParser(description="Train A3 Isolation Forest v2")
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--artifacts-dir", type=Path, default=ART_DIR)
    args = parser.parse_args()

    train_path = args.data_dir / "volume_train.csv"
    val_path = args.data_dir / "volume_val.csv"
    if not train_path.exists() or not val_path.exists():
        print(
            "Synthetic CSVs not found. Run:\n  python -m ml.generate_synthetic_volume",
            file=sys.stderr,
        )
        return 2

    X_train, _, train_df = _load_xy(train_path, labelled=False)
    X_val, y_val, _ = _load_xy(val_path, labelled=True)
    assert y_val is not None

    if "is_anomaly" in train_df.columns and int(train_df["is_anomaly"].sum()) != 0:
        print("WARNING: train CSV contains anomalies; fitting on features only.")

    contamination = IFOREST_CONTAMINATION
    pipe = Pipeline(
        steps=[
            ("scaler", RobustScaler()),
            (
                "iforest",
                IsolationForest(
                    n_estimators=IFOREST_N_ESTIMATORS,
                    contamination=contamination,
                    max_samples=IFOREST_MAX_SAMPLES,
                    random_state=SEED_IFOREST,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    pipe.fit(X_train.to_numpy())

    # decision_function on pipeline uses scaled features
    val_decision = pipe.decision_function(X_val.to_numpy())
    val_scores = anomaly_score_from_decision(val_decision)

    try:
        threshold_info = select_threshold_with_stability(
            y_val,
            val_scores,
            min_precision=MIN_PRECISION,
            min_recall=MIN_RECALL,
            min_positives=MIN_VAL_POSITIVES,
            n_bootstrap=THRESHOLD_BOOTSTRAP_SAMPLES,
            rng_seed=SEED_THRESHOLD_BOOTSTRAP,
        )
    except ValueError as exc:
        print(f"Threshold selection failed: {exc}", file=sys.stderr)
        return 2

    args.artifacts_dir.mkdir(parents=True, exist_ok=True)
    model_path = args.artifacts_dir / f"{MODEL_VERSION}.joblib"
    meta_path = args.artifacts_dir / f"{MODEL_VERSION}.meta.json"

    joblib.dump(
        {
            "pipeline": pipe,
            "feature_allowlist": list(FEATURE_ALLOWLIST),
            "model_version": MODEL_VERSION,
        },
        model_path,
    )

    # Feature stats in raw space (for heuristic explanations later)
    feature_means = X_train.mean(axis=0).to_dict()
    feature_stds = X_train.std(axis=0).replace(0.0, 1.0).to_dict()

    meta = {
        "model_version": MODEL_VERSION,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "algorithm": "RobustScaler + sklearn.ensemble.IsolationForest",
        "feature_allowlist": list(FEATURE_ALLOWLIST),
        "train_path": str(train_path.as_posix()),
        "val_path": str(val_path.as_posix()),
        "n_train": int(len(X_train)),
        "n_val": int(len(X_val)),
        "n_val_positives": int(y_val.sum()),
        "hyperparameters": {
            "n_estimators": IFOREST_N_ESTIMATORS,
            "contamination": contamination,
            "max_samples": IFOREST_MAX_SAMPLES,
            "random_state": SEED_IFOREST,
            "scaler": "RobustScaler",
        },
        "score_semantics": {
            "decision_function": "pipeline decision; lower => more anomalous",
            "score": "1/(1+exp(decision_function)); higher => more anomalous; NOT a probability",
            "confidence": "score*100 clipped to [0,100]; display mapping only",
        },
        "threshold": threshold_info,
        "threshold_selection": {
            "dataset": "validation_only",
            "test_set_used": False,
            "min_positives_required": MIN_VAL_POSITIVES,
            "bootstrap_samples": THRESHOLD_BOOTSTRAP_SAMPLES,
            "rule": (
                "Bootstrap median of thresholds that maximize F1 under "
                f"precision>={MIN_PRECISION} and recall>={MIN_RECALL} when possible"
            ),
        },
        "train_feature_means": feature_means,
        "train_feature_stds": feature_stds,
        "limitations": [
            "Trained on controlled synthetic data only — not real MFI production traffic.",
            "Isolation Forest scores are not calibrated probabilities or fraud likelihoods.",
            "Does not reliably detect amount-only spikes (amount_spike); "
            "A3 must not be claimed to detect all financial anomalies.",
            "Validation threshold may not generalise to real deployments.",
            "v2 test set is independent of the inspected v1 test set.",
        ],
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"Wrote {model_path}")
    print(f"Wrote {meta_path}")
    stab = threshold_info["stability"]
    print(
        "Val thr={threshold:.4f} (boot med) F1={f1:.3f} P={precision:.3f} R={recall:.3f} "
        "stability_std={std:.4f} p10={p10:.4f} p90={p90:.4f}".format(
            threshold=threshold_info["threshold"],
            f1=threshold_info["f1"],
            precision=threshold_info["precision"],
            recall=threshold_info["recall"],
            std=stab["threshold_std"],
            p10=stab["threshold_p10"],
            p90=stab["threshold_p90"],
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
