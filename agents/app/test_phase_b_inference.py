"""
Phase B inference tests (offline — no Node, no live dispatch).

Run from agents/:
  python -m app.test_phase_b_inference
"""

from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from ml.features import FEATURE_ALLOWLIST, MODEL_VERSION

from . import config as config_mod
from .iforest_scorer import (
    FeatureValidationError,
    IForestScorer,
    ModelUnavailableError,
    init_scorer,
    reset_scorer_state,
    resolve_artifacts_dir,
)


AGENTS_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARTIFACTS = AGENTS_ROOT / "artifacts"

# Val-set style fixtures (synthetic; not tuned against test metrics here)
NORMAL_FEATURES = {
    "spike_ratio_count": 0.7689433914928667,
    "spike_ratio_amount": 0.72819798709972,
    "counterparty_spike_ratio": 0.7189683111458994,
    "after_hours_share_1d": 0.0476750490096083,
    "after_hours_delta_vs_7d": -0.0287096686265834,
    "new_payee_share_1d": 0.0203600163370152,
    "new_payee_delta_vs_7d": -0.0253020706001449,
    "amount_cv_7d": 0.2764451703276105,
    "count_z_vs_branch_hist": -1.2371826938820705,
    "amount_z_vs_branch_hist": -1.2475097457190436,
}

COMBINED_BURST_EASY = {
    "spike_ratio_count": 2.6998262524698946,
    "spike_ratio_amount": 2.9364910536376194,
    "counterparty_spike_ratio": 2.2161997042400645,
    "after_hours_share_1d": 0.55,
    "after_hours_delta_vs_7d": 0.440803593799653,
    "new_payee_share_1d": 0.45,
    "new_payee_delta_vs_7d": 0.4037923727747241,
    "amount_cv_7d": 0.223898278105912,
    "count_z_vs_branch_hist": 5.737088233656196,
    "amount_z_vs_branch_hist": 6.865231540049596,
}

AMOUNT_SPIKE_SUBTLE = {
    "spike_ratio_count": 1.157439540411795,
    "spike_ratio_amount": 1.6392892620304829,
    "counterparty_spike_ratio": 0.9752129833512108,
    "after_hours_share_1d": 0.0641224242740796,
    "after_hours_delta_vs_7d": -0.0115706783080008,
    "new_payee_share_1d": 0.0563541668156379,
    "new_payee_delta_vs_7d": 0.0143707492913718,
    "amount_cv_7d": 0.2321535170419765,
    "count_z_vs_branch_hist": 0.1294759840710834,
    "amount_z_vs_branch_hist": 2.070696575606236,
}


def _artifacts_available() -> bool:
    return (DEFAULT_ARTIFACTS / f"{MODEL_VERSION}.joblib").is_file() and (
        DEFAULT_ARTIFACTS / f"{MODEL_VERSION}.meta.json"
    ).is_file()


