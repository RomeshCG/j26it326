/**
 * Agent Governance Routes (/api/tenant/agent-actions)
 *
 * Implements Graduated Trust action listing, Tier 3 approval/rejection,
 * human overrides, and override rate metrics.
 */

import { Router, type Request, type Response } from "express"
import { requireRole } from "../middleware/auth.js"
import {
  ROLES,
  hasCapability,
  isValidRole,
  type RoleName,
} from "../lib/permissions.js"
import { logSafeError } from "../lib/auth.js"
import {
  isValidUuid,
  dispatchAgentAction,
  decideTier3Action,
  overrideAction,
  type TenantPrisma,
} from "../lib/agent-engine.js"
import { computeOverrideRates } from "../lib/agent-engine-core.js"
import {
  A1_CBSL_ACTION_TYPE,
  A1_MODEL_VERSION,
  A1_PREPARE_AUDIT_ACTION,
  A1_REPORT_KIND,
  A1_RULESET_VERSION,
  buildA1ActionText,
  buildA1InputPayload,
  buildA1PrepareAuditDetails,
  buildA1ToolsUsed,
  computeA1ProposalHash,
  evaluateA1ApproveGate,
  isA1ReadinessInputPayload,
  prepareA1ReadinessReport,
  roleMayPrepareA1,
  validateA1PrepareBody,
  type A1TenantPrisma,
} from "../lib/agent-a1-compliance.js"
import { capDetails } from "../lib/agent-engine-core.js"
import {
  A2_BUDGET_ACTION_TYPE,
  A2_BUDGET_DEDUPE_WINDOW_MS,
  A2_BUDGET_MODEL_VERSION,
  buildBudgetBreachActionText,
  buildBudgetBreachInputPayload,
  evaluateBudgetThreshold,
  findRecentBudgetDedupeMatch,
  validateBudgetThresholdInput,
} from "../lib/agent-a2-budget.js"
import {
  A4_NLQ_ACTION_TYPE,
  A4_NLQ_MODEL_VERSION,
  A4_NLQ_PROMPT_VERSION,
  buildNlqActionText,
  buildNlqAnswer,
  buildNlqInputPayload,
  buildNlqIntentSystemPrompt,
  buildNlqToolsUsed,
  questionSuggestsNlqCountIntent,
  resolveNlqIntentFromModel,
  roleMayRunNlqIntent,
  runNlqTool,
  validateNlqQuestion,
  type NlqTenantPrisma,
} from "../lib/agent-a4-nlq.js"
import { DEFAULT_AGENT_POLICIES } from "../lib/agent-defaults.js"
import {
  A4_KNOWLEDGE_DISCLAIMER,
  A4_KNOWLEDGE_MODEL_VERSION,
  A4_KNOWLEDGE_PROMPT_VERSION,
  hardRefuseA4Question,
  isA4KnowledgeStrictPromptEnabled,
  knowledgeGenerationMetaFromOutcome,
  resolveGroundedMicroFlowKnowledge,
  resolveKnowledgeWithOptionalLengthRetry,
  unsupportedMessageForReason,
  type A4KnowledgeGenerationMeta,
} from "../lib/agent-a4-knowledge.js"
import {
  domainGateTelemetry,
  resolveA4KnowledgeDomainGate,
} from "../lib/a4-domain-gate.js"
import {
  OllamaUnavailableError,
  ollamaChatJson,
  type OllamaErrorCode,
} from "../lib/ollama-client.js"
import type { Prisma } from "../../node_modules/.prisma/tenant-client/index.js"

export const agentGovernanceRouter = Router()

// Role capability filters per IMFS RBAC
export const VIEW_ACTIONS_ROLES: RoleName[] = ROLES.filter((r) =>
  hasCapability(r, "agents:view_actions")
)
export const DECIDE_TIER3_ROLES: RoleName[] = ROLES.filter((r) =>
  hasCapability(r, "agents:decide_tier3")
)
export const ADMIN_ROLES: RoleName[] = ROLES.filter((r) =>
  hasCapability(r, "agents:manage_policies")
)

/**
 * Who may trigger A2 budget-threshold evaluation (creates agent actions).
 *
 * Not `agents:view_actions` alone (read-only log access).
 * Uses existing capabilities:
 * - `agents:decide_tier3` — governance write path (admin, executive, branch_manager)
 * - `finance:manage_ledger` — budget domain (finance_officer)
 */
export const BUDGET_THRESHOLD_EVAL_ROLES: RoleName[] = ROLES.filter(
  (r) =>
    hasCapability(r, "agents:decide_tier3") ||
    hasCapability(r, "finance:manage_ledger")
)

