/**
 * Internal agent dispatch (service-key auth, not user JWT).
 *
 * POST /api/internal/agent-actions/dispatch
 *
 * Node owns tenant routing, active-policy checks, and Graduated Trust tier decisions.
 * Callers cannot supply tier, agentId, agentName, or policyId.
 */

import { Router, type Request, type Response } from "express"
import {
  AGENT_SERVICE_KEY_HEADER,
  getAgentServiceKeyConfig,
  verifyAgentServiceKey,
} from "../lib/agent-service-auth.js"
import { logSafeError } from "../lib/auth.js"
import {
  dispatchAgentAction,
  isValidUuid,
  type TenantPrisma,
} from "../lib/agent-engine.js"
import { resolveTenantByInstitutionId } from "../lib/tenant-context.js"
import { internalAgentDispatchLimiter } from "../middleware/rate-limit.js"

export const internalAgentDispatchRouter = Router()

/** Step 0 allowlist — expand only with explicit Phase 10 approval. */
export const SERVICE_DISPATCH_ALLOWED_ACTION_TYPES = new Set([
  "volume_spike_alert",
])

/** Service dispatch may only create Tier 4 alert_only actions for Agent 3. */
export const SERVICE_DISPATCH_REQUIRED_TIER = 4
export const SERVICE_DISPATCH_REQUIRED_AGENT_ID = "A3"

const ALLOWED_BODY_KEYS = new Set([
  "institutionId",
  "actionType",
  "action",
  "reason",
  "confidence",
  "modelVersion",
  "inputPayload",
])

const FORBIDDEN_BODY_KEYS = new Set([
  "tier",
  "agentId",
  "agentName",
  "policyId",
])

const MAX_ACTION_LEN = 1000
const MAX_MODEL_VERSION_LEN = 128
const MAX_INPUT_PAYLOAD_JSON_BYTES = 32 * 1024

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Authenticate via X-Agent-Service-Key. Fail-closed when unset/insecure.
 */
export function requireAgentServiceKey(
  req: Request,
  res: Response
): boolean {
  const config = getAgentServiceKeyConfig()
  if (!config.ok) {
    res.status(503).json({ error: "Agent service authentication is not configured" })
    return false
  }

  const provided = req.header(AGENT_SERVICE_KEY_HEADER)
  if (!verifyAgentServiceKey(provided, config.key)) {
    res.status(401).json({ error: "Unauthorized" })
    return false
  }
  return true
}

export async function handleInternalAgentDispatch(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!requireAgentServiceKey(req, res)) {
      return
    }

    const body = req.body
    if (!isPlainObject(body)) {
      res.status(400).json({ error: "Request body must be a JSON object" })
      return
    }

    const keys = Object.keys(body)
    const forbidden = keys.filter((k) => FORBIDDEN_BODY_KEYS.has(k))
    if (forbidden.length > 0) {
      res.status(400).json({
        error: `Forbidden field(s): ${forbidden.sort().join(", ")}`,
      })
      return
    }

    const unexpected = keys.filter((k) => !ALLOWED_BODY_KEYS.has(k))
    if (unexpected.length > 0) {
      res.status(400).json({
        error: `Unexpected field(s): ${unexpected.sort().join(", ")}`,
      })
      return
    }

    const {
      institutionId,
      actionType,
      action,
      reason,
      confidence,
      modelVersion,
      inputPayload,
    } = body

    if (!isValidUuid(institutionId)) {
      res.status(400).json({ error: "institutionId must be a valid UUID" })
      return
    }

    if (typeof actionType !== "string" || !SERVICE_DISPATCH_ALLOWED_ACTION_TYPES.has(actionType)) {
      res.status(403).json({ error: "actionType is not permitted for service dispatch" })
      return
    }

    if (typeof action !== "string") {
      res.status(400).json({ error: "action must be a string" })
      return
    }
    const actionTrimmed = action.trim()
    if (!actionTrimmed || actionTrimmed.length > MAX_ACTION_LEN) {
      res.status(400).json({
        error: `action must be 1 to ${MAX_ACTION_LEN} characters after trim`,
      })
      return
    }

    if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
      res.status(400).json({ error: "confidence must be a finite number" })
      return
    }
    if (confidence < 0 || confidence > 100) {
      res.status(400).json({ error: "confidence must be between 0 and 100 inclusive" })
      return
    }

    if (typeof modelVersion !== "string") {
      res.status(400).json({ error: "modelVersion must be a string" })
      return
    }
    const modelVersionTrimmed = modelVersion.trim()
    if (!modelVersionTrimmed || modelVersionTrimmed.length > MAX_MODEL_VERSION_LEN) {
      res.status(400).json({
        error: `modelVersion must be 1 to ${MAX_MODEL_VERSION_LEN} characters after trim`,
      })
      return
    }

    if (!isPlainObject(inputPayload)) {
      res.status(400).json({ error: "inputPayload must be a JSON object" })
      return
    }
    let inputPayloadBytes: number
    try {
      inputPayloadBytes = Buffer.byteLength(JSON.stringify(inputPayload), "utf8")
    } catch {
      res.status(400).json({ error: "inputPayload must be JSON-serializable" })
      return
    }
    if (inputPayloadBytes > MAX_INPUT_PAYLOAD_JSON_BYTES) {
      res.status(400).json({
        error: `inputPayload exceeds maximum size of ${MAX_INPUT_PAYLOAD_JSON_BYTES} bytes`,
      })
      return
    }

    let reasonTrimmed: string | undefined
    if (reason !== undefined) {
      if (typeof reason !== "string") {
        res.status(400).json({ error: "reason must be a string when provided" })
        return
      }
      reasonTrimmed = reason.trim()
      if (reasonTrimmed.length > 1000) {
        res.status(400).json({ error: "reason must not exceed 1000 characters" })
        return
      }
      if (reasonTrimmed.length === 0) {
        reasonTrimmed = undefined
      }
    }

    const resolved = await resolveTenantByInstitutionId(institutionId)
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.message })
      return
    }

    const tenantPrisma = resolved.prisma as TenantPrisma

    const policy = await tenantPrisma.agentTierPolicy.findUnique({
      where: { actionType },
    })
    if (!policy || !policy.isActive) {
      res.status(403).json({
        error: "No active policy for this actionType in the target institution",
      })
      return
    }

    if (policy.tier !== SERVICE_DISPATCH_REQUIRED_TIER) {
      res.status(403).json({
        error: "Active policy must be Tier 4 for service dispatch of this actionType",
      })
      return
    }

    if (policy.agentId !== SERVICE_DISPATCH_REQUIRED_AGENT_ID) {
      res.status(403).json({
        error: "Active policy agentId must be A3 for service dispatch of this actionType",
      })
      return
    }

    const result = await dispatchAgentAction(tenantPrisma, {
      actionType,
      action: actionTrimmed,
      reason: reasonTrimmed,
      confidence,
      modelVersion: modelVersionTrimmed,
      inputPayload,
      // Identity strictly from active policy — never from the request body.
      agentId: policy.agentId,
      agentName: policy.agentName,
      ip: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string) ?? null,
    })

    if (result.status === "ok") {
      res.status(200).json(result)
      return
    }
    if (result.status === "conflict") {
      res.status(409).json({ error: result.error })
      return
    }
    res.status(400).json({ error: result.error })
  } catch (err: unknown) {
    logSafeError("[internal-agent-dispatch] Dispatch error", err)
    res.status(500).json({ error: "Failed to dispatch agent action" })
  }
}

internalAgentDispatchRouter.post(
  "/agent-actions/dispatch",
  internalAgentDispatchLimiter,
  handleInternalAgentDispatch
)
