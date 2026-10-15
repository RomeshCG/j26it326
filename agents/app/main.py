"""
IMFS Agents — Phase 10 S0c FastAPI entrypoint.

Graduated Trust decisions stay in Node. This service scores (stub) and may
forward allowlisted dispatches via the service-key client.
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import __version__
from .anomaly_stub import score_volume_spike_stub
from .config import get_settings
from .node_client import NodeDispatchClient, NodeDispatchError, NodeTransportError
from .security import (
    MAX_INPUT_PAYLOAD_JSON_BYTES,
    constant_time_equals,
    ensure_json_object_within_limit,
)


class StubScoreRequest(BaseModel):
    features: dict[str, Any] = Field(default_factory=dict)


class StubScoreResponse(BaseModel):
    score: float
    confidence: float
    modelVersion: str
    isAnomaly: bool
    featureSummary: dict[str, Any]


class StubDispatchRequest(BaseModel):
    institutionId: str = Field(..., min_length=36, max_length=36)
    action: str = Field(
        default="Stub volume spike alert from Agent 3 runtime",
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
        # Leave headroom for score metadata wrapped around features in inputPayload.
        ensure_json_object_within_limit(
            features,
            limit=max(1024, MAX_INPUT_PAYLOAD_JSON_BYTES - 2048),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return features


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    client = NodeDispatchClient(settings)
    app.state.node_client = client
    yield
    await client.aclose()


app = FastAPI(
    title="IMFS Agents",
    version=__version__,
    description="Phase 10 agent runtime (stub anomaly → Node Graduated Trust)",
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
    return {
        "ok": True,
        "service": "imfs-agents",
        "version": __version__,
        "nodeApiUrl": settings.node_api_base,
        "agentServiceKeyConfigured": key_configured,
        "dispatchStubEnabled": bool(settings.enable_dispatch_stub),
    }


@app.post("/v1/anomaly/stub-score", response_model=StubScoreResponse)
async def stub_score(body: StubScoreRequest) -> StubScoreResponse:
    """Local stub score only — does not call Node or touch any database."""
    features = _bounded_features(body.features)
    result = score_volume_spike_stub(features)
    return StubScoreResponse(
        score=result.score,
        confidence=result.confidence,
        modelVersion=result.model_version,
        isAnomaly=result.is_anomaly,
        featureSummary=result.feature_summary,
    )


@app.post("/v1/anomaly/dispatch-stub")
async def dispatch_stub(
    body: StubDispatchRequest,
    x_agents_local_token: str | None = Header(default=None, alias="X-Agents-Local-Token"),
) -> dict[str, Any]:
    """
    Score with the stub, then POST volume_spike_alert to Node internal dispatch.

    Disabled by default (ENABLE_DISPATCH_STUB=false). When enabled, requires
    X-Agents-Local-Token (AGENTS_LOCAL_TOKEN) — separate from AGENT_SERVICE_KEY.
    """
    settings = get_settings()
    if not settings.enable_dispatch_stub:
        raise HTTPException(status_code=404, detail="Not Found")

    try:
        expected_token = settings.require_local_token()
    except ValueError:
        # Fail closed without naming which secret is missing.
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
    result = score_volume_spike_stub(features)
    if not result.is_anomaly:
        raise HTTPException(
            status_code=422,
            detail="Stub score is not anomalous; adjust features (e.g. spike_ratio >= 1.5)",
        )

    input_payload = {
        "score": result.score,
        "isAnomaly": result.is_anomaly,
        "featureSummary": result.feature_summary,
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
            confidence=result.confidence,
            model_version=result.model_version,
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
        "stub": {
            "score": result.score,
            "confidence": result.confidence,
            "modelVersion": result.model_version,
            "isAnomaly": result.is_anomaly,
        },
        "dispatch": node_result,
    }