/**
 * Who may call A4 NLQ (endpoint gate). Per-intent tools still require
 * agents:decide_tier3 (pending) or agents:view_actions (action window).
 */
export const NLQ_QUERY_ROLES: RoleName[] = ROLES.filter((r) =>
  hasCapability(r, "agents:query_nlq")
)

/**
 * Who may prepare A1 CBSL readiness packages (Tier 3 pending).
 * Approve/reject remain DECIDE_TIER3_ROLES only (SoD: finance may prepare).
 */
export const A1_PREPARE_ROLES: RoleName[] = ROLES.filter((r) =>
  roleMayPrepareA1(r)
)

export const KNOWN_STATUSES = new Set([
  "running",
  "pending_approval",
  "approved",
  "rejected",
  "executed",
  "notified",
  "alert_only",
  "failed",
])

export const KNOWN_AGENT_IDS = new Set(["A1", "A2", "A3", "A4"])

/**
 * Hard caps to prevent large result sets from causing unbounded memory consumption.
 */
export const MAX_PENDING_TAKE = 500
export const MAX_METRICS_TAKE = 501
export const MAX_METRICS_ROW_CAP = 500

/**
 * Lightweight select projection: strictly omits input_payload and output_payload
 * to avoid leaking raw sensitive data in list queries.
 */
export const LIGHTWEIGHT_ACTION_SELECT: Prisma.AgentActionSelect = {
  id: true,
  policyId: true,
  agentId: true,
  agentName: true,
  tier: true,
  action: true,
  reason: true,
  confidence: true,
  modelVersion: true,
  promptVersion: true,
  toolsUsed: true,
  status: true,
  isOverride: true,
  decisionReason: true,
  approvedBy: true,
  decidedAt: true,
  processingTimeMs: true,
  createdAt: true,
}

// ----------------------------------------------------------------------------
// Handler functions (exported for isolated unit testing with fake req/res)
// ----------------------------------------------------------------------------

/**
 * GET /agent-actions
 * Lists agent actions with filtering and pagination. Omit payloads.
 */
export async function handleListAgentActions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const { tier, status, agentId, from, to, page, limit } = req.query

    const where: Prisma.AgentActionWhereInput = {}

    // 1. Tier filter (1-4)
    if (tier !== undefined && tier !== "") {
      const parsedTier = Number.parseInt(String(tier), 10)
      if (![1, 2, 3, 4].includes(parsedTier)) {
        res.status(400).json({ error: "Invalid tier filter. Must be 1, 2, 3, or 4" })
        return
      }
      where.tier = parsedTier
    }

    // 2. Status filter
    if (status !== undefined && status !== "") {
      const statusStr = String(status).trim()
      if (!KNOWN_STATUSES.has(statusStr)) {
        res.status(400).json({ error: `Invalid status filter '${statusStr}'` })
        return
      }
      where.status = statusStr
    }

    // 3. Agent ID filter (A1-A4)
    if (agentId !== undefined && agentId !== "") {
      const agentIdStr = String(agentId).trim()
      if (!KNOWN_AGENT_IDS.has(agentIdStr)) {
        res.status(400).json({ error: `Invalid agentId filter. Must be A1, A2, A3, or A4` })
        return
      }
      where.agentId = agentIdStr
    }

    // 4. Date range filter
    if ((from !== undefined && from !== "") || (to !== undefined && to !== "")) {
      const createdAtFilter: Prisma.DateTimeFilter = {}
      if (from !== undefined && from !== "") {
        const parsedFrom = Date.parse(String(from))
        if (Number.isNaN(parsedFrom)) {
          res.status(400).json({ error: "Invalid from date filter. Must be ISO-8601 string" })
          return
        }
        createdAtFilter.gte = new Date(parsedFrom)
      }
      if (to !== undefined && to !== "") {
        const parsedTo = Date.parse(String(to))
        if (Number.isNaN(parsedTo)) {
          res.status(400).json({ error: "Invalid to date filter. Must be ISO-8601 string" })
          return
        }
        createdAtFilter.lte = new Date(parsedTo)
      }
      where.createdAt = createdAtFilter
    }

    // 5. Pagination
    let pageNum = 1
    if (page !== undefined && page !== "") {
      pageNum = Number.parseInt(String(page), 10)
      if (Number.isNaN(pageNum) || pageNum < 1) {
        res.status(400).json({ error: "Invalid page parameter. Must be an integer >= 1" })
        return
      }
    }

    let limitNum = 25
    if (limit !== undefined && limit !== "") {
      limitNum = Number.parseInt(String(limit), 10)
      if (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        res.status(400).json({ error: "Invalid limit parameter. Must be between 1 and 100" })
        return
      }
    }

    const skip = (pageNum - 1) * limitNum
    const orderBy: Prisma.AgentActionOrderByWithRelationInput = { createdAt: "desc" }

    const actions = await tenantPrisma.agentAction.findMany({
      where,
      select: LIGHTWEIGHT_ACTION_SELECT,
      orderBy,
      skip,
      take: limitNum,
    })

    res.json({
      data: actions,
      page: pageNum,
      limit: limitNum,
      count: actions.length,
    })
  } catch (err: unknown) {
    logSafeError("[agent-governance] List actions error", err)
    res.status(500).json({ error: "Failed to query agent actions" })
  }
}

