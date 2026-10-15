"""
Evaluate trained Isolation Forest v2 on labelled val/test splits.

Reports overall metrics, by anomaly type/difficulty, and unseen-branch behavior.
Does not retune the threshold (frozen from validation meta).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from ml.features import FEATURE_ALLOWLIST, MODEL_VERSION, TEST_HOLDOUT_BRANCHES
    from ml.scoring_utils import anomaly_score_from_decision
except ImportError:
    from features import FEATURE_ALLOWLIST, MODEL_VERSION, TEST_HOLDOUT_BRANCHES
    from scoring_utils import anomaly_score_from_decision

try:
    import joblib
    import numpy as np
    import pandas as pd
    from sklearn.metrics import (
        average_precision_score,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )
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


def _matrix(df: pd.DataFrame) -> np.ndarray:
    missing = [c for c in FEATURE_ALLOWLIST if c not in df.columns]
    if missing:
        raise SystemExit(f"Missing columns: {missing}")
    return df.loc[:, list(FEATURE_ALLOWLIST)].astype(float).to_numpy()


def _subset_metrics(y_true: np.ndarray, y_pred: np.ndarray, scores: np.ndarray) -> dict:
    if y_true.size == 0:
        return {"n": 0}
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    out = {
        "n": int(y_true.size),
        "n_positive": int(y_true.sum()),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "false_positive_rate": float(fpr),
        "tp": int(tp),
        "fp": int(fp),
        "tn": int(tn),
        "fn": int(fn),
    }
    if y_true.min() != y_true.max():
        out["pr_auc"] = float(average_precision_score(y_true, scores))
        out["roc_auc"] = float(roc_auc_score(y_true, scores))
    else:
        out["pr_auc"] = None
        out["roc_auc"] = None
    out["score_normal_mean"] = (
        float(scores[y_true == 0].mean()) if (y_true == 0).any() else None
    )
    out["score_anom_mean"] = (
        float(scores[y_true == 1].mean()) if (y_true == 1).any() else None
    )
    out["score_normal_max"] = (
        float(scores[y_true == 0].max()) if (y_true == 0).any() else None
    )
    out["score_anom_max"] = (
        float(scores[y_true == 1].max()) if (y_true == 1).any() else None
    )
    return out


def _eval_frame(name: str, df: pd.DataFrame, pipe, threshold: float) -> dict:
    X = _matrix(df)
    y = df["is_anomaly"].astype(int).to_numpy()
    decision = pipe.decision_function(X)
    scores = anomaly_score_from_decision(decision)
    pred = (scores >= threshold).astype(int)

    report: dict = {
        "split": name,
        "threshold": threshold,
        "overall": _subset_metrics(y, pred, scores),
        "by_anomaly_type": {},
        "by_difficulty": {},
        "warnings": [],
    }

    # Index-aligned arrays so type/difficulty slices stay aligned with scores
    pred_s = pd.Series(pred, index=df.index)
    scores_s = pd.Series(scores, index=df.index)
    labelled = df[df["is_anomaly"] == 1]

    for atype, sub in labelled.groupby("anomaly_type"):
        idx = sub.index
        pred_sub = pred_s.loc[idx].to_numpy()
        scores_sub = scores_s.loc[idx].to_numpy()
        report["by_anomaly_type"][str(atype)] = {
            "n": int(len(sub)),
            "recall": float(pred_sub.mean()) if len(sub) else 0.0,
            "mean_score": float(scores_sub.mean()) if len(sub) else None,
        }

    for diff, sub in labelled.groupby("difficulty"):
        idx = sub.index
        pred_sub = pred_s.loc[idx].to_numpy()
        scores_sub = scores_s.loc[idx].to_numpy()
        report["by_difficulty"][str(diff)] = {
            "n": int(len(sub)),
            "recall": float(pred_sub.mean()) if len(sub) else 0.0,
            "mean_score": float(scores_sub.mean()) if len(sub) else None,
        }

    overall = report["overall"]
    if overall.get("f1", 0) >= 0.99 and overall.get("n_positive", 0) > 5:
        report["warnings"].append(
            "Near-perfect F1 — check for overly easy anomalies or leakage."
        )
    subtle = report["by_difficulty"].get("subtle")
    easy = report["by_difficulty"].get("easy")
    if (
        subtle
        and easy
        and subtle["n"] > 0
        and easy["n"] > 0
        and subtle["recall"] > easy["recall"] + 0.05
    ):
        report["warnings"].append(
            "Subtle recall meaningfully exceeds easy recall — review difficulty design."
        )
    if (
        overall.get("score_anom_mean") is not None
        and overall.get("score_normal_mean") is not None
        and overall["score_anom_mean"] < overall["score_normal_mean"]
    ):
        report["warnings"].append(
            "Anomaly mean score < normal mean score — check score direction."
        )

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate A3 Isolation Forest v2")
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("--artifacts-dir", type=Path, default=ART_DIR)
    args = parser.parse_args()

    model_path = args.artifacts_dir / f"{MODEL_VERSION}.joblib"
    meta_path = args.artifacts_dir / f"{MODEL_VERSION}.meta.json"
    if not model_path.exists() or not meta_path.exists():
        print("Model artifacts missing. Run train_iforest.py first.", file=sys.stderr)
        return 2

    bundle = joblib.load(model_path)
    pipe = bundle.get("pipeline") or bundle.get("model")
    if pipe is None:
        raise SystemExit("Artifact missing pipeline/model")
    if list(bundle.get("feature_allowlist", [])) != list(FEATURE_ALLOWLIST):
        print("ERROR: artifact feature_allowlist mismatch vs features.py", file=sys.stderr)
        return 2

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    threshold = float(meta["threshold"]["threshold"])

    val_df = pd.read_csv(args.data_dir / "volume_val.csv")
    test_df = pd.read_csv(args.data_dir / "volume_test.csv")

    holdout = set(TEST_HOLDOUT_BRANCHES)
    test_seen = test_df[~test_df["branch_id"].isin(holdout)].copy()
    test_holdout = test_df[test_df["branch_id"].isin(holdout)].copy()

    report = {
        "model_version": MODEL_VERSION,
        "threshold_source": "validation_meta_bootstrap_median",
        "threshold": threshold,
        "threshold_stability": meta.get("threshold", {}).get("stability"),
        "feature_allowlist": list(FEATURE_ALLOWLIST),
        "evaluation_split_notes": (
            "Threshold frozen from validation bootstrap median. "
            "Test metrics are one-shot on independent v2 test data "
            "(not the inspected v1 test set). Holdout branches never in train."
        ),
        "validation": _eval_frame("val", val_df, pipe, threshold),
        "test": _eval_frame("test", test_df, pipe, threshold),
        "test_seen_branches": _eval_frame("test_seen_branches", test_seen, pipe, threshold),
        "test_holdout_branches": _eval_frame(
            "test_holdout_branches", test_holdout, pipe, threshold
        ),
    }

    out_path = args.artifacts_dir / f"{MODEL_VERSION}.evaluation.json"
    args.artifacts_dir.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")

    for label in ("validation", "test", "test_seen_branches", "test_holdout_branches"):
        o = report[label]["overall"]
        if o.get("n", 0) == 0:
            print(f"{label}: empty")
            continue
        print(
            f"{label}: n={o['n']} pos={o['n_positive']} "
            f"P={o['precision']:.3f} R={o['recall']:.3f} F1={o['f1']:.3f} "
            f"FPR={o['false_positive_rate']:.3f} PR-AUC={o.get('pr_auc')} "
            f"ROC-AUC={o.get('roc_auc')}"
        )
        for w in report[label].get("warnings", []):
            print(f"  WARNING [{label}]: {w}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