@unittest.skipUnless(_artifacts_available(), "a3-iforest-v2 artifacts not present")
class RealArtifactInferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        reset_scorer_state()
        config_mod.get_settings.cache_clear()
        cls.scorer = IForestScorer.from_artifacts(DEFAULT_ARTIFACTS)

    def test_loads_expected_version_and_frozen_threshold(self) -> None:
        self.assertEqual(self.scorer.model_version, MODEL_VERSION)
        self.assertAlmostEqual(self.scorer.threshold, 0.5137412782898763, places=6)
        self.assertEqual(list(self.scorer.feature_allowlist), list(FEATURE_ALLOWLIST))

    def test_normal_input_not_anomaly(self) -> None:
        result = self.scorer.score(NORMAL_FEATURES)
        self.assertFalse(result.is_anomaly)
        self.assertLess(result.score, result.threshold)
        self.assertEqual(result.model_version, MODEL_VERSION)
        self.assertIn("not a probability", result.score_semantics.lower())
        self.assertTrue(
            any("amount-only" in line.lower() for line in result.explanations)
        )
        self.assertTrue(
            any("amount-only" in lim.lower() for lim in result.limitations)
        )

    def test_combined_burst_is_anomaly(self) -> None:
        result = self.scorer.score(COMBINED_BURST_EASY)
        self.assertTrue(result.is_anomaly)
        self.assertGreaterEqual(result.score, result.threshold)
        self.assertGreaterEqual(len(result.explanations), 2)

    def test_amount_spike_limitation_documented_and_often_missed(self) -> None:
        """Honest limitation: amount-only spikes are typically not flagged."""
        result = self.scorer.score(AMOUNT_SPIKE_SUBTLE)
        self.assertFalse(result.is_anomaly)
        self.assertTrue(
            any("amount-only" in lim.lower() for lim in result.limitations)
        )

    def test_missing_feature_rejected(self) -> None:
        bad = dict(NORMAL_FEATURES)
        del bad["spike_ratio_count"]
        with self.assertRaises(FeatureValidationError) as ctx:
            self.scorer.score(bad)
        self.assertIn("missing", str(ctx.exception).lower())

    def test_non_numeric_feature_rejected(self) -> None:
        bad = dict(NORMAL_FEATURES)
        bad["spike_ratio_amount"] = "not-a-number"
        with self.assertRaises(FeatureValidationError):
            self.scorer.score(bad)

    def test_null_and_nan_rejected(self) -> None:
        bad = dict(NORMAL_FEATURES)
        bad["amount_cv_7d"] = None
        with self.assertRaises(FeatureValidationError):
            self.scorer.score(bad)
        bad2 = dict(NORMAL_FEATURES)
        bad2["amount_cv_7d"] = float("nan")
        with self.assertRaises(FeatureValidationError):
            self.scorer.score(bad2)

    def test_boolean_rejected(self) -> None:
        bad = dict(NORMAL_FEATURES)
        bad["spike_ratio_count"] = True
        with self.assertRaises(FeatureValidationError):
            self.scorer.score(bad)

    def test_extra_keys_ignored(self) -> None:
        feats = dict(NORMAL_FEATURES)
        feats["spike_ratio"] = 99.0  # legacy stub key — must not crash
        result = self.scorer.score(feats)
        self.assertIn("spike_ratio", result.feature_summary["ignoredExtraKeys"])

    def test_feature_order_matches_allowlist(self) -> None:
        result = self.scorer.score(NORMAL_FEATURES)
        ordered = list(result.feature_summary["orderedFeatures"].keys())
        self.assertEqual(ordered, list(FEATURE_ALLOWLIST))


class ThresholdBoundaryTests(unittest.TestCase):
    def _mock_scorer(self, decision: float, threshold: float) -> IForestScorer:
        pipe = MagicMock()
        pipe.decision_function.return_value = [decision]
        means = {k: 0.0 for k in FEATURE_ALLOWLIST}
        stds = {k: 1.0 for k in FEATURE_ALLOWLIST}
        return IForestScorer(
            pipeline=pipe,
            feature_allowlist=FEATURE_ALLOWLIST,
            model_version=MODEL_VERSION,
            threshold=threshold,
            train_feature_means=means,
            train_feature_stds=stds,
        )

    def test_score_at_threshold_is_anomaly(self) -> None:
        # Invert score = 1/(1+exp(d)) => d = log((1-s)/s)
        # For s == threshold 0.5, decision == 0.
        thr = 0.5
        scorer = self._mock_scorer(decision=0.0, threshold=thr)
        result = scorer.score(NORMAL_FEATURES)
        self.assertAlmostEqual(result.score, 0.5, places=5)
        self.assertTrue(result.is_anomaly)  # score >= threshold

    def test_score_just_below_threshold_not_anomaly(self) -> None:
        # decision > 0 => score < 0.5
        scorer = self._mock_scorer(decision=0.01, threshold=0.5)
        result = scorer.score(NORMAL_FEATURES)
        self.assertLess(result.score, 0.5)
        self.assertFalse(result.is_anomaly)


