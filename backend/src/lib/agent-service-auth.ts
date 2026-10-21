/**
 * Shared-secret authentication for internal agent → Node dispatch calls.
 * Fail-closed: missing, placeholder, or short keys are rejected.
 * Never log the raw key value.
 */

import { createHash, timingSafeEqual } from "node:crypto"

export const AGENT_SERVICE_KEY_HEADER = "x-agent-service-key"

const PLACEHOLDER_VALUES = new Set([
  "replace-with-a-secure-random-secret",
  "replace-with-a-secure-random-secret-at-least-32-chars-long",
  "your-agent-service-key",
  "secret",
  "changeme",
])

export type AgentServiceKeyConfig =
  | { ok: true; key: string }
  | { ok: false; reason: "missing" | "placeholder" | "too_short" }

/**
 * Reads and validates AGENT_SERVICE_KEY from the environment.
 * Does not throw — callers map failures to HTTP 503.
 */
export function getAgentServiceKeyConfig(): AgentServiceKeyConfig {
  const key = process.env.AGENT_SERVICE_KEY?.trim() ?? ""
  if (!key) {
    return { ok: false, reason: "missing" }
  }
  if (PLACEHOLDER_VALUES.has(key.toLowerCase())) {
    return { ok: false, reason: "placeholder" }
  }
  if (key.length < 32) {
    return { ok: false, reason: "too_short" }
  }
  return { ok: true, key }
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest()
}

/**
 * Constant-time comparison of the provided header value against the configured key.
 * Hashes both sides to fixed length so unequal string lengths do not short-circuit.
 */
export function verifyAgentServiceKey(
  provided: string | undefined | null,
  expected: string
): boolean {
  if (typeof provided !== "string" || provided.length === 0) {
    return false
  }
  try {
    return timingSafeEqual(sha256(provided), sha256(expected))
  } catch {
    return false
  }
}
