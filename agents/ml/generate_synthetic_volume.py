"""
Generate synthetic microfinance branch-volume datasets (v2).

- Causal past-only rolling 7-day baselines
- Branch-heterogeneous correlated activity
- Stratified anomaly types × difficulty on val/test only
- Temporal + holdout-branch split (fresh v2 test — not the inspected v1 set)

Outputs (gitignored): agents/data/synthetic/volume_{train,val,test}.csv + manifest
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from ml.features import (
        ANOMALY_TYPES,
        DATA_VERSION,
        DIFFICULTIES,
        FEATURE_ALLOWLIST,
        META_COLUMNS,
        N_BRANCHES,
        N_DAYS,
        ROLLING_WINDOW,
        SEED_ANOMALY_INJECT,
        SEED_GENERATOR_BASE,
        TEST_ANOMALIES_PER_TYPE_DIFFICULTY,
        TEST_HOLDOUT_BRANCHES,
        TRAIN_BRANCHES,
        TRAIN_DAY_END,
        VAL_ANOMALIES_PER_TYPE_DIFFICULTY,
        VAL_DAY_END,
    )
except ImportError:
    from features import (
        ANOMALY_TYPES,
        DATA_VERSION,
        DIFFICULTIES,
        FEATURE_ALLOWLIST,
        META_COLUMNS,
        N_BRANCHES,
        N_DAYS,
        ROLLING_WINDOW,
        SEED_ANOMALY_INJECT,
        SEED_GENERATOR_BASE,
        TEST_ANOMALIES_PER_TYPE_DIFFICULTY,
        TEST_HOLDOUT_BRANCHES,
        TRAIN_BRANCHES,
        TRAIN_DAY_END,
        VAL_ANOMALIES_PER_TYPE_DIFFICULTY,
        VAL_DAY_END,
    )

try:
    import numpy as np
    import pandas as pd
except ImportError as exc:  # pragma: no cover
    print(
        "Missing dependencies. Install agents requirements first:\n"
        "  pip install numpy pandas\n"
        f"Original error: {exc}",
        file=sys.stderr,
    )
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "synthetic"


def _branch_profile(branch_id: int) -> dict[str, float]:
    base = 35.0 + 18.0 * (branch_id % 8) + 40.0 * (branch_id // 8)
    return {
        "count_mu": base,
        "amount_mu": base * (1600.0 + 140.0 * (branch_id % 5)),
        "counterparty_mu": 10.0 + 2.5 * (branch_id % 6),
        "after_hours_base": 0.07 + 0.012 * (branch_id % 4),
        "new_payee_base": 0.04 + 0.01 * (branch_id % 3),
    }


def _seasonal_factors(day: int) -> tuple[float, float, int, float]:
    weekday = day % 7
    weekday_mult = 1.18 if weekday < 5 else 0.68
    month_phase = (day % 30) / 30.0
    month_mult = 1.0 + 0.14 * np.sin(2 * np.pi * month_phase)
    return weekday_mult, month_mult, weekday, month_phase


def _raw_activity(
    rng: np.random.Generator, branch_id: int, day: int
) -> dict[str, float]:
    """Latent daily activity BEFORE anomaly injection (raw levels)."""
    prof = _branch_profile(branch_id)
    wd_m, mo_m, weekday, month_phase = _seasonal_factors(day)
    cal = wd_m * mo_m
    latent = rng.normal(0.0, 1.0)
    count = max(1.0, prof["count_mu"] * cal * (1.0 + 0.08 * latent + rng.normal(0, 0.10)))
    amount = max(
        100.0,
        prof["amount_mu"]
        * cal
        * (1.0 + 0.10 * (0.65 * latent + 0.35 * rng.normal())),
    )
    counterparties = max(
        1.0, prof["counterparty_mu"] * cal * (1.0 + 0.08 * rng.normal())
    )
    after_hours = float(
        np.clip(prof["after_hours_base"] + rng.normal(0.0, 0.018), 0.01, 0.40)
    )
    new_payee = float(
        np.clip(prof["new_payee_base"] + rng.normal(0.0, 0.012), 0.01, 0.35)
    )
    return {
        "txn_count": float(count),
        "txn_amount": float(amount),
        "unique_counterparties": float(counterparties),
        "after_hours_share": after_hours,
        "new_payee_share": new_payee,
        "weekday": weekday,
        "month_phase": float(month_phase),
        "latent": float(latent),
    }


def _inject_raw(
    raw: dict[str, float], anomaly_type: str, difficulty: str
) -> dict[str, float]:
    """Apply anomaly on raw levels. Easy >> subtle (verified by magnitude)."""
    out = dict(raw)
    easy = difficulty == "easy"

    if anomaly_type == "volume_spike":
        out["txn_count"] *= 3.2 if easy else 1.55
        out["unique_counterparties"] *= 2.0 if easy else 1.30
    elif anomaly_type == "amount_spike":
        out["txn_amount"] *= 3.5 if easy else 1.60
    elif anomaly_type == "after_hours_burst":
        out["after_hours_share"] = 0.72 if easy else 0.38
        out["txn_count"] *= 2.2 if easy else 1.35
    elif anomaly_type == "new_payee_flood":
        out["new_payee_share"] = 0.70 if easy else 0.32
        out["unique_counterparties"] *= 2.4 if easy else 1.40
        out["txn_count"] *= 1.8 if easy else 1.25
    elif anomaly_type == "combined_burst":
        out["txn_count"] *= 2.8 if easy else 1.50
        out["txn_amount"] *= 2.6 if easy else 1.45
        out["after_hours_share"] = 0.55 if easy else 0.28
        out["new_payee_share"] = 0.45 if easy else 0.22
        out["unique_counterparties"] *= 2.0 if easy else 1.30
    else:
        raise ValueError(anomaly_type)
    return out


def _rolling_features(
    history: list[dict[str, float]], today: dict[str, float]
) -> dict[str, float]:
    """
    Past-only window: history contains the previous ROLLING_WINDOW raw days
    (oldest→newest). Today is NOT included in the baseline.
    """
    if len(history) < ROLLING_WINDOW:
        raise ValueError("insufficient history for causal rolling window")
    window = history[-ROLLING_WINDOW:]
    counts = np.array([h["txn_count"] for h in window], dtype=float)
    amounts = np.array([h["txn_amount"] for h in window], dtype=float)
    cps = np.array([h["unique_counterparties"] for h in window], dtype=float)
    ah = np.array([h["after_hours_share"] for h in window], dtype=float)
    npay = np.array([h["new_payee_share"] for h in window], dtype=float)

    count_7d = float(counts.mean())
    amount_7d = float(amounts.mean())
    cp_7d = float(cps.mean())
    ah_7d = float(ah.mean())
    npay_7d = float(npay.mean())
    amount_cv = float(amounts.std() / amount_7d) if amount_7d > 1e-9 else 0.0

    # Expanding branch history for z-scores (all past days in history, not only 7)
    hist_counts = np.array([h["txn_count"] for h in history], dtype=float)
    hist_amounts = np.array([h["txn_amount"] for h in history], dtype=float)
    c_mu, c_sd = float(hist_counts.mean()), float(hist_counts.std())
    a_mu, a_sd = float(hist_amounts.mean()), float(hist_amounts.std())
    c_sd = c_sd if c_sd > 1e-9 else 1.0
    a_sd = a_sd if a_sd > 1e-9 else 1.0

    return {
        "spike_ratio_count": float(today["txn_count"] / max(count_7d, 1e-9)),
        "spike_ratio_amount": float(today["txn_amount"] / max(amount_7d, 1e-9)),
        "counterparty_spike_ratio": float(
            today["unique_counterparties"] / max(cp_7d, 1e-9)
        ),
        "after_hours_share_1d": float(today["after_hours_share"]),
        "after_hours_delta_vs_7d": float(today["after_hours_share"] - ah_7d),
        "new_payee_share_1d": float(today["new_payee_share"]),
        "new_payee_delta_vs_7d": float(today["new_payee_share"] - npay_7d),
        "amount_cv_7d": float(np.clip(amount_cv, 0.0, 2.0)),
        "count_z_vs_branch_hist": float((today["txn_count"] - c_mu) / c_sd),
        "amount_z_vs_branch_hist": float((today["txn_amount"] - a_mu) / a_sd),
    }


def _assign_split(branch_id: int, day: int) -> str | None:
    if day < ROLLING_WINDOW:
        return None
    if branch_id in TEST_HOLDOUT_BRANCHES:
        return "test" if day >= TRAIN_DAY_END else None
    if day < TRAIN_DAY_END:
        return "train"
    if day < VAL_DAY_END:
        return "val"
    return "test"


def _eligible_cells(split: str) -> list[tuple[int, int]]:
    cells = []
    for b in range(N_BRANCHES):
        for d in range(N_DAYS):
            if _assign_split(b, d) == split:
                cells.append((b, d))
    return cells


def _place_stratified_anomalies(
    inject_rng: np.random.Generator,
    split: str,
    per_type_difficulty: int,
) -> dict[tuple[int, int], tuple[str, str]]:
    """Map (branch_id, day) -> (anomaly_type, difficulty) with stratification."""
    cells = _eligible_cells(split)
    inject_rng.shuffle(cells)
    need = len(ANOMALY_TYPES) * len(DIFFICULTIES) * per_type_difficulty
    if len(cells) < need:
        raise RuntimeError(
            f"Not enough {split} cells ({len(cells)}) for {need} stratified anomalies"
        )
    placement: dict[tuple[int, int], tuple[str, str]] = {}
    idx = 0
    for atype in ANOMALY_TYPES:
        for diff in DIFFICULTIES:
            for _ in range(per_type_difficulty):
                placement[cells[idx]] = (atype, diff)
                idx += 1
    return placement


def build_frames() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict]:
    base_rng = np.random.default_rng(SEED_GENERATOR_BASE)
    inject_rng = np.random.default_rng(SEED_ANOMALY_INJECT)

    val_place = _place_stratified_anomalies(
        inject_rng, "val", VAL_ANOMALIES_PER_TYPE_DIFFICULTY
    )
    test_place = _place_stratified_anomalies(
        inject_rng, "test", TEST_ANOMALIES_PER_TYPE_DIFFICULTY
    )

    # Generate full raw series per branch first (normal process)
    raw_series: dict[int, list[dict[str, float]]] = {
        b: [] for b in range(N_BRANCHES)
    }
    for b in range(N_BRANCHES):
        for d in range(N_DAYS):
            raw_series[b].append(_raw_activity(base_rng, b, d))

    # Apply injections on copies of raw days (after series generation so
    # rolling baselines for surrounding days stay based on pre-inject history
    # for the anomaly day we replace today's raw only).
    injected_raw: dict[tuple[int, int], dict[str, float]] = {}
    for (b, d), (atype, diff) in {**val_place, **test_place}.items():
        injected_raw[(b, d)] = _inject_raw(raw_series[b][d], atype, diff)

    rows: list[dict] = []
    row_id = 0
    for b in range(N_BRANCHES):
        history: list[dict[str, float]] = []
        for d in range(N_DAYS):
            # History uses non-injected raw for past days (anomalies don't
            # poison future baselines unrealistically beyond the event day).
            # For the event day itself, features use injected today + clean past.
            baseline_today = raw_series[b][d]
            split = _assign_split(b, d)

            if d >= ROLLING_WINDOW and split is not None:
                today = injected_raw.get((b, d), baseline_today)
                feats = _rolling_features(history, today)
                is_anom = 1 if (b, d) in injected_raw else 0
                atype, diff = ("", "")
                if is_anom:
                    atype, diff = {**val_place, **test_place}[(b, d)]
                rec = {
                    "row_id": row_id,
                    "branch_id": b,
                    "day_index": d,
                    "weekday": int(baseline_today["weekday"]),
                    "month_phase": round(float(baseline_today["month_phase"]), 4),
                    "split": split,
                    "is_anomaly": is_anom,
                    "anomaly_type": atype,
                    "difficulty": diff,
                    "data_source": "synthetic",
                    "data_version": DATA_VERSION,
                }
                for col in FEATURE_ALLOWLIST:
                    rec[col] = feats[col]
                rows.append(rec)
                row_id += 1

            # Append CLEAN raw to history (past-only for next days)
            history.append(baseline_today)

    df = pd.DataFrame(rows)
    train_df = df[df["split"] == "train"].copy()
    val_df = df[df["split"] == "val"].copy()
    test_df = df[df["split"] == "test"].copy()

    assert int(train_df["is_anomaly"].sum()) == 0
    assert int(val_df["is_anomaly"].sum()) == len(val_place)
    assert int(test_df["is_anomaly"].sum()) == len(test_place)
    assert set(train_df["branch_id"].unique()).isdisjoint(set(TEST_HOLDOUT_BRANCHES))

    # Difficulty sanity: easy should exceed subtle on at least one spike feature (val+test anoms)
    anoms = df[df["is_anomaly"] == 1]
    easy_m = anoms[anoms["difficulty"] == "easy"]["spike_ratio_count"].median()
    subtle_m = anoms[anoms["difficulty"] == "subtle"]["spike_ratio_count"].median()
    if not (easy_m > subtle_m):
        print(
            f"WARNING: easy median spike_ratio_count ({easy_m:.3f}) "
            f"<= subtle ({subtle_m:.3f})",
            file=sys.stderr,
        )

    manifest = {
        "data_version": DATA_VERSION,
        "feature_allowlist": list(FEATURE_ALLOWLIST),
        "meta_columns": list(META_COLUMNS),
        "seeds": {
            "generator_base": SEED_GENERATOR_BASE,
            "anomaly_inject": SEED_ANOMALY_INJECT,
        },
        "rolling_window": ROLLING_WINDOW,
        "split": {
            "scheme": "temporal_plus_branch_holdout_v2",
            "n_days": N_DAYS,
            "warmup_days": f"[0, {ROLLING_WINDOW})",
            "train_days": f"[{ROLLING_WINDOW}, {TRAIN_DAY_END})",
            "val_days": f"[{TRAIN_DAY_END}, {VAL_DAY_END})",
            "test_days_seen_branches": f"[{VAL_DAY_END}, {N_DAYS})",
            "test_days_holdout_branches": f"[{TRAIN_DAY_END}, {N_DAYS})",
            "train_branches": list(TRAIN_BRANCHES),
            "test_holdout_branches": list(TEST_HOLDOUT_BRANCHES),
            "train_anomalies": False,
            "independent_of_v1_test": True,
            "notes": (
                "v2 uses causal rolling baselines and stratified anomalies. "
                "Holdout branches never appear in train. Previous v1 test set "
                "must not be reused for tuning."
            ),
        },
        "counts": {
            "train": int(len(train_df)),
            "val": int(len(val_df)),
            "test": int(len(test_df)),
            "val_anomalies": int(val_df["is_anomaly"].sum()),
            "test_anomalies": int(test_df["is_anomaly"].sum()),
        },
        "stratification": {
            "val_per_type_difficulty": VAL_ANOMALIES_PER_TYPE_DIFFICULTY,
            "test_per_type_difficulty": TEST_ANOMALIES_PER_TYPE_DIFFICULTY,
            "anomaly_types": list(ANOMALY_TYPES),
            "difficulties": list(DIFFICULTIES),
        },
        "feature_design": {
            "priority": "branch_relative_and_scale_invariant",
            "causal_rolling": True,
            "raw_absolute_levels_in_model": False,
        },
    }
    return train_df, val_df, test_df, manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate A3 synthetic volume datasets v2")
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()
    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    train_df, val_df, test_df, manifest = build_frames()
    train_df.to_csv(out_dir / "volume_train.csv", index=False)
    val_df.to_csv(out_dir / "volume_val.csv", index=False)
    test_df.to_csv(out_dir / "volume_test.csv", index=False)
    (out_dir / "volume_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )

    print(
        f"train={len(train_df)} val={len(val_df)} "
        f"(anom={int(val_df['is_anomaly'].sum())}) "
        f"test={len(test_df)} (anom={int(test_df['is_anomaly'].sum())})"
    )
    print(f"Wrote datasets to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