class ArtifactAvailabilityTests(unittest.TestCase):
    def tearDown(self) -> None:
        reset_scorer_state()
        config_mod.get_settings.cache_clear()

    def test_missing_artifacts_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ModelUnavailableError):
                IForestScorer.from_artifacts(tmp)

    def test_init_scorer_returns_none_when_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            reset_scorer_state()
            scorer = init_scorer(tmp)
            self.assertIsNone(scorer)

    def test_version_mismatch_rejected(self) -> None:
        if not _artifacts_available():
            self.skipTest("artifacts required")
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            src_joblib = DEFAULT_ARTIFACTS / f"{MODEL_VERSION}.joblib"
            src_meta = DEFAULT_ARTIFACTS / f"{MODEL_VERSION}.meta.json"
            # Copy under wrong expected name won't be found; instead corrupt meta version
            shutil.copy(src_joblib, tmp_path / f"{MODEL_VERSION}.joblib")
            meta = json.loads(src_meta.read_text(encoding="utf-8"))
            meta["model_version"] = "a3-iforest-WRONG"
            (tmp_path / f"{MODEL_VERSION}.meta.json").write_text(
                json.dumps(meta), encoding="utf-8"
            )
            with self.assertRaises(ModelUnavailableError) as ctx:
                IForestScorer.from_artifacts(tmp_path)
            self.assertIn("model_version", str(ctx.exception).lower())


@unittest.skipUnless(_artifacts_available(), "a3-iforest-v2 artifacts not present")
class FastAPIScoreEndpointTests(unittest.TestCase):
    """TestClient must use context manager so lifespan loads the model."""

    def setUp(self) -> None:
        import os

        reset_scorer_state()
        os.environ.pop("AGENTS_ARTIFACTS_DIR", None)
        config_mod.get_settings.cache_clear()
        from .main import app

        self._cm = TestClient(app)
        self.client = self._cm.__enter__()

    def tearDown(self) -> None:
        self._cm.__exit__(None, None, None)
        reset_scorer_state()
        config_mod.get_settings.cache_clear()

    def test_health_reports_model_ready(self) -> None:
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["modelReady"])
        self.assertEqual(body["modelVersion"], MODEL_VERSION)
        self.assertFalse(body["dispatchStubEnabled"])
        self.assertIn("non-probabilistic", body["scoreSemantics"])

    def test_score_endpoint_normal_and_anomaly(self) -> None:
        normal = self.client.post(
            "/v1/anomaly/score", json={"features": NORMAL_FEATURES}
        )
        self.assertEqual(normal.status_code, 200)
        nbody = normal.json()
        self.assertFalse(nbody["isAnomaly"])
        self.assertEqual(nbody["modelVersion"], MODEL_VERSION)
        self.assertIn("not a probability", nbody["scoreSemantics"].lower())

        anom = self.client.post(
            "/v1/anomaly/score", json={"features": COMBINED_BURST_EASY}
        )
        self.assertEqual(anom.status_code, 200)
        abody = anom.json()
        self.assertTrue(abody["isAnomaly"])
        self.assertEqual(abody["threshold"], nbody["threshold"])

    def test_score_validation_error(self) -> None:
        res = self.client.post("/v1/anomaly/score", json={"features": {"foo": 1}})
        self.assertEqual(res.status_code, 400)

    def test_dispatch_disabled_by_default(self) -> None:
        res = self.client.post(
            "/v1/anomaly/dispatch-stub",
            json={
                "institutionId": "33b6545d-7c78-4354-a017-d0717efba3b8",
                "features": COMBINED_BURST_EASY,
            },
        )
        self.assertEqual(res.status_code, 404)

    def test_unavailable_artifacts_return_503(self) -> None:
        import os

        self._cm.__exit__(None, None, None)
        reset_scorer_state()
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["AGENTS_ARTIFACTS_DIR"] = tmp
            config_mod.get_settings.cache_clear()
            from .main import app

            with TestClient(app) as client:
                health = client.get("/health")
                self.assertEqual(health.status_code, 200)
                self.assertFalse(health.json()["modelReady"])
                score = client.post(
                    "/v1/anomaly/score", json={"features": NORMAL_FEATURES}
                )
                self.assertEqual(score.status_code, 503)
            os.environ.pop("AGENTS_ARTIFACTS_DIR", None)
            config_mod.get_settings.cache_clear()
            # Restore a client so tearDown can exit safely
            self._cm = TestClient(app)
            self.client = self._cm.__enter__()


class PathHelperTests(unittest.TestCase):
    def test_resolve_default_artifacts(self) -> None:
        path = resolve_artifacts_dir(None)
        self.assertTrue(str(path).endswith("artifacts") or path.name == "artifacts")


if __name__ == "__main__":
    unittest.main()
