"""
Shared score mapping and validation-only threshold selection (v2).

decision_function values are NOT probabilities.
"""

from __future__ import annotations

from typing import Iterable

import numpy as np


def anomaly_score_from_decision(decision: np.ndarray | float) -> np.ndarray:
    """
    Map IsolationForest.decision_function → score in (0, 1).

    sklearn: lower decision => more anomalous.
    score = 1/(1+exp(decision)) so lower decision => higher score.
    """
    d = np.asarray(decision, dtype=float)
    return 1.0 / (1.0 + np.exp(d))


def confidence_from_score(score: np.ndarray | float) -> np.ndarray:
    """Display confidence in [0, 100] — not a calibrated probability."""
    s = np.asarray(score, dtype=float)
    return np.clip(s * 100.0, 0.0, 100.0)


def _metrics_at_threshold(y: np.ndarray, s: np.ndarray, thr: float) -> dict:
    pred = (s >= thr).astype(int)
    tp = int(((pred == 1) & (y == 1)).sum())
    fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())
    tn = int(((pred == 0) & (y == 0)).sum())
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (
        (2 * precision * recall / (precision + recall))
        if (precision + recall)
        else 0.0
    )
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    return {
        "threshold": float(thr),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "false_positive_rate": float(fpr),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
    }


def _candidate_thresholds(scores: np.ndarray) -> np.ndarray:
    """Quantile grid + unique anomaly-relevant scores (avoid single-point knife edges)."""
    qs = np.linspace(0.05, 0.995, 80)
    cands = list(np.quantile(scores, qs))
    # Midpoints between sorted unique scores reduce exact-singleton thresholds
    uniq = np.unique(scores)
    if uniq.size >= 2:
        mids = 0.5 * (uniq[:-1] + uniq[1:])
        cands.extend(mids.tolist())
    cands.extend([float(uniq.min()), float(uniq.max())] if uniq.size else [])
    return np.unique(np.asarray(cands, dtype=float))


def select_threshold_once(
    y_true: np.ndarray,
    scores: np.ndarray,
    *,
    min_precision: float,
    min_recall: float,
) -> dict:
    """
    Pick operating point on one labelled set.

    Prefer max F1 among thresholds with precision>=min_precision AND
    recall>=min_recall. Else max F1 with precision floor only. Else max F1.
    """
    y = np.asarray(y_true, dtype=int)
    s = np.asarray(scores, dtype=float)
    candidates = _candidate_thresholds(s)

    dual_ok = []
    prec_ok = []
    any_ok = []
    for thr in candidates:
        m = _metrics_at_threshold(y, s, float(thr))
        any_ok.append(m)
        if m["precision"] >= min_precision:
            prec_ok.append(m)
            if m["recall"] >= min_recall:
                dual_ok.append(m)

    def best_f1(rows: list[dict]) -> dict:
        return max(rows, key=lambda r: (r["f1"], r["recall"], -r["threshold"]))

    if dual_ok:
        chosen = best_f1(dual_ok)
        chosen["strategy"] = "max_f1_prec_and_recall_floors"
    elif prec_ok:
        chosen = best_f1(prec_ok)
        chosen["strategy"] = "max_f1_precision_floor_only"
    else:
        chosen = best_f1(any_ok)
        chosen["strategy"] = "fallback_max_f1"
    chosen["min_precision_target"] = min_precision
    chosen["min_recall_target"] = min_recall
    return chosen


def select_threshold_with_stability(
    y_true: Iterable[int],
    scores: Iterable[float],
    *,
    min_precision: float = 0.40,
    min_recall: float = 0.30,
    min_positives: int = 30,
    n_bootstrap: int = 40,
    rng_seed: int = 71005,
) -> dict:
    """
    Validation-only threshold with bootstrap stability reporting.

    Final threshold = median of bootstrap thresholds (more stable than a
    single-point score). Does not look at the test set.
    """
    y = np.asarray(list(y_true), dtype=int)
    s = np.asarray(list(scores), dtype=float)
    n_pos = int(y.sum())
    if n_pos < min_positives:
        raise ValueError(
            f"Validation positives ({n_pos}) < min_positives ({min_positives}); "
            "refusing unstable threshold selection"
        )

    full = select_threshold_once(
        y, s, min_precision=min_precision, min_recall=min_recall
    )

    rng = np.random.default_rng(rng_seed)
    boot_thrs = []
    boot_f1 = []
    n = y.size
    for _ in range(n_bootstrap):
        idx = rng.integers(0, n, size=n)
        # Ensure bootstrap draw has both classes when possible
        if y[idx].sum() == 0 or y[idx].sum() == n:
            continue
        m = select_threshold_once(
            y[idx], s[idx], min_precision=min_precision, min_recall=min_recall
        )
        boot_thrs.append(m["threshold"])
        boot_f1.append(m["f1"])

    if not boot_thrs:
        raise ValueError("Bootstrap threshold selection failed (no valid resamples)")

    boot_thrs_a = np.asarray(boot_thrs, dtype=float)
    thr = float(np.median(boot_thrs_a))
    # Evaluate the frozen median threshold on the full validation set
    at_median = _metrics_at_threshold(y, s, thr)
    at_median["strategy"] = "bootstrap_median_threshold"
    at_median["min_precision_target"] = min_precision
    at_median["min_recall_target"] = min_recall

    return {
        **at_median,
        "full_sample_selection": full,
        "stability": {
            "n_bootstrap_used": int(len(boot_thrs)),
            "n_bootstrap_requested": n_bootstrap,
            "threshold_median": thr,
            "threshold_mean": float(boot_thrs_a.mean()),
            "threshold_std": float(boot_thrs_a.std()),
            "threshold_p10": float(np.percentile(boot_thrs_a, 10)),
            "threshold_p90": float(np.percentile(boot_thrs_a, 90)),
            "f1_mean": float(np.mean(boot_f1)),
            "f1_std": float(np.std(boot_f1)),
        },
        "n_validation": int(n),
        "n_positives": n_pos,
    }
