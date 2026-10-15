"""
IMFS Agents — Phase 10 FastAPI entrypoint (Phase B Isolation Forest).

Graduated Trust decisions stay in Node. This service scores with a3-iforest-v2
and may forward allowlisted dispatches via the service-key client.
Dispatch remains disabled by default.
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import __version__
from .config import get_settings
from .iforest_scorer import (
    FeatureValidationError,
    ModelUnavailableError,
    get_load_error,
    get_scorer,
    init_scorer,
    require_scorer,
)
from .node_client import NodeDispatchClient, NodeDispatchError, NodeTransportError
from .security import (
    MAX_INPUT_PAYLOAD_JSON_BYTES,
    constant_time_equals,
    ensure_json_object_within_limit,
)


class ScoreRequest(BaseModel):
    features: dict[str, Any] = Field(default_factory=dict)


class ScoreResponse(BaseModel):
    score: float
    confidence: float
    modelVersion: str
    isAnomaly: bool
    threshold: float
    decisionFunction: float
    explanations: list[str]
    featureSummary: dict[str, Any]
    scoreSemantics: str
    limitations: list[str]


class StubDispatchRequest(BaseModel):
    institutionId: str = Field(..., min_length=36, max_length=36)
    action: str = Field(
        default="Volume spike alert from Agent 3 Isolation Forest",
        min_length=1,
        max_length=1000,
    )
    features: dict[str, Any] = Field(default_factory=dict)
    reason: str | None = Field(default=None, max_length=1000)


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def _bounded_features(features: dict[str, Any]) -> dict[str, Any]:
    """Reject oversized / non-serializable feature maps before scoring or dispatch."""
    try:
        ensure_json_object_within_limit(
            features,
            limit=max(1024, MAX_INPUT_PAYLOAD_JSON_BYTES - 2048),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return features


def _score_or_http(features: dict[str, Any]) -> ScoreResponse:
    try:
        scorer = require_scorer()
        result = scorer.score(features)
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except FeatureValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ScoreResponse(
        score=result.score,
        confidence=result.confidence,
        modelVersion=result.model_version,
        isAnomaly=result.is_anomaly,
        threshold=result.threshold,
        decisionFunction=result.decision_function,
        explanations=result.explanations,
        featureSummary=result.feature_summary,
        scoreSemantics=result.score_semantics,
        limitations=result.limitations,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # Fail closed for scoring if artifacts are missing — do not crash the process
    # so /health can still report modelReady=false.
    init_scorer(settings.agents_artifacts_dir)
    client = NodeDispatchClient(settings)
    app.state.node_client = client
    yield
    await client.aclose()


app = FastAPI(
    title="IMFS Agents",
    version=__version__,
    description=(
        "Phase 10 agent runtime (a3-iforest-v2 → Node Graduated Trust). "
        "Scores are non-probabilistic; dispatch disabled by default."
    ),
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict[str, Any]:
    settings = get_settings()
    key_configured = False
    try:
        settings.require_service_key()
        key_configured = True
    except ValueError:
        key_configured = False

    scorer = get_scorer()
    model_ready = scorer is not None
    return {
        "ok": True,
        "service": "imfs-agents",
        "version": __version__,
        "nodeApiUrl": settings.node_api_base,
        "agentServiceKeyConfigured": key_configured,
        "dispatchStubEnabled": bool(settings.enable_dispatch_stub),
        "modelReady": model_ready,
        "modelVersion": scorer.model_version if scorer else None,
        "threshold": scorer.threshold if scorer else None,
        "modelLoadError": None if model_ready else get_load_error(),
        "scoreSemantics": (
            "non-probabilistic Isolation Forest score; not a probability or fraud likelihood"
        ),
    }


@app.post("/v1/anomaly/score", response_model=ScoreResponse)
async def anomaly_score(body: ScoreRequest) -> ScoreResponse:
    """Local IF score only — does not call Node or touch any database."""
    features = _bounded_features(body.features)
    return _score_or_http(features)


@app.post("/v1/anomaly/stub-score", response_model=ScoreResponse, deprecated=True)
async def stub_score_compat(body: ScoreRequest) -> ScoreResponse:
    """
    Compatibility alias for /v1/anomaly/score.

    Previously returned a3-iforest-stub-v0. Now uses a3-iforest-v2.
    """
    features = _bounded_features(body.features)
    return _score_or_http(features)


@app.post("/v1/anomaly/dispatch-stub")
async def dispatch_stub(
    body: StubDispatchRequest,
    x_agents_local_token: str | None = Header(default=None, alias="X-Agents-Local-Token"),
) -> dict[str, Any]:
    """
    Score with a3-iforest-v2, then POST volume_spike_alert to Node internal dispatch.

    Disabled by default (ENABLE_DISPATCH_STUB=false). When enabled, requires
    X-Agents-Local-Token (AGENTS_LOCAL_TOKEN) — separate from AGENT_SERVICE_KEY.
    Tier / agent selection remain Node-owned (Tier 4 alert_only for A3).
    """
    settings = get_settings()
    if not settings.enable_dispatch_stub:
        raise HTTPException(status_code=404, detail="Not Found")

    try:
        expected_token = settings.require_local_token()
    except ValueError:
        raise HTTPException(
            status_code=503,
            detail="Dispatch stub is not configured",
        ) from None

    if not constant_time_equals(x_agents_local_token, expected_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not _is_uuid(body.institutionId):
        raise HTTPException(status_code=400, detail="institutionId must be a valid UUID")

    action_trimmed = body.action.strip()
    if not action_trimmed:
        raise HTTPException(status_code=400, detail="action must not be empty after trim")

    features = _bounded_features(body.features)
    scored = _score_or_http(features)
    if not scored.isAnomaly:
        raise HTTPException(
            status_code=422,
            detail=(
                "Score is not anomalous under the frozen v2 threshold; "
                "dispatch not sent"
            ),
        )

    input_payload = {
        "score": scored.score,
        "isAnomaly": scored.isAnomaly,
        "threshold": scored.threshold,
        "decisionFunction": scored.decisionFunction,
        "explanations": scored.explanations,
        "featureSummary": scored.featureSummary,
        "scoreSemantics": scored.scoreSemantics,
        "limitations": scored.limitations,
    }
    try:
        ensure_json_object_within_limit(input_payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    reason = body.reason.strip() if isinstance(body.reason, str) else None
    if reason == "":
        reason = None

    client: NodeDispatchClient = app.state.node_client
    try:
        node_result = await client.dispatch_volume_spike_alert(
            institution_id=body.institutionId,
            action=action_trimmed,
            confidence=scored.confidence,
            model_version=scored.modelVersion,
            input_payload=input_payload,
            reason=reason,
        )
    except ValueError:
        raise HTTPException(
            status_code=503,
            detail="Agent service authentication is not configured",
        ) from None
    except NodeTransportError:
        raise HTTPException(status_code=502, detail="Upstream unavailable") from None
    except NodeDispatchError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from None

    return {
        "score": {
            "score": scored.score,
            "confidence": scored.confidence,
            "modelVersion": scored.modelVersion,
            "isAnomaly": scored.isAnomaly,
            "threshold": scored.threshold,
            "explanations": scored.explanations,
        },
        "dispatch": node_result,
    }
