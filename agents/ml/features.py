"""
Strict feature allowlist and shared constants for A3 Isolation Forest (v2).

Stdlib-only module — safe to import without scikit-learn installed.

v2 prioritises scale-invariant / branch-relative features and causal rolling
baselines (see ml/README.md). Previous v1 absolute-scale features are retired.
"""

from __future__ import annotations

# Frozen contract between generator, trainer, evaluator, and (later) scorer.
FEATURE_ALLOWLIST: tuple[str, ...] = (
    "spike_ratio_count",
    "spike_ratio_amount",
    "counterparty_spike_ratio",
    "after_hours_share_1d",
    "after_hours_delta_vs_7d",
    "new_payee_share_1d",
    "new_payee_delta_vs_7d",
    "amount_cv_7d",
    "count_z_vs_branch_hist",
    "amount_z_vs_branch_hist",
)

MODEL_VERSION = "a3-iforest-v2"
DATA_VERSION = "synthetic-volume-v2"

# Fixed seeds (separate roles — do not reuse across concerns).
SEED_GENERATOR_BASE = 20261016
SEED_ANOMALY_INJECT = 71002
SEED_IFOREST = 71003
SEED_THRESHOLD_BOOTSTRAP = 71005

# Isolation Forest defaults
IFOREST_N_ESTIMATORS = 300
IFOREST_CONTAMINATION = "auto"  # handled in train; sklearn accepts 'auto'
IFOREST_MAX_SAMPLES = 256

ANOMALY_TYPES: tuple[str, ...] = (
    "volume_spike",
    "amount_spike",
    "after_hours_burst",
    "new_payee_flood",
    "combined_burst",
)

DIFFICULTIES: tuple[str, ...] = ("easy", "subtle")

# Split design (temporal + branch holdout) — see ml/README.md
N_BRANCHES = 16
TRAIN_BRANCHES: tuple[int, ...] = tuple(range(0, 12))  # 0..11
TEST_HOLDOUT_BRANCHES: tuple[int, ...] = tuple(range(12, 16))  # 12..15
N_DAYS = 250
ROLLING_WINDOW = 7
# Emit rows only for day >= ROLLING_WINDOW (need past-only history)
TRAIN_DAY_END = 180  # train days [ROLLING_WINDOW, TRAIN_DAY_END)
VAL_DAY_END = 210  # val [TRAIN_DAY_END, VAL_DAY_END)
# test calendar days [VAL_DAY_END, N_DAYS) on train branches;
# holdout branches emit [TRAIN_DAY_END, N_DAYS) as test-only

# Stratified anomaly targets (labelled val/test only)
VAL_ANOMALIES_PER_TYPE_DIFFICULTY = 4  # 5 types × 2 difficulties × 4 = 40
TEST_ANOMALIES_PER_TYPE_DIFFICULTY = 4  # 40 on test calendar + holdout pool

# Threshold selection guards
MIN_VAL_POSITIVES = 30
MIN_PRECISION = 0.40
MIN_RECALL = 0.30
THRESHOLD_BOOTSTRAP_SAMPLES = 40

META_COLUMNS: tuple[str, ...] = (
    "row_id",
    "branch_id",
    "day_index",
    "weekday",
    "month_phase",
    "split",
    "is_anomaly",
    "anomaly_type",
    "difficulty",
    "data_source",
    "data_version",
)