/**
 * GET /agent-actions/pending
 * Lists pending Tier 3 actions requiring human approval. Omit payloads.
 * Capped at MAX_PENDING_TAKE to prevent unbounded memory loading.
 */
export async function handleListPendingActions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma

    const where: Prisma.AgentActionWhereInput = {
      tier: 3,
      status: "pending_approval",
    }
    const orderBy: Prisma.AgentActionOrderByWithRelationInput = { createdAt: "asc" }

    const pendingActions = await tenantPrisma.agentAction.findMany({
      where,
      select: LIGHTWEIGHT_ACTION_SELECT,
      orderBy,
      take: MAX_PENDING_TAKE,
    })

    res.json({
      data: pendingActions,
      count: pendingActions.length,
    })
  } catch (err: unknown) {
    logSafeError("[agent-governance] List pending error", err)
    res.status(500).json({ error: "Failed to load pending actions" })
  }
}

/**
 * GET /agent-actions/metrics/override-rates
 * Computes override and approval rates over a date range (default last 30 days).
 * Capped at MAX_METRICS_TAKE to prevent unbounded memory loading.
 */
export async function handleGetOverrideRates(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const { from, to } = req.query

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    let fromDate = thirtyDaysAgo
    if (from !== undefined && from !== "") {
      const parsedFrom = Date.parse(String(from))
      if (Number.isNaN(parsedFrom)) {
        res.status(400).json({ error: "Invalid from date filter. Must be ISO-8601 string" })
        return
      }
      fromDate = new Date(parsedFrom)
    }

    let toDate = now
    if (to !== undefined && to !== "") {
      const parsedTo = Date.parse(String(to))
      if (Number.isNaN(parsedTo)) {
        res.status(400).json({ error: "Invalid to date filter. Must be ISO-8601 string" })
        return
      }
      toDate = new Date(parsedTo)
    }

    if (fromDate > toDate) {
      res.status(400).json({ error: "from date must be prior to or equal to to date" })
      return
    }

    const where: Prisma.AgentActionWhereInput = {
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    }

    const rows = await tenantPrisma.agentAction.findMany({
      where,
      select: {
        tier: true,
        agentId: true,
        isOverride: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_METRICS_TAKE,
    })

    const isCapped = rows.length > MAX_METRICS_ROW_CAP
    const rowsToProcess = isCapped ? rows.slice(0, MAX_METRICS_ROW_CAP) : rows

    const metrics = computeOverrideRates(
      rowsToProcess,
      fromDate.toISOString(),
      toDate.toISOString()
    )

    res.json({
      data: {
        ...metrics,
        capped: isCapped,
      },
      capped: isCapped,
    })
  } catch (err: unknown) {
    logSafeError("[agent-governance] Override rates error", err)
    res.status(500).json({ error: "Failed to compute override rates" })
  }
}

/**
 * GET /agent-actions/:id
 * Fetches a single agent action by UUID, INCLUDING raw input and output payloads.
 */
export async function handleGetActionById(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const actionId = String(req.params.id).trim()

    if (!isValidUuid(actionId)) {
      res.status(400).json({ error: "Invalid action ID format. Must be a valid UUID" })
      return
    }

    const action = await tenantPrisma.agentAction.findUnique({
      where: { id: actionId },
    })

    if (!action) {
      res.status(404).json({ error: "Agent action not found" })
      return
    }

    res.json({ data: action })
  } catch (err: unknown) {
    logSafeError("[agent-governance] Get action error", err)
    res.status(500).json({ error: "Failed to load agent action" })
  }
}

/**
 * POST /agent-actions/:id/approve
 * Approves a pending Tier 3 action and executes its handler.
 * A1 readiness packages get an extra SoD + prepare-audit hash gate (A1-only).
 */
