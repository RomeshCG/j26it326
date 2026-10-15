"""
DEPRECATED — S0c stub scorer.

Phase B replaces the live scoring path with ``app.iforest_scorer`` /
``a3-iforest-v2``. This module is retained only for historical reference and
must not be wired into FastAPI routes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


STUB_MODEL_VERSION = "a3-iforest-stub-v0"


@dataclass(frozen=True)
class AnomalyStubResult:
    score: float
    confidence: float
    model_version: str
    is_anomaly: bool
    feature_summary: dict[str, Any]


def score_volume_spike_stub(
    features: dict[str, Any] | None = None,
) -> AnomalyStubResult:
    """
    Legacy stub. Do not use in production paths — prefer IForestScorer.
    """
    feats = dict(features or {})
    spike_ratio = feats.get("spike_ratio")
    try:
        ratio = float(spike_ratio) if spike_ratio is not None else 1.0
    except (TypeError, ValueError):
        ratio = 1.0

    if ratio >= 1.5:
        score = min(0.99, 0.55 + (ratio - 1.5) * 0.2)
        is_anomaly = True
    else:
        score = 0.12
        is_anomaly = False

    confidence = round(score * 100, 2)
    return AnomalyStubResult(
        score=round(score, 4),
        confidence=confidence,
        model_version=STUB_MODEL_VERSION,
        is_anomaly=is_anomaly,
        feature_summary={
            "spike_ratio": ratio,
            "stub": True,
            **{k: v for k, v in feats.items() if k != "spike_ratio"},
        },
    )
