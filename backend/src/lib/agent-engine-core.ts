import { createHash } from "node:crypto"

/**
 * Valid action statuses in the Graduated Trust state machine.
 */
export type AgentActionStatus =
  | "running"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "executed"
  | "notified"
  | "alert_only"
  | "failed"

export const MAX_DETAILS_BYTES = 64 * 1024 // 64 KB = 65,536 bytes

/**
 * Validates human decision reasons (for approve, reject, override, and tier change).
 * Must be a string whose trimmed length is between 10 and 1000 characters.
 */
export function validateReason(reason: unknown): {
  valid: boolean
  error?: string
  trimmed?: string
} {
  if (typeof reason !== "string") {
    return { valid: false, error: "Reason must be a text string" }
  }
  const trimmed = reason.trim()
  if (trimmed.length < 10) {
    return {
      valid: false,
      error: `Reason must be at least 10 characters (got ${trimmed.length})`,
    }
  }
  if (trimmed.length > 1000) {
    return {
      valid: false,
      error: `Reason must not exceed 1000 characters (got ${trimmed.length})`,
    }
  }
  return { valid: true, trimmed }
}

export interface PolicyLike {
  tier?: number
  isActive?: boolean
  agentId?: string | null
  agentName?: string
}

export interface ResolvedTier {
  tier: 1 | 2 | 3 | 4
  isFallback: boolean
  reason: string
  agentId?: string | null
  agentName?: string
}

/**
 * Resolves the governance tier from an active policy.
 * If the policy is missing or inactive, safely falls back to Tier 4 (alert_only).
 */
export function resolveTier(policy: PolicyLike | null | undefined): ResolvedTier {
  if (!policy || !policy.isActive) {
    return {
      tier: 4,
      isFallback: true,
      reason: "Policy not found or inactive; fell back to Tier 4 (alert_only)",
      agentId: policy?.agentId ?? null,
      agentName: policy?.agentName ?? "Unknown",
    }
  }

  const tierNum = policy.tier
  if (tierNum === 1 || tierNum === 2 || tierNum === 3 || tierNum === 4) {
    return {
      tier: tierNum,
      isFallback: false,
      reason: "Matched active policy",
      agentId: policy.agentId ?? null,
      agentName: policy.agentName,
    }
  }

  return {
    tier: 4,
    isFallback: true,
    reason: `Invalid policy tier value (${tierNum}); fell back to Tier 4 (alert_only)`,
    agentId: policy.agentId ?? null,
    agentName: policy.agentName,
  }
}

/**
 * Determines the next status after handler execution.
 * - Tier 1: executed on success, failed on error
 * - Tier 2: notified on success, failed on error
 * - Tier 3: executed on success, failed on error
 * - Other: executed on success, failed on error
 */
export function nextStatusAfterHandler(
  tier: number,
  handlerSucceeded: boolean
): "executed" | "notified" | "failed" {
  if (!handlerSucceeded) {
    return "failed"
  }
  if (tier === 2) {
    return "notified"
  }
  return "executed"
}

/**
 * Validates state transitions in the Graduated Trust engine.
 * Terminal statuses (rejected, executed, notified, alert_only, failed) permit no transitions.
 */
export function isValidTransition(
  from: AgentActionStatus,
  to: AgentActionStatus
): boolean {
  if (from === to) return false

  switch (from) {
    case "running":
      return to === "executed" || to === "notified" || to === "failed"

    case "pending_approval":
      return to === "approved" || to === "rejected"

    case "approved":
      return to === "executed" || to === "failed"

    case "rejected":
    case "executed":
    case "notified":
    case "alert_only":
    case "failed":
      // Terminal states permit no further transitions.
      return false

    default:
      return false
  }
}

/**
 * Produces a deterministic canonical JSON string with recursively sorted object keys.
 */