export async function handleApproveAction(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const actionId = String(req.params.id).trim()

    if (!isValidUuid(actionId)) {
      res.status(400).json({ error: "Invalid action ID format. Must be a valid UUID" })
      return
    }

    const { reason } = req.body ?? {}
    const userId = req.user!.userId

    const existing = await tenantPrisma.agentAction.findUnique({
      where: { id: actionId },
      select: {
        id: true,
        status: true,
        tier: true,
        inputPayload: true,
      },
    })

    if (
      existing &&
      existing.tier === 3 &&
      existing.status === "pending_approval" &&
      isA1ReadinessInputPayload(existing.inputPayload)
    ) {
      const prepareAudit = await tenantPrisma.auditLog.findFirst({
        where: {
          action: A1_PREPARE_AUDIT_ACTION,
          details: {
            path: ["actionId"],
            equals: actionId,
          },
        },
        orderBy: { createdAt: "desc" },
        select: { details: true },
      })

      const gate = evaluateA1ApproveGate({
        inputPayload: existing.inputPayload,
        approverUserId: userId,
        prepareAuditDetails: prepareAudit?.details ?? null,
      })
      if (!gate.ok) {
        res.status(gate.httpStatus).json({ error: gate.error })
        return
      }
    }

    const result = await decideTier3Action(tenantPrisma, {
      actionId,
      decision: "approve",
      reason,
      userId,
      ip: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string) ?? null,
    })

    if (result.status === "ok") {
      res.status(200).json(result)
    } else if (result.status === "conflict") {
      res.status(409).json({ error: result.error })
    } else {
      res.status(400).json({ error: result.error })
    }
  } catch (err: unknown) {
    logSafeError("[agent-governance] Approve action error", err)
    res.status(500).json({ error: "Failed to approve action" })
  }
}

/**
 * POST /agent-actions/:id/reject
 * Rejects a pending Tier 3 action, setting status rejected and is_override true.
 */
export async function handleRejectAction(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const actionId = String(req.params.id).trim()

    if (!isValidUuid(actionId)) {
      res.status(400).json({ error: "Invalid action ID format. Must be a valid UUID" })
      return
    }

    const { reason } = req.body ?? {}
    const userId = req.user!.userId

    const result = await decideTier3Action(tenantPrisma, {
      actionId,
      decision: "reject",
      reason,
      userId,
      ip: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string) ?? null,
    })

    if (result.status === "ok") {
      res.status(200).json(result)
    } else if (result.status === "conflict") {
      res.status(409).json({ error: result.error })
    } else {
      res.status(400).json({ error: result.error })
    }
  } catch (err: unknown) {
    logSafeError("[agent-governance] Reject action error", err)
    res.status(500).json({ error: "Failed to reject action" })
  }
}

/**
 * POST /agent-actions/:id/override
 * Overrides an executed/notified Tier 1 or 2 action.
 */
export async function handleOverrideAction(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const actionId = String(req.params.id).trim()

    if (!isValidUuid(actionId)) {
      res.status(400).json({ error: "Invalid action ID format. Must be a valid UUID" })
      return
    }

    const { reason } = req.body ?? {}
    const userId = req.user!.userId

    const result = await overrideAction(tenantPrisma, {
      actionId,
      reason,
      userId,
      ip: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string) ?? null,
    })

    if (result.status === "ok") {
      res.status(200).json(result)
    } else if (result.status === "conflict") {
      res.status(409).json({ error: result.error })
    } else {
      res.status(400).json({ error: result.error })
    }
  } catch (err: unknown) {
    logSafeError("[agent-governance] Override action error", err)
    res.status(500).json({ error: "Failed to override action" })
  }
}

/**
 * POST /agent-actions/cbsl-report/prepare
 *
 * A1 v1: collect tenant evidence → deterministic readiness rules →
 * dispatch `generate_cbsl_report` as Tier 3 pending_approval.
 * Report kind `cbsl_readiness_v1` — not an official CBSL submission.
 */
