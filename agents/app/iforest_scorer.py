"""
A3 Isolation Forest scorer (Phase B).

Loads a3-iforest-v2 artifacts, validates feature payloads, applies the frozen
validation threshold, and returns non-probabilistic anomaly scores plus
heuristic explanations.

Fail closed if artifacts are missing or inconsistent.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

_AGENTS_ROOT = Path(__file__).resolve().parents[1]
if str(_AGENTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_AGENTS_ROOT))

from ml.features import FEATURE_ALLOWLIST, MODEL_VERSION
from ml.scoring_utils import anomaly_score_from_decision, confidence_from_score

# Documented research limitation — also surfaced on each score response.
KNOWN_LIMITATIONS: tuple[str, ...] = (
    "Trained on controlled synthetic data only — not real MFI production traffic.",
    "Isolation Forest scores are not calibrated probabilities or fraud likelihoods.",
    "Does not reliably detect amount-only spikes (amount_spike); "
    "A3 must not be claimed to detect all financial anomalies.",
    "Frozen validation threshold may not generalise beyond the synthetic v2 split.",
)

SCORE_SEMANTICS = (
    "Non-probabilistic Isolation Forest anomaly score: "
    "score = 1/(1+exp(decision_function)); higher => more anomalous. "
    "Not a probability, confidence interval, or fraud likelihood."
)


class FeatureValidationError(ValueError):
    """Invalid or incomplete feature payload."""


class ModelUnavailableError(RuntimeError):
    """Artifacts missing, unreadable, or failing integrity checks."""


@dataclass(frozen=True)
class AnomalyScoreResult:
    score: float
    confidence: float
    model_version: str
    is_anomaly: bool
    threshold: float
    decision_function: float
    explanations: list[str]
    feature_summary: dict[str, Any]
    score_semantics: str
    limitations: list[str]


def resolve_artifacts_dir(configured: str | Path | None = None) -> Path:
    """Resolve artifacts directory (relative paths are under agents/)."""
    if configured is None or str(configured).strip() == "":
        return _AGENTS_ROOT / "artifacts"
    path = Path(configured)
    if not path.is_absolute():
        path = _AGENTS_ROOT / path
    return path.resolve()


def _require_finite_number(name: str, raw: Any) -> float:
    if raw is None:
        raise FeatureValidationError(f"feature '{name}' is missing or null")
    if isinstance(raw, bool):
        raise FeatureValidationError(f"feature '{name}' must be numeric, not boolean")
    try:
        value = float(raw)
    except (TypeError, ValueError) as exc:
        raise FeatureValidationError(f"feature '{name}' must be a finite number") from exc
    if not np.isfinite(value):
        raise FeatureValidationError(f"feature '{name}' must be a finite number")
    return float(value)


class IForestScorer:
    """Thread-safe after construction (read-only model + frozen threshold)."""

    def __init__(
        self,
        *,
        pipeline: Any,
        feature_allowlist: tuple[str, ...],
        model_version: str,
        threshold: float,
        train_feature_means: dict[str, float],
        train_feature_stds: dict[str, float],
    ) -> None:
        self._pipeline = pipeline
        self.feature_allowlist = tuple(feature_allowlist)
        self.model_version = model_version
        self.threshold = float(threshold)
        self._means = {k: float(train_feature_means[k]) for k in self.feature_allowlist}
        self._stds = {
            k: float(train_feature_stds.get(k, 1.0)) or 1.0 for k in self.feature_allowlist
        }

    @classmethod
    def from_artifacts(
        cls,
        artifacts_dir: Path | str,
        *,
        expected_version: str = MODEL_VERSION,
    ) -> IForestScorer:
        try:
            import joblib
        except ImportError as exc:  # pragma: no cover
            raise ModelUnavailableError(
                "joblib/scikit-learn dependencies are not installed"
            ) from exc

        root = Path(artifacts_dir)
        model_path = root / f"{expected_version}.joblib"
        meta_path = root / f"{expected_version}.meta.json"

        if not model_path.is_file():
            raise ModelUnavailableError(
                f"model artifact missing: {model_path.name}"
            )
        if not meta_path.is_file():
            raise ModelUnavailableError(
                f"model metadata missing: {meta_path.name}"
            )

        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise ModelUnavailableError("model metadata is unreadable") from exc

        if not isinstance(meta, dict):
            raise ModelUnavailableError("model metadata must be a JSON object")

        meta_version = meta.get("model_version")
        if meta_version != expected_version:
            raise ModelUnavailableError(
                f"metadata model_version mismatch: expected {expected_version}, "
                f"got {meta_version!r}"
            )

        meta_features = meta.get("feature_allowlist")
        if list(meta_features or []) != list(FEATURE_ALLOWLIST):
            raise ModelUnavailableError(
                "metadata feature_allowlist does not match runtime FEATURE_ALLOWLIST"
            )

        thr_block = meta.get("threshold")
        if not isinstance(thr_block, dict) or "threshold" not in thr_block:
            raise ModelUnavailableError("metadata missing frozen threshold")
        try:
            threshold = float(thr_block["threshold"])
        except (TypeError, ValueError) as exc:
            raise ModelUnavailableError("metadata threshold is not numeric") from exc
        if not np.isfinite(threshold):
            raise ModelUnavailableError("metadata threshold is not finite")

        means = meta.get("train_feature_means") or {}
        stds = meta.get("train_feature_stds") or {}
        if not isinstance(means, dict) or not isinstance(stds, dict):
            raise ModelUnavailableError("metadata train feature stats are invalid")
        for name in FEATURE_ALLOWLIST:
            if name not in means:
                raise ModelUnavailableError(
                    f"metadata missing train_feature_means['{name}']"
                )

        try:
            bundle = joblib.load(model_path)
        except Exception as exc:  # pragma: no cover — corrupt binary
            raise ModelUnavailableError("model artifact failed to load") from exc

        if not isinstance(bundle, dict):
            raise ModelUnavailableError("model artifact has unexpected shape")

        bundle_version = bundle.get("model_version")
        if bundle_version != expected_version:
            raise ModelUnavailableError(
                f"artifact model_version mismatch: expected {expected_version}, "
                f"got {bundle_version!r}"
            )

        bundle_features = bundle.get("feature_allowlist")
        if list(bundle_features or []) != list(FEATURE_ALLOWLIST):
            raise ModelUnavailableError(
                "artifact feature_allowlist does not match runtime FEATURE_ALLOWLIST"
            )

        pipeline = bundle.get("pipeline") or bundle.get("model")
        if pipeline is None or not hasattr(pipeline, "decision_function"):
            raise ModelUnavailableError(
                "artifact missing a fitted pipeline with decision_function"
            )

        return cls(
            pipeline=pipeline,
            feature_allowlist=FEATURE_ALLOWLIST,
            model_version=expected_version,
            threshold=threshold,
            train_feature_means={k: float(means[k]) for k in FEATURE_ALLOWLIST},
            train_feature_stds={
                k: float(stds.get(k, 1.0)) for k in FEATURE_ALLOWLIST
            },
        )

    def vectorize(self, features: dict[str, Any] | None) -> np.ndarray:
        """Validate names/types and return a (1, n_features) float matrix."""
        if features is None or not isinstance(features, dict):
            raise FeatureValidationError("features must be a JSON object")

        missing = [name for name in self.feature_allowlist if name not in features]
        if missing:
            raise FeatureValidationError(
                "missing required features: " + ", ".join(missing)
            )

        values = [
            _require_finite_number(name, features[name])
            for name in self.feature_allowlist
        ]
        return np.asarray([values], dtype=float)

    def _heuristic_explanations(
        self, row: np.ndarray, *, is_anomaly: bool, score: float
    ) -> list[str]:
        """
        Concise heuristics from deviation vs train means — not SHAP / IF importances.
        """
        z_scores: list[tuple[str, float, float]] = []
        for i, name in enumerate(self.feature_allowlist):
            mu = self._means[name]
            sd = self._stds[name] if self._stds[name] > 1e-9 else 1.0
            z = (float(row[i]) - mu) / sd
            z_scores.append((name, z, float(row[i])))

        z_scores.sort(key=lambda t: abs(t[1]), reverse=True)
        top = z_scores[:3]

        lines: list[str] = []
        if is_anomaly:
            lines.append(
                f"Flagged as anomalous: non-probabilistic score {score:.4f} "
                f">= frozen threshold {self.threshold:.4f}."
            )
        else:
            lines.append(
                f"Not flagged: non-probabilistic score {score:.4f} "
                f"< frozen threshold {self.threshold:.4f}."
            )

        for name, z, raw in top:
            direction = "above" if z >= 0 else "below"
            lines.append(
                f"{name}={raw:.4f} ({abs(z):.2f}σ {direction} train centre) "
                "— heuristic contribution only."
            )

        lines.append(
            "Limitation: amount-only spikes are often missed; "
            "this is not a complete financial-anomaly detector."
        )
        return lines

    def score(self, features: dict[str, Any] | None) -> AnomalyScoreResult:
        X = self.vectorize(features)
        decision = float(np.asarray(self._pipeline.decision_function(X)).reshape(-1)[0])
        score = float(anomaly_score_from_decision(decision))
        confidence = float(confidence_from_score(score))
        is_anomaly = bool(score >= self.threshold)
        row = X.reshape(-1)

        ordered = {
            name: float(row[i]) for i, name in enumerate(self.feature_allowlist)
        }
        return AnomalyScoreResult(
            score=round(score, 6),
            confidence=round(confidence, 2),
            model_version=self.model_version,
            is_anomaly=is_anomaly,
            threshold=self.threshold,
            decision_function=round(decision, 6),
            explanations=self._heuristic_explanations(
                row, is_anomaly=is_anomaly, score=score
            ),
            feature_summary={
                "orderedFeatures": ordered,
                "ignoredExtraKeys": sorted(
                    set((features or {}).keys()) - set(self.feature_allowlist)
                ),
            },
            score_semantics=SCORE_SEMANTICS,
            limitations=list(KNOWN_LIMITATIONS),
        )


# Process-wide loader used by FastAPI lifespan (fail closed → None + reason).
_scorer: IForestScorer | None = None
_load_error: str | None = None


def get_scorer() -> IForestScorer | None:
    return _scorer


def get_load_error() -> str | None:
    return _load_error


def init_scorer(artifacts_dir: Path | str | None = None) -> IForestScorer | None:
    """Load artifacts into process state. Returns scorer or None (fail closed)."""
    global _scorer, _load_error
    _scorer = None
    _load_error = None
    try:
        path = resolve_artifacts_dir(artifacts_dir)
        _scorer = IForestScorer.from_artifacts(path)
        return _scorer
    except ModelUnavailableError as exc:
        _load_error = str(exc)
        return None


def require_scorer() -> IForestScorer:
    if _scorer is None:
        detail = _load_error or "Isolation Forest model is not available"
        raise ModelUnavailableError(detail)
    return _scorer


def reset_scorer_state() -> None:
    """Test helper — clear process-wide scorer state."""
    global _scorer, _load_error
    _scorer = None
    _load_error = None