function canonicalize(val: unknown): string {
  if (val === null || val === undefined) {
    return "null"
  }
  // If value implements toJSON (e.g. Date), invoke it first
  if (typeof val === "object" && typeof (val as { toJSON?: unknown }).toJSON === "function") {
    val = (val as { toJSON: () => unknown }).toJSON()
  }
  if (val === null || typeof val !== "object") {
    return JSON.stringify(val) ?? "null"
  }
  if (Array.isArray(val)) {
    return `[${val.map(canonicalize).join(",")}]`
  }
  const obj = val as Record<string, unknown>
  const sortedKeys = Object.keys(obj).sort()
  const entries = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`
  )
  return `{${entries.join(",")}}`
}

export interface PayloadSummary {
  keys: string[]
  sha256: string
  sizeBytes: number
}

/**
 * Summarizes an input or output payload for audit log storage.
 * Extracts top-level sorted keys (capped to 20 for lightweight storage),
 * computes a deterministic SHA-256 hash, and records byte length.
 * NEVER returns actual payload values (PII safety).
 */
export function summarizePayload(payload: unknown): PayloadSummary {
  if (payload === undefined || payload === null) {
    const emptySha = createHash("sha256").update("").digest("hex")
    return { keys: [], sha256: emptySha, sizeBytes: 0 }
  }

  const allKeys =
    typeof payload === "object" && !Array.isArray(payload)
      ? Object.keys(payload as object).sort()
      : []

  // Retain up to 20 top-level keys to ensure summary is compact and under 2 KB
  const keys = allKeys.slice(0, 20)

  const canonical = canonicalize(payload)
  const sha256 = createHash("sha256").update(canonical, "utf8").digest("hex")
  const sizeBytes = Buffer.byteLength(canonical, "utf8")

  return { keys, sha256, sizeBytes }
}

/**
 * Caps audit log details to prevent unbounded database growth.
 * Replaces largest fields with their summary ONLY if the summary JSON is smaller
 * than the field's current JSON.
 * If still over 64 KB after replacements, returns { truncated: true, summary: summarizePayload(details) }.
 */
export function capDetails(
  details: Record<string, unknown>
): Record<string, unknown> {
  const serialized = JSON.stringify(details)
  const inputBytes = Buffer.byteLength(serialized, "utf8")
  if (inputBytes <= MAX_DETAILS_BYTES) {
    return details
  }

  const capped: Record<string, unknown> = { ...details, truncated: true }

  // Sort fields by serialized size descending (excluding 'truncated')
  const fieldSizes = Object.keys(capped)
    .filter((key) => key !== "truncated")
    .map((key) => {
      const valJson = JSON.stringify(capped[key]) ?? ""
      return {
        key,
        size: Buffer.byteLength(valJson, "utf8"),
      }
    })
    .sort((a, b) => b.size - a.size)

  // Replace largest fields with their summary ONLY if the summary JSON is smaller
  for (const field of fieldSizes) {
    const summary = summarizePayload(capped[field.key])
    const summarySize = Buffer.byteLength(JSON.stringify(summary), "utf8")
    if (summarySize < field.size) {
      capped[field.key] = summary
      if (Buffer.byteLength(JSON.stringify(capped), "utf8") <= MAX_DETAILS_BYTES) {
        break
      }
    }
  }

  // If still over MAX_DETAILS_BYTES after replacements (or no fields could be reduced),
  // return only { truncated: true, summary: summarizePayload(details) }
  let result: Record<string, unknown>
  if (Buffer.byteLength(JSON.stringify(capped), "utf8") > MAX_DETAILS_BYTES) {
    result = {
      truncated: true,
      summary: summarizePayload(details),
    }
  } else {
    result = capped
  }

  // Guard: capDetails must never return something bigger than its input
  const resultBytes = Buffer.byteLength(JSON.stringify(result), "utf8")
  if (resultBytes > inputBytes) {
    return {
      truncated: true,
      summary: summarizePayload(details),
    }
  }

  return result
}

export interface OverrideMetricsRow {
  tier: number
  agentId?: string | null
  isOverride?: boolean
  status: string
}

export interface TierMetric {
  total: number
  overridden: number
  overrideRate: number
  decided?: number
  approved?: number
  rejected?: number
  approvalRate?: number
}

export interface OverrideMetricsResult {
  timeRange: {
    from: string | null
    to: string | null
  }
  totalActions: number
  totalOverridden: number
  overallOverrideRate: number
  tiers: {
    tier1: TierMetric
    tier2: TierMetric
    tier3: TierMetric
    tier4: TierMetric
  }
  byAgent: Record<
    string,
    { total: number; overridden: number; overrideRate: number }
  >
}

/**
 * Computes override and approval rate statistics by tier and agent.
 * Safely guards against division by zero.
 */
export function computeOverrideRates(
  rows: readonly OverrideMetricsRow[],
  from?: string,
  to?: string
): OverrideMetricsResult {
  const tierCounts: Record<
    1 | 2 | 3 | 4,
    {
      total: number
      overridden: number
      decided: number
      approved: number
      rejected: number
    }
  > = {
    1: { total: 0, overridden: 0, decided: 0, approved: 0, rejected: 0 },
    2: { total: 0, overridden: 0, decided: 0, approved: 0, rejected: 0 },
    3: { total: 0, overridden: 0, decided: 0, approved: 0, rejected: 0 },
    4: { total: 0, overridden: 0, decided: 0, approved: 0, rejected: 0 },
  }

  const agentCounts: Record<
    string,
    { total: number; overridden: number }
  > = {}

  let totalActions = 0
  let totalOverridden = 0

  for (const row of rows) {
    const tier = (row.tier >= 1 && row.tier <= 4 ? row.tier : 4) as 1 | 2 | 3 | 4
    totalActions++
    tierCounts[tier].total++

    const isOver = Boolean(row.isOverride)
    if (isOver) {
      totalOverridden++
      tierCounts[tier].overridden++
    }

    // Agent metrics
    const agent = row.agentId || "Unknown"
    if (!agentCounts[agent]) {
      agentCounts[agent] = { total: 0, overridden: 0 }
    }
    agentCounts[agent].total++
    if (isOver) {
      agentCounts[agent].overridden++
    }

    // Tier 3 approval accounting:
    // Statuses that reached approval: approved, executed, failed (after approval)
    // Statuses that reached rejection: rejected
    if (tier === 3) {
      if (
        row.status === "approved" ||
        row.status === "executed" ||
        row.status === "failed"
      ) {
        tierCounts[3].decided++
        tierCounts[3].approved++
      } else if (row.status === "rejected") {
        tierCounts[3].decided++
        tierCounts[3].rejected++
      }
    }
  }

  const round = (val: number) => Number(val.toFixed(2))
  const calcRate = (num: number, den: number) => (den > 0 ? round((num / den) * 100) : 0)

  const makeTierMetric = (t: 1 | 2 | 3 | 4): TierMetric => {
    const data = tierCounts[t]
    if (t === 3) {
      // For Tier 3: overrideRate = rejected / decided (0 when decided is 0)
      return {
        total: data.total,
        overridden: data.rejected,
        decided: data.decided,
        approved: data.approved,
        rejected: data.rejected,
        approvalRate: calcRate(data.approved, data.decided),
        overrideRate: calcRate(data.rejected, data.decided),
      }
    }
    return {
      total: data.total,
      overridden: data.overridden,
      overrideRate: calcRate(data.overridden, data.total),
    }
  }

  const byAgent: Record<string, { total: number; overridden: number; overrideRate: number }> = {}
  for (const [agent, c] of Object.entries(agentCounts)) {
    byAgent[agent] = {
      total: c.total,
      overridden: c.overridden,
      overrideRate: calcRate(c.overridden, c.total),
    }
  }

  return {
    timeRange: {
      from: from ?? null,
      to: to ?? null,
    },
    totalActions,
    totalOverridden,
    overallOverrideRate: calcRate(totalOverridden, totalActions),
    tiers: {
      tier1: makeTierMetric(1),
      tier2: makeTierMetric(2),
      tier3: makeTierMetric(3),
      tier4: makeTierMetric(4),
    },
    byAgent,
  }
}