export async function handlePrepareCbslReadiness(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const roleRaw = req.user?.role
    if (!roleRaw || !isValidRole(roleRaw)) {
      res.status(403).json({ error: "Authenticated role is missing or invalid" })
      return
    }
    if (!roleMayPrepareA1(roleRaw)) {
      res.status(403).json({ error: "Insufficient permissions to prepare A1 readiness package" })
      return
    }

    const validated = validateA1PrepareBody(req.body ?? {})
    if (!validated.ok) {
      res.status(400).json({ error: validated.error })
      return
    }

    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const preparedByUserId = req.user!.userId
    const report = await prepareA1ReadinessReport(
      tenantPrisma as unknown as A1TenantPrisma,
      validated.period
    )
    const proposalHash = computeA1ProposalHash(report)
    const inputPayload = buildA1InputPayload(report, { preparedByUserId })

    const result = await dispatchAgentAction(tenantPrisma, {
      actionType: A1_CBSL_ACTION_TYPE,
      action: buildA1ActionText(report),
      reason:
        `A1 rules v1: prepared ${A1_REPORT_KIND} package ` +
        `(overallStatus=${report.overallStatus}). Awaiting Tier 3 human review. ` +
        `Not an official CBSL submission.`,
      modelVersion: A1_MODEL_VERSION,
      promptVersion: A1_RULESET_VERSION,
      toolsUsed: buildA1ToolsUsed(report, { proposalHash, preparedByUserId }),
      inputPayload,
      ip: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string) ?? null,
    })

    if (result.status === "ok") {
      // Independent prepare binding (no schema change). Not DB-admin-proof.
      await tenantPrisma.auditLog.create({
        data: {
          actorType: "user",
          actorId: preparedByUserId,
          action: A1_PREPARE_AUDIT_ACTION,
          resource: "agent_actions",
          ipAddress: req.ip ?? null,
          userAgent: (req.headers["user-agent"] as string) ?? null,
          details: capDetails(
            buildA1PrepareAuditDetails({
              actionId: result.actionId,
              proposalHash,
              preparedByUserId,
              overallStatus: report.overallStatus,
            })
          ) as Prisma.InputJsonValue,
        },
      })

      res.status(200).json({
        prepared: true,
        reportKind: A1_REPORT_KIND,
        overallStatus: report.overallStatus,
        proposalHash,
        preparedByUserId,
        report,
        dispatch: result,
        note:
          "Package is pending Tier 3 approval. A different authorized user must approve. " +
          "Not an official CBSL submission.",
      })
      return
    }
    if (result.status === "conflict") {
      res.status(409).json({ error: result.error })
      return
    }
    res.status(400).json({ error: result.error })
  } catch (err: unknown) {
    logSafeError("[agent-governance] A1 CBSL readiness prepare error", err)
    res.status(500).json({ error: "Failed to prepare CBSL readiness package" })
  }
}

/**
 * POST /agent-actions/budget-threshold/evaluate
 *
 * A2 v1: evaluate caller-supplied metric vs threshold; dispatch
 * `budget_threshold_alert` only on breach. Tier comes from active policy only.
 *
 * Query: allowDuplicate=true skips soft dedupe (for explicit re-tests).
 */
export async function handleEvaluateBudgetThreshold(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const validated = validateBudgetThresholdInput(req.body ?? {})
    if (!validated.ok) {
      res.status(400).json({ error: validated.error })
      return
    }

    const evaluation = evaluateBudgetThreshold(validated.value)
    if (!evaluation.breached) {
      res.status(200).json({
        breached: false,
        dispatched: false,
        evaluation,
        notification: {
          channel: "agent_log",
          note: "No dispatch — metric below threshold. notified status unused.",
        },
      })
      return
    }

    const allowDuplicate =
      String(req.query.allowDuplicate ?? "").toLowerCase() === "true"

    if (!allowDuplicate) {
      // Soft dedupe: recent A2 notified rows in this tenant only (tenantPrisma).
      // TOCTOU: concurrent requests may still double-insert — no unique index in v1.
      const recent = await tenantPrisma.agentAction.findMany({
        where: {
          agentId: "A2",
          status: "notified",
          createdAt: {
            gte: new Date(Date.now() - A2_BUDGET_DEDUPE_WINDOW_MS),
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          inputPayload: true,
          createdAt: true,
          status: true,
        },
      })
      const match = findRecentBudgetDedupeMatch(recent, evaluation.dedupeKey)
      if (match) {
        res.status(200).json({
          breached: true,
          dispatched: false,
          duplicate: true,
          existingActionId: match.id,
          evaluation,
          notification: {
            channel: "agent_log",
            note: "Soft dedupe: recent matching notified action exists (24h window).",
          },
        })
        return
      }
    }

    const inputPayload = buildBudgetBreachInputPayload(evaluation)
    const result = await dispatchAgentAction(tenantPrisma, {
      actionType: A2_BUDGET_ACTION_TYPE,
      action: buildBudgetBreachActionText(evaluation),
      reason:
        `A2 rules v1: ${evaluation.metricName} reached or exceeded threshold ` +
        `(Agent Log notification only; no email/SMS/push).`,
      modelVersion: A2_BUDGET_MODEL_VERSION,
      inputPayload,
      // Never accept tier/agentId from the client — policy resolves them.
      ip: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string) ?? null,
    })

    if (result.status === "ok") {
      res.status(200).json({
        breached: true,
        dispatched: true,
        duplicate: false,
        evaluation,
        dispatch: result,
        notification: {
          channel: "agent_log",
          email: false,
          sms: false,
          push: false,
          note: "Tier 2 notified = Agent Log / audit evidence only (A2 v1).",
        },
      })
      return
    }
    if (result.status === "conflict") {
      res.status(409).json({ error: result.error })
      return
    }
    res.status(400).json({ error: result.error })
  } catch (err: unknown) {
    logSafeError("[agent-governance] Budget threshold evaluate error", err)
    res.status(500).json({ error: "Failed to evaluate budget threshold" })
  }
}

