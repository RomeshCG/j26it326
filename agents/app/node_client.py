"""
HTTP client for Node internal Graduated Trust dispatch.

Does not resolve tenants or select tiers — Node owns that.
Never logs AGENT_SERVICE_KEY or response bodies that may contain secrets.
"""

from __future__ import annotations

from typing import Any

import httpx

from .config import Settings

AGENT_SERVICE_KEY_HEADER = "X-Agent-Service-Key"
DISPATCH_PATH = "/api/internal/agent-actions/dispatch"
ALLOWED_ACTION_TYPE = "volume_spike_alert"


class NodeDispatchError(Exception):
    """Raised when the Node internal dispatch endpoint returns a non-success status."""

    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(f"Node dispatch failed ({status_code}): {message}")


class NodeTransportError(Exception):
    """Network/timeout failure talking to Node — message must stay generic upstream."""


class NodeDispatchClient:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self._settings = settings
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            base_url=settings.node_api_base,
            timeout=settings.http_timeout_seconds,
        )

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def dispatch_volume_spike_alert(
        self,
        *,
        institution_id: str,
        action: str,
        confidence: float,
        model_version: str,
        input_payload: dict[str, Any],
        reason: str | None = None,
    ) -> dict[str, Any]:
        """
        POST allowlisted Tier-4 volume_spike_alert to Node.
        Does not send tier, agentId, agentName, or policyId.
        """
        key = self._settings.require_service_key()
        body: dict[str, Any] = {
            "institutionId": institution_id,
            "actionType": ALLOWED_ACTION_TYPE,
            "action": action,
            "confidence": confidence,
            "modelVersion": model_version,
            "inputPayload": input_payload,
        }
        if reason is not None:
            body["reason"] = reason

        try:
            response = await self._client.post(
                DISPATCH_PATH,
                json=body,
                headers={AGENT_SERVICE_KEY_HEADER: key},
            )
        except httpx.RequestError as exc:
            # Do not include URL, host, or exception text — may leak internals.
            raise NodeTransportError("upstream unavailable") from exc

        if response.status_code >= 400:
            detail = "request rejected"
            try:
                payload = response.json()
                if isinstance(payload, dict) and isinstance(payload.get("error"), str):
                    detail = payload["error"]
            except Exception:
                pass
            raise NodeDispatchError(response.status_code, detail)

        try:
            data = response.json()
        except Exception as exc:
            raise NodeDispatchError(502, "unexpected response from Node") from exc

        if not isinstance(data, dict):
            raise NodeDispatchError(502, "unexpected response shape from Node")
        return data
