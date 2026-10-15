"""
Stdlib-only sanity checks for Phase A v2 constants and split rules.

Run (no extra deps):
  cd agents
  python -m ml.test_phase_a_stdlib
"""

from __future__ import annotations

import unittest

from ml.features import (
    ANOMALY_TYPES,
    DATA_VERSION,
    DIFFICULTIES,
    FEATURE_ALLOWLIST,
    MIN_VAL_POSITIVES,
    MODEL_VERSION,
    N_BRANCHES,
    N_DAYS,
    ROLLING_WINDOW,
    TEST_ANOMALIES_PER_TYPE_DIFFICULTY,
    TEST_HOLDOUT_BRANCHES,
    TRAIN_BRANCHES,
    TRAIN_DAY_END,
    VAL_ANOMALIES_PER_TYPE_DIFFICULTY,
    VAL_DAY_END,
)


def _assign_split(branch_id: int, day: int) -> str | None:
    """Mirror of generator split logic (kept in sync intentionally)."""
    if day < ROLLING_WINDOW:
        return None
    if branch_id in TEST_HOLDOUT_BRANCHES:
        return "test" if day >= TRAIN_DAY_END else None
    if day < TRAIN_DAY_END:
        return "train"
    if day < VAL_DAY_END:
        return "val"
    return "test"


class PhaseAStdlibTests(unittest.TestCase):
    def test_feature_allowlist_unique_and_sized(self) -> None:
        self.assertEqual(len(FEATURE_ALLOWLIST), len(set(FEATURE_ALLOWLIST)))
        self.assertEqual(len(FEATURE_ALLOWLIST), 10)
        self.assertTrue(all(isinstance(f, str) and f for f in FEATURE_ALLOWLIST))
        # Branch-relative / scale-invariant priority (no raw absolute txn levels)
        for forbidden in ("txn_count", "txn_amount", "unique_counterparties"):
            self.assertNotIn(forbidden, FEATURE_ALLOWLIST)

    def test_model_and_data_version(self) -> None:
        self.assertEqual(MODEL_VERSION, "a3-iforest-v2")
        self.assertEqual(DATA_VERSION, "synthetic-volume-v2")

    def test_holdout_branch_never_in_train_branches(self) -> None:
        self.assertTrue(set(TEST_HOLDOUT_BRANCHES).isdisjoint(set(TRAIN_BRANCHES)))

    def test_temporal_bounds(self) -> None:
        self.assertLess(ROLLING_WINDOW, TRAIN_DAY_END)
        self.assertLess(TRAIN_DAY_END, VAL_DAY_END)
        self.assertLess(VAL_DAY_END, N_DAYS)

    def test_warmup_days_emit_no_split(self) -> None:
        for day in range(ROLLING_WINDOW):
            for b in range(N_BRANCHES):
                self.assertIsNone(_assign_split(b, day))

    def test_holdout_branch_excluded_from_train_window(self) -> None:
        for day in range(TRAIN_DAY_END):
            for b in TEST_HOLDOUT_BRANCHES:
                self.assertIsNone(_assign_split(b, day))

    def test_holdout_branch_only_test_after_train(self) -> None:
        for day in range(TRAIN_DAY_END, N_DAYS):
            for b in TEST_HOLDOUT_BRANCHES:
                self.assertEqual(_assign_split(b, day), "test")

    def test_seen_branch_splits(self) -> None:
        b = TRAIN_BRANCHES[0]
        self.assertEqual(_assign_split(b, ROLLING_WINDOW), "train")
        self.assertEqual(_assign_split(b, TRAIN_DAY_END), "val")
        self.assertEqual(_assign_split(b, VAL_DAY_END), "test")

    def test_branch_count(self) -> None:
        self.assertEqual(N_BRANCHES, len(TRAIN_BRANCHES) + len(TEST_HOLDOUT_BRANCHES))

    def test_train_size_floor(self) -> None:
        # 12 seen branches × (TRAIN_DAY_END - ROLLING_WINDOW) days
        expected_train = len(TRAIN_BRANCHES) * (TRAIN_DAY_END - ROLLING_WINDOW)
        self.assertGreaterEqual(expected_train, 2000)

    def test_stratified_anomaly_floors(self) -> None:
        val_n = (
            len(ANOMALY_TYPES)
            * len(DIFFICULTIES)
            * VAL_ANOMALIES_PER_TYPE_DIFFICULTY
        )
        test_n = (
            len(ANOMALY_TYPES)
            * len(DIFFICULTIES)
            * TEST_ANOMALIES_PER_TYPE_DIFFICULTY
        )
        self.assertGreaterEqual(val_n, 30)
        self.assertGreaterEqual(test_n, 30)
        self.assertGreaterEqual(val_n, MIN_VAL_POSITIVES)
        self.assertGreaterEqual(test_n, 30)


if __name__ == "__main__":
    unittest.main()