/** Safe 503 payload — keep legacy `error` string; add code/stage/durationMs. */
function respondOllamaUnavailable(
  res: Response,
  err: OllamaUnavailableError,
  stage: "nlq_intent" | "knowledge",
  durationMs: number,
  knowledgeGeneration?: A4KnowledgeGenerationMeta
): void {
  const code: OllamaErrorCode = err.code
  // Log diagnostics without URLs/prompts (message already redacts URLs).
  const kg =
    knowledgeGeneration != null
      ? ` attempts=${knowledgeGeneration.attempts}` +
        ` retriedForLength=${knowledgeGeneration.retriedForLength}` +
        ` attemptDurationsMs=${knowledgeGeneration.attemptDurationsMs.join(",")}` +
        ` numPredict=${knowledgeGeneration.numPredict}`
      : ""
  console.warn(
    `[agent-governance] Ollama unavailable stage=${stage} code=${code}` +
      ` durationMs=${durationMs}` +
      (err.httpStatus != null ? ` httpStatus=${err.httpStatus}` : "") +
      kg
  )
  res.status(503).json({
    error: "NLQ model unavailable",
    code,
    stage,
    durationMs,
    ...(knowledgeGeneration ? { knowledgeGeneration } : {}),
  })
}

function knowledgeResponseBody(
  answer: string,
  extras?: {
    ollamaModel?: string
    groundedTopic?: string
    knowledgeGeneration?: A4KnowledgeGenerationMeta
    domainGate?: Record<string, unknown>
  }
) {
  return {
    kind: "knowledge" as const,
    supported: true,
    dispatched: false,
    answer,
    disclaimer: A4_KNOWLEDGE_DISCLAIMER,
    modelVersion: A4_KNOWLEDGE_MODEL_VERSION,
    promptVersion: A4_KNOWLEDGE_PROMPT_VERSION,
    ...(isA4KnowledgeStrictPromptEnabled()
      ? { knowledgeStrictPrompt: true }
      : {}),
    ...(extras?.ollamaModel ? { ollamaModel: extras.ollamaModel } : {}),
    ...(extras?.groundedTopic
      ? { groundedTopic: extras.groundedTopic, grounded: true }
      : {}),
    ...(extras?.knowledgeGeneration
      ? { knowledgeGeneration: extras.knowledgeGeneration }
      : {}),
    ...(extras?.domainGate ? { domainGate: extras.domainGate } : {}),
  }
}

/**
 * POST /agent-actions/nlq/query
 *
 * A4: (1) Node hard-refuse → (2) a4-intent-v2 NLQ counts + Tier 1 dispatch
 * only when lexical count cues exist → (3) grounded MicroFlow product copy →
 * (4) optional generative knowledge (no dispatch). Numbers never come from the
 * model on the NLQ path. Knowledge answers are educational only.
 */
