/**
 * A2 Workflow — budget threshold evaluation (rules v1).
 *
 * Metric values are supplied by the caller (manual/API). Automatic M2 ledger
 * monitoring is a later milestone — see docs/M4_INTEGRATION_GUIDE.md.
 *
 * Notification for Tier 2 `notified` means Agent Log / audit evidence only —
 * not email, SMS, or push.
 */

export const A2_BUDGET_ACTION_TYPE = "budget_threshold_alert" as const
export const A2_BUDGET_MODEL_VERSION = "a2-budget-threshold-rules-v1" as const
export const A2_BUDGET_SOURCE_V1 = "manual_api_v1" as const

/** Soft dedupe window (no unique DB constraint — see module docs). */
export const A2_BUDGET_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000

const MAX_METRIC_NAME_LEN = 128
const MAX_PERIOD_KEY_LEN = 64
const MAX_ABS_VALUE = 1e15

export type BudgetThresholdInput = {
  metricName: string
  metricValue: number
  threshold: number
  periodKey?: string
  source?: string
  branchId?: string | null
}

export type BudgetThresholdEvaluation = {
  breached: boolean
  metricName: string
  metricValue: number
  threshold: number
  periodKey: string
  source: string
  branchId: string | null
  comparedAt: string
  rule: "metricValue >= threshold"
  dedupeKey: string
}

export type BudgetThresholdValidationError = {
  ok: false
  error: string
}

export type BudgetThresholdValidationOk = {
  ok: true
  value: BudgetThresholdInput & {
    periodKey: string
    source: string
    branchId: string | null
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/**
 * Validate and normalize caller-supplied budget metric fields.
 * Rejects non-finite numbers, empty names, and absurd magnitudes.
 */
export function validateBudgetThresholdInput(
  raw: unknown
): BudgetThresholdValidationOk | BudgetThresholdValidationError {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Body must be a JSON object" }
  }

  const body = raw as Record<string, unknown>

  if (typeof body.metricName !== "string") {
    return { ok: false, error: "metricName must be a string" }
  }
  const metricName = body.metricName.trim()
  if (!metricName || metricName.length > MAX_METRIC_NAME_LEN) {
    return {
      ok: false,
      error: `metricName must be 1 to ${MAX_METRIC_NAME_LEN} characters after trim`,
    }
  }

  if (!isFiniteNumber(body.metricValue)) {
    return { ok: false, error: "metricValue must be a finite number" }
  }
  if (!isFiniteNumber(body.threshold)) {
    return { ok: false, error: "threshold must be a finite number" }
  }
  if (Math.abs(body.metricValue) > MAX_ABS_VALUE || Math.abs(body.threshold) > MAX_ABS_VALUE) {
    return { ok: false, error: "metricValue and threshold exceed allowed magnitude" }
  }
  // Thresholds are limits: must be strictly positive for v1 budget semantics.
  if (body.threshold <= 0) {
    return { ok: false, error: "threshold must be a positive number" }
  }
  // Utilization / spend metrics cannot be negative in v1.
  if (body.metricValue < 0) {
    return { ok: false, error: "metricValue must be greater than or equal to 0" }
  }

  let periodKey = "unspecified"
  if (body.periodKey !== undefined) {
    if (typeof body.periodKey !== "string") {
      return { ok: false, error: "periodKey must be a string when provided" }
    }
    periodKey = body.periodKey.trim() || "unspecified"
    if (periodKey.length > MAX_PERIOD_KEY_LEN) {
      return {
        ok: false,
        error: `periodKey must be at most ${MAX_PERIOD_KEY_LEN} characters`,
      }
    }
  }

  let source = A2_BUDGET_SOURCE_V1
  if (body.source !== undefined) {
    if (typeof body.source !== "string") {
      return { ok: false, error: "source must be a string when provided" }
    }
    const trimmed = body.source.trim()
    if (!trimmed || trimmed.length > 64) {
      return { ok: false, error: "source must be 1 to 64 characters after trim" }
    }
    // v1 only accepts the documented manual source (blocks pretending to be M2).
    if (trimmed !== A2_BUDGET_SOURCE_V1) {
      return {
        ok: false,
        error: `source must be "${A2_BUDGET_SOURCE_V1}" until M2 monitoring exists`,
      }
    }
    source = trimmed
  }

  let branchId: string | null = null
  if (body.branchId !== undefined && body.branchId !== null) {
    if (typeof body.branchId !== "string" || !UUID_RE.test(body.branchId.trim())) {
      return { ok: false, error: "branchId must be a valid UUID when provided" }
    }
    branchId = body.branchId.trim()
  }

  return {
    ok: true,
    value: {
      metricName,
      metricValue: body.metricValue,
      threshold: body.threshold,
      periodKey,
      source,
      branchId,
    },
  }
}

export function buildBudgetDedupeKey(input: {
  metricName: string
  threshold: number
  periodKey: string
  source: string
  branchId: string | null
}): string {
  const branch = input.branchId ?? "none"
  return [
    "a2-budget-v1",
    input.source,
    input.periodKey,
    input.metricName,
    String(input.threshold),
    branch,
  ].join("|")
}

/**
 * Pure threshold rule: breach when metricValue >= threshold (equality counts).
 */
export function evaluateBudgetThreshold(
  input: BudgetThresholdInput & {
    periodKey: string
    source: string
    branchId: string | null
  }
): BudgetThresholdEvaluation {
  const breached = input.metricValue >= input.threshold
  const comparedAt = new Date().toISOString()
  const dedupeKey = buildBudgetDedupeKey(input)
  return {
    breached,
    metricName: input.metricName,
    metricValue: input.metricValue,
    threshold: input.threshold,
    periodKey: input.periodKey,
    source: input.source,
    branchId: input.branchId,
    comparedAt,
    rule: "metricValue >= threshold",
    dedupeKey,
  }
}

export function buildBudgetBreachInputPayload(
  evaluation: BudgetThresholdEvaluation
): Record<string, unknown> {
  return {
    agentId: "A2",
    actionType: A2_BUDGET_ACTION_TYPE,
    evaluation,
    dedupeKey: evaluation.dedupeKey,
    notificationIntent: {
      channel: "agent_log",
      email: false,
      sms: false,
      push: false,
      note: "Tier 2 notified = Agent Log / audit evidence only (A2 v1)",
    },
  }
}

export function buildBudgetBreachActionText(evaluation: BudgetThresholdEvaluation): string {
  return (
    `A2 budget threshold breached: ${evaluation.metricName} ` +
    `${evaluation.metricValue} >= ${evaluation.threshold} ` +
    `(period=${evaluation.periodKey})`
  )
}

/**
 * Best-effort duplicate detection without a DB unique constraint.
 *
 * Trade-off: TOCTOU race — two concurrent requests can both pass this check
 * and create two rows. Acceptable for v1; a unique index would require a migration.
 */
export function findRecentBudgetDedupeMatch<
  T extends { id: string; inputPayload?: unknown; createdAt: Date },
>(
  rows: T[],
  dedupeKey: string,
  nowMs: number = Date.now(),
  windowMs: number = A2_BUDGET_DEDUPE_WINDOW_MS
): T | null {
  const cutoff = nowMs - windowMs
  for (const row of rows) {
    if (row.createdAt.getTime() < cutoff) continue
    const payload = row.inputPayload
    if (
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      (payload as Record<string, unknown>).dedupeKey === dedupeKey
    ) {
      return row
    }
  }
  return null
}
