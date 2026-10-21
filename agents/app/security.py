"""Secret validation helpers. Never log secret values."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any

PLACEHOLDER_SECRETS = frozenset(
    {
        "replace-with-a-secure-random-secret",
        "replace-with-a-secure-random-secret-at-least-32-chars-long",
        "your-agent-service-key",
        "your-agents-local-token",
        "secret",
        "changeme",
    }
)

# Match Node internal dispatch inputPayload cap
MAX_INPUT_PAYLOAD_JSON_BYTES = 32 * 1024


def validate_secret(value: str, *, label: str) -> str:
    """Fail-closed: non-empty, >=32 chars, not a known placeholder."""
    key = value.strip()
    if not key:
        raise ValueError(f"{label} is not configured")
    if len(key) < 32:
        raise ValueError(f"{label} must be at least 32 characters")
    if key.lower() in PLACEHOLDER_SECRETS:
        raise ValueError(f"{label} must not be a placeholder value")
    return key


def constant_time_equals(provided: str | None, expected: str) -> bool:
    """SHA-256 both sides then hmac.compare_digest (length-independent)."""
    if not isinstance(provided, str) or not provided:
        return False
    left = hashlib.sha256(provided.encode("utf-8")).digest()
    right = hashlib.sha256(expected.encode("utf-8")).digest()
    return hmac.compare_digest(left, right)


def json_utf8_size(value: Any) -> int:
    return len(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def ensure_json_object_within_limit(value: Any, *, limit: int = MAX_INPUT_PAYLOAD_JSON_BYTES) -> None:
    if not isinstance(value, dict):
        raise ValueError("value must be a JSON object")
    try:
        size = json_utf8_size(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("value must be JSON-serializable") from exc
    if size > limit:
        raise ValueError(f"JSON payload exceeds maximum size of {limit} bytes")