export async function handleNlqQuery(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const validated = validateNlqQuestion(req.body ?? {})
    if (!validated.ok) {
      res.status(400).json({ error: validated.error })
      return
    }

    const roleRaw = req.user?.role
    if (!roleRaw || !isValidRole(roleRaw)) {
      res.status(403).json({ error: "Authenticated role is missing or invalid" })
      return
    }
    const role = roleRaw
    const question = validated.question

    const hardRefuse = hardRefuseA4Question(question)
    if (hardRefuse) {
      res.status(200).json({
        kind: "unsupported",
        supported: false,
        dispatched: false,
        reason: hardRefuse,
        message: unsupportedMessageForReason(hardRefuse),
      })
      return
    }

    // P0: skip a4-intent-v2 Ollama unless lexical count evidence exists.
    // Same fail-closed gate as post-model questionSupportsIntent — no DB
    // counts without cues (ambiguous/mixed already hard-refused above).
    let nlqUnsupportedReason: string | null = null

    if (questionSuggestsNlqCountIntent(question)) {
      let ollamaModel: string
      let rawContent: string
      const nlqStarted = Date.now()
      try {
        const chat = await ollamaChatJson({
          messages: [
            { role: "system", content: buildNlqIntentSystemPrompt() },
            { role: "user", content: question },
          ],
        })
        ollamaModel = chat.model
        rawContent = chat.content
      } catch (err: unknown) {
        if (err instanceof OllamaUnavailableError) {
          respondOllamaUnavailable(
            res,
            err,
            "nlq_intent",
            Date.now() - nlqStarted
          )
          return
        }
        throw err
      }

      const parsed = resolveNlqIntentFromModel(question, rawContent)
      if (parsed.status === "invalid") {
        res.status(422).json({ error: parsed.reason })
        return
      }

      if (parsed.status === "ok") {
        if (!roleMayRunNlqIntent(role, parsed.value.intent)) {
          const message =
            parsed.value.intent === "count_pending_tier3"
              ? "Not authorized for pending Tier 3 metrics"
              : "Not authorized for agent action metrics"
          res.status(403).json({ error: message })
          return
        }

        const tenantPrisma = req.tenantPrisma as TenantPrisma
        const facts = await runNlqTool(
          tenantPrisma as unknown as NlqTenantPrisma,
          parsed.value
        )
        const answer = buildNlqAnswer(facts)
        const inputPayload = buildNlqInputPayload({
          question,
          facts,
          answer,
          ollamaModel,
        })

        // Identity for audit/Agent Log labeling. Policy still owns tier;
        // missing/inactive nlq_query policy remains Tier 4 alert_only.
        const nlqDefault = DEFAULT_AGENT_POLICIES.find(
          (p) => p.actionType === A4_NLQ_ACTION_TYPE
        )
        const result = await dispatchAgentAction(tenantPrisma, {
          actionType: A4_NLQ_ACTION_TYPE,
          action: buildNlqActionText(question, facts),
          reason:
            "A4 NLQ v1: grounded tenant agent_actions count; answer from template only.",
          modelVersion: A4_NLQ_MODEL_VERSION,
          promptVersion: A4_NLQ_PROMPT_VERSION,
          toolsUsed: buildNlqToolsUsed(facts),
          inputPayload,
          agentId: nlqDefault?.agentId ?? "A4",
          agentName: nlqDefault?.agentName ?? "NLQ",
          ip: req.ip ?? null,
          userAgent: (req.headers["user-agent"] as string) ?? null,
        })

        if (result.status === "ok") {
          res.status(200).json({
            kind: "nlq",
            supported: true,
            dispatched: true,
            intent: facts.intent,
            answer,
            facts,
            dispatch: result,
          })
          return
        }
        if (result.status === "conflict") {
          res.status(409).json({ error: result.error })
          return
        }
        res.status(400).json({ error: result.error })
        return
      }

      nlqUnsupportedReason = parsed.reason
    }

    // Grounded MicroFlow product facts (no Ollama) before generative path
    const grounded = resolveGroundedMicroFlowKnowledge(question)
    if (grounded.ok) {
      res.status(200).json(
        knowledgeResponseBody(grounded.answer, {
          groundedTopic: grounded.topic,
        })
      )
      return
    }

    // Domain gate: Stage-0 (mode=off) or Stage-0+ML shadow/enforce.
    // ML never runs on NLQ/RBAC/hardRefuse paths above. Enforce default off.
    // Hybrid/ml_tau can rescue Stage-0 false refuses; never grants live data tools.
    const domainGate = resolveA4KnowledgeDomainGate(question)
    const gateMeta = domainGateTelemetry(domainGate)
    if (domainGate.mode === "shadow") {
      console.info(
        "[a4-domain-gate:shadow]",
        JSON.stringify(gateMeta)
      )
    }
    if (!domainGate.allowKnowledge) {
      res.status(200).json({
        kind: "unsupported",
        supported: false,
        dispatched: false,
        reason: "off_topic",
        message: unsupportedMessageForReason("off_topic"),
        ...(domainGate.mode !== "off" ? { domainGate: gateMeta } : {}),
      })
      return
    }

    // Generative knowledge (no agent_actions dispatch). At most one length retry.
    const knowledgeStarted = Date.now()
    let partialKnowledgeMeta: A4KnowledgeGenerationMeta | undefined
    let knowledgeOutcome: Awaited<
      ReturnType<typeof resolveKnowledgeWithOptionalLengthRetry>
    >
    try {
      knowledgeOutcome = await resolveKnowledgeWithOptionalLengthRetry({
        question,
        onAttemptComplete: (meta) => {
          partialKnowledgeMeta = meta
        },
        chat: (args) =>
          ollamaChatJson({
            messages: args.messages,
            temperature: args.temperature,
            numPredict: args.numPredict,
            timeoutMs: args.timeoutMs,
          }),
      })
    } catch (err: unknown) {
      if (err instanceof OllamaUnavailableError) {
        respondOllamaUnavailable(
          res,
          err,
          "knowledge",
          Date.now() - knowledgeStarted,
          partialKnowledgeMeta
        )
        return
      }
      throw err
    }

    const knowledgeMeta = knowledgeGenerationMetaFromOutcome(knowledgeOutcome)
    const knowledge = knowledgeOutcome.result
    if (knowledge.status === "ok") {
      res.status(200).json(
        knowledgeResponseBody(knowledge.answer, {
          ollamaModel: knowledgeOutcome.model,
          knowledgeGeneration: knowledgeMeta,
          ...(domainGate.mode !== "off" ? { domainGate: gateMeta } : {}),
        })
      )
      return
    }

    const reason =
      knowledge.status === "unsupported" || knowledge.status === "invalid"
        ? knowledge.reason
        : (nlqUnsupportedReason ?? "unsupported")
    res.status(200).json({
      kind: "unsupported",
      supported: false,
      dispatched: false,
      reason,
      message: unsupportedMessageForReason(reason),
      knowledgeGeneration: knowledgeMeta,
      ...(domainGate.mode !== "off" ? { domainGate: gateMeta } : {}),
    })
  } catch (err: unknown) {
    logSafeError("[agent-governance] NLQ query error", err)
    res.status(500).json({ error: "Failed to process NLQ query" })
  }
}

/**
 * POST /agent-actions/test-dispatch
 * Manually dispatches an agent action through the governance engine.
 * Admin only. Strictly disabled in production.
 * Tier cannot be specified via body; it is always resolved by active policy.
 */
export async function handleTestDispatchAction(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({ error: "Test dispatch is disabled in production" })
      return
    }

    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const { actionType, action, reason, inputPayload } = req.body ?? {}

    const result = await dispatchAgentAction(tenantPrisma, {
      actionType: String(actionType ?? "").trim(),
      action: String(action ?? "").trim(),
      reason: reason !== undefined ? String(reason) : undefined,
      inputPayload,
      ip: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string) ?? null,
    })

    if (result.status === "ok") {
      res.status(200).json(result)
    } else if (result.status === "conflict") {
      res.status(409).json({ error: result.error })
    } else {
      res.status(400).json({ error: result.error })
    }
  } catch (err: unknown) {
    logSafeError("[agent-governance] Test dispatch error", err)
    res.status(500).json({ error: "Failed to dispatch test action" })
  }
}

// ----------------------------------------------------------------------------
// Route Registrations
// ----------------------------------------------------------------------------

// List actions (view permission)
agentGovernanceRouter.get(
  "/",
  requireRole(...VIEW_ACTIONS_ROLES),
  handleListAgentActions
)

// Pending Tier 3 actions (decide permission)
agentGovernanceRouter.get(
  "/pending",
  requireRole(...DECIDE_TIER3_ROLES),
  handleListPendingActions
)

// Override rate metrics - registered strictly BEFORE /:id
agentGovernanceRouter.get(
  "/metrics/override-rates",
  requireRole(...DECIDE_TIER3_ROLES),
  handleGetOverrideRates
)

// A1 CBSL readiness prepare — registered strictly BEFORE /:id
agentGovernanceRouter.post(
  "/cbsl-report/prepare",
  requireRole(...A1_PREPARE_ROLES),
  handlePrepareCbslReadiness
)

// A2 budget threshold evaluate — registered strictly BEFORE /:id
agentGovernanceRouter.post(
  "/budget-threshold/evaluate",
  requireRole(...BUDGET_THRESHOLD_EVAL_ROLES),
  handleEvaluateBudgetThreshold
)

// A4 NLQ query — registered strictly BEFORE /:id
agentGovernanceRouter.post(
  "/nlq/query",
  requireRole(...NLQ_QUERY_ROLES),
  handleNlqQuery
)

// Test dispatch (admin only, non-production) - registered strictly BEFORE /:id
agentGovernanceRouter.post(
  "/test-dispatch",
  requireRole(...ADMIN_ROLES),
  handleTestDispatchAction
)

// Single action inspection (with payloads)
agentGovernanceRouter.get(
  "/:id",
  requireRole(...DECIDE_TIER3_ROLES),
  handleGetActionById
)

// Action decisions
agentGovernanceRouter.post(
  "/:id/approve",
  requireRole(...DECIDE_TIER3_ROLES),
  handleApproveAction
)
agentGovernanceRouter.post(
  "/:id/reject",
  requireRole(...DECIDE_TIER3_ROLES),
  handleRejectAction
)
agentGovernanceRouter.post(
  "/:id/override",
  requireRole(...DECIDE_TIER3_ROLES),
  handleOverrideAction
)
