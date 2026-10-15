/**
 * Graduated Trust Agent Engine
 *
 * Implements governance dispatch, Tier 3 approval workflow, and human overrides.
 * Handlers execute strictly outside database transactions.
 *
 * KNOWN ARCHITECTURAL GAP:
 * A process crash occurring between handler execution and the subsequent result update
 * can leave an agent_actions row in 'running' (Tier 1/2) or 'approved' (Tier 3).
 * In this phase, we do not implement an automated orphan recovery job.
 */

import { randomUUID } from "node:crypto"
import type {
  PrismaClient as TenantPrismaClient,
  Prisma,
  AgentTierPolicy,
  AgentAction,
  AuditLog,
} from "../../node_modules/.prisma/tenant-client/index.js"
import {
  resolveTier,
  validateReason,
  nextStatusAfterHandler,
  summarizePayload,
  capDetails,
} from "./agent-engine-core.js"
import { executeActionHandler } from "./agent-handlers.js"

/**
 * Structural interface for tenant Prisma operations required by the engine.
 * Typed strictly against generated Prisma inputs/outputs to prevent unknown fields.
 */
export interface TenantTransactionClient {
  agentTierPolicy: Pick<
    TenantPrismaClient["agentTierPolicy"],
    "findUnique" | "findMany" | "create" | "createMany" | "update" | "updateMany"
  >
  agentAction: Pick<
    TenantPrismaClient["agentAction"],
    "create" | "updateMany" | "findUnique" | "findMany"
  >
  auditLog: Pick<TenantPrismaClient["auditLog"], "create">
}

export interface TenantPrismaOps extends TenantTransactionClient {
  $transaction: TenantPrismaClient["$transaction"]
}

export type TenantPrisma = TenantPrismaOps

// Compile-time check: verify TenantPrismaClient is assignable to TenantPrisma
type _AssertTenantPrisma = TenantPrismaClient extends TenantPrisma ? true : never
export const _typeCheck: _AssertTenantPrisma = true

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id)
}

export interface DispatchAgentActionInput {
  actionType: string
  action: string
  reason?: string // justification
  confidence?: number | null
  modelVersion?: string
  promptVersion?: string
  toolsUsed?: unknown
  inputPayload?: unknown
  agentId?: string | null
  agentName?: string
  ip?: string | null
  userAgent?: string | null
  // Note: NO tier field. The governance tier is determined exclusively by active policy.
}

export type DispatchResult =
  | {
      status: "ok"
      actionId: string
      actionStatus: "pending_approval" | "executed" | "notified" | "alert_only" | "failed"
      tier: 1 | 2 | 3 | 4
      isFallback: boolean
      outputPayload?: unknown
      error?: string
    }
  | {
      status: "conflict"
      error: string
    }
  | {
      status: "invalid"
      error: string
    }

export interface DecideTier3ActionInput {
  actionId: string
  decision: "approve" | "reject"
  reason: string
  userId: string
  ip?: string | null
  userAgent?: string | null
}

export type DecisionResult =
  | {
      status: "ok"
      actionId: string
      decision: "approve" | "reject"
      actionStatus: "approved" | "rejected" | "executed" | "failed" | "notified"
      outputPayload?: unknown
      error?: string
    }
  | {
      status: "conflict"
      error: string
    }
  | {
      status: "invalid"
      error: string
    }

export interface OverrideActionInput {
  actionId: string
  reason: string
  userId: string
  ip?: string | null
  userAgent?: string | null
}

export type OverrideResult =
  | {
      status: "ok"
      actionId: string
    }
  | {
      status: "conflict"
      error: string
    }
  | {
      status: "invalid"
      error: string
    }

/**
 * Dispatches an agent action according to its active governance policy tier.
 */
export async function dispatchAgentAction(
  tenantPrisma: TenantPrisma,
  input: DispatchAgentActionInput
): Promise<DispatchResult> {
  if (!input.actionType || !input.action) {
    return {
      status: "invalid",
      error: "actionType and action are required",
    }
  }

  // 1. Resolve policy & tier (unknown/inactive safely falls back to Tier 4)
  const policy = await tenantPrisma.agentTierPolicy.findUnique({
    where: { actionType: input.actionType },
  })
  const resolved = resolveTier(policy)

  // Prefer policy's agentName/agentId when active; for fallback use input.agentName ?? "Unknown"
  const agentId = !resolved.isFallback
    ? (policy?.agentId ?? input.agentId ?? null)
    : (input.agentId ?? null)
  const agentName = !resolved.isFallback
    ? (policy?.agentName ?? input.agentName ?? "Unknown")
    : (input.agentName ?? "Unknown")

  const actionId = randomUUID()

  const baseAuditDetails = {
    actionId,
    actionType: input.actionType,
    agentId,
    agentName,
    tier: resolved.tier,
    isFallback: resolved.isFallback,
    fallbackReason: resolved.isFallback ? resolved.reason : undefined,
    modelVersion: input.modelVersion,
    promptVersion: input.promptVersion,
    justification: input.reason,
    inputSummary: summarizePayload(input.inputPayload),
  }

  // --------------------------------------------------------------------------
  // Tier 4: alert_only (Single transaction: create row + audit entry)
  // --------------------------------------------------------------------------
  if (resolved.tier === 4) {
    await tenantPrisma.$transaction(async (tx) => {
      await tx.agentAction.create({
        data: {
          id: actionId,
          policyId: policy?.id ?? null,
          agentId,
          agentName,
          tier: 4,
          action: input.action,
          reason: input.reason ?? null,
          confidence: input.confidence ?? null,
          modelVersion: input.modelVersion ?? null,
          promptVersion: input.promptVersion ?? null,
          toolsUsed: input.toolsUsed as Prisma.InputJsonValue | undefined,
          inputPayload: input.inputPayload as Prisma.InputJsonValue | undefined,
          status: "alert_only",
        },
      })

      await tx.auditLog.create({
        data: {
          actorType: "agent",
          actorId: null,
          action: "agent_action.alert_only",
          resource: "agent_actions",
          ipAddress: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          details: capDetails({
            ...baseAuditDetails,
            status: "alert_only",
          }) as Prisma.InputJsonValue,
        },
      })
    })

    return {
      status: "ok",
      actionId,
      actionStatus: "alert_only",
      tier: 4,
      isFallback: resolved.isFallback,
    }
  }

  // --------------------------------------------------------------------------
  // Tier 3: pending_approval (Single transaction: create row + audit entry)
  // --------------------------------------------------------------------------
  if (resolved.tier === 3) {
    await tenantPrisma.$transaction(async (tx) => {
      await tx.agentAction.create({
        data: {
          id: actionId,
          policyId: policy?.id ?? null,
          agentId,
          agentName,
          tier: 3,
          action: input.action,
          reason: input.reason ?? null,
          confidence: input.confidence ?? null,
          modelVersion: input.modelVersion ?? null,
          promptVersion: input.promptVersion ?? null,
          toolsUsed: input.toolsUsed as Prisma.InputJsonValue | undefined,
          inputPayload: input.inputPayload as Prisma.InputJsonValue | undefined,
          status: "pending_approval",
        },
      })

      await tx.auditLog.create({
        data: {
          actorType: "agent",
          actorId: null,
          action: "agent_action.pending_approval",
          resource: "agent_actions",
          ipAddress: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          details: capDetails({
            ...baseAuditDetails,
            status: "pending_approval",
          }) as Prisma.InputJsonValue,
        },
      })
    })

    return {
      status: "ok",
      actionId,
      actionStatus: "pending_approval",
      tier: 3,
      isFallback: false,
    }
  }

  // --------------------------------------------------------------------------
  // Tier 1 & Tier 2:
  // Transaction 1 = create row (running) + audit
  // Handler execution OUTSIDE any transaction
  // Transaction 2 = guarded updateMany row where status: "running" + audit
  // --------------------------------------------------------------------------
  await tenantPrisma.$transaction(async (tx) => {
    await tx.agentAction.create({
      data: {
        id: actionId,
        policyId: policy?.id ?? null,
        agentId,
        agentName,
        tier: resolved.tier,
        action: input.action,
        reason: input.reason ?? null,
        confidence: input.confidence ?? null,
        modelVersion: input.modelVersion ?? null,
        promptVersion: input.promptVersion ?? null,
        toolsUsed: input.toolsUsed as Prisma.InputJsonValue | undefined,
        inputPayload: input.inputPayload as Prisma.InputJsonValue | undefined,
        status: "running",
      },
    })

    await tx.auditLog.create({
      data: {
        actorType: "agent",
        actorId: null,
        action: "agent_action.running",
        resource: "agent_actions",
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        details: capDetails({
          ...baseAuditDetails,
          status: "running",
        }) as Prisma.InputJsonValue,
      },
    })
  })

  // Execute handler OUTSIDE transaction
  const startTime = Date.now()
  const execResult = await executeActionHandler({
    actionId,
    actionType: input.actionType,
    agentId,
    agentName,
    tier: resolved.tier,
    inputPayload: input.inputPayload,
  })
  const processingTimeMs = Date.now() - startTime
  const nextStatus = nextStatusAfterHandler(resolved.tier, execResult.success)

  // Transaction 2: guarded updateMany where { id: actionId, status: "running" }
  const tx2Result = await tenantPrisma.$transaction(async (tx) => {
    const updated = await tx.agentAction.updateMany({
      where: {
        id: actionId,
        status: "running",
      },
      data: {
        status: nextStatus,
        outputPayload: (execResult.success
          ? execResult.outputPayload
          : { error: execResult.error }) as Prisma.InputJsonValue,
        processingTimeMs,
      },
    })

    if (updated.count === 0) {
      return { conflict: true }
    }

    await tx.auditLog.create({
      data: {
        actorType: "agent",
        actorId: null,
        action: `agent_action.${nextStatus}`,
        resource: "agent_actions",
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        details: capDetails({
          ...baseAuditDetails,
          status: nextStatus,
          outputSummary: summarizePayload(execResult.outputPayload),
          error: execResult.error,
          processingTimeMs,
        }) as Prisma.InputJsonValue,
      },
    })

    return { conflict: false }
  })

  if (tx2Result.conflict) {
    return {
      status: "conflict",
      error: "Action status was modified concurrently before result could be recorded",
    }
  }

  return {
    status: "ok",
    actionId,
    actionStatus: nextStatus,
    tier: resolved.tier,
    isFallback: false,
    outputPayload: execResult.outputPayload,
    error: execResult.error,
  }
}

/**
 * Human approval/rejection decision for Tier 3 pending actions.
 */
export async function decideTier3Action(
  tenantPrisma: TenantPrisma,
  input: DecideTier3ActionInput
): Promise<DecisionResult> {
  if (!isValidUuid(input.userId)) {
    return {
      status: "invalid",
      error: "userId must be a valid UUID",
    }
  }

  const reasonVal = validateReason(input.reason)
  if (!reasonVal.valid) {
    return {
      status: "invalid",
      error: reasonVal.error ?? "Invalid decision reason",
    }
  }

  if (input.decision !== "approve" && input.decision !== "reject") {
    return {
      status: "invalid",
      error: "Decision must be either 'approve' or 'reject'",
    }
  }

  const now = new Date()
  const updateData: Prisma.AgentActionUpdateManyMutationInput =
    input.decision === "approve"
      ? {
          status: "approved",
          approvedBy: input.userId,
          decidedAt: now,
          decisionReason: reasonVal.trimmed,
        }
      : {
          status: "rejected",
          approvedBy: input.userId,
          decidedAt: now,
          decisionReason: reasonVal.trimmed,
          isOverride: true,
        }

  // Guarded update transaction committed BEFORE any handler runs
  const txResult = await tenantPrisma.$transaction(async (tx) => {
    const updated = await tx.agentAction.updateMany({
      where: {
        id: input.actionId,
        tier: 3,
        status: "pending_approval",
        decidedAt: null,
      },
      data: updateData,
    })

    if (updated.count === 0) {
      return { conflict: true }
    }

    await tx.auditLog.create({
      data: {
        actorType: "user",
        actorId: input.userId,
        action:
          input.decision === "approve"
            ? "agent_action.approved"
            : "agent_action.rejected",
        resource: "agent_actions",
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        details: capDetails({
          actionId: input.actionId,
          decision: input.decision,
          reason: reasonVal.trimmed,
          tier: 3,
          status: input.decision === "approve" ? "approved" : "rejected",
          isOverride: input.decision === "reject",
        }) as Prisma.InputJsonValue,
      },
    })

    return { conflict: false }
  })

  if (txResult.conflict) {
    return {
      status: "conflict",
      error:
        "Action is not pending approval, was already decided, or is not Tier 3",
    }
  }

  // On reject: no handler runs
  if (input.decision === "reject") {
    return {
      status: "ok",
      actionId: input.actionId,
      decision: "reject",
      actionStatus: "rejected",
    }
  }

  // On approve: resolve policy via policyId
  const actionRow = await tenantPrisma.agentAction.findUnique({
    where: { id: input.actionId },
  })

  let policy: AgentTierPolicy | null = null
  if (actionRow?.policyId) {
    policy = await tenantPrisma.agentTierPolicy.findUnique({
      where: { id: actionRow.policyId },
    })
  }

  // If policy cannot be resolved (no policyId or policy missing), do NOT run handler
  if (!policy || !policy.actionType) {
    const errorMessage = "action type could not be resolved"
    const failUpdate = await tenantPrisma.$transaction(async (tx) => {
      const updated = await tx.agentAction.updateMany({
        where: { id: input.actionId, status: "approved" },
        data: {
          status: "failed",
          outputPayload: { error: errorMessage },
          processingTimeMs: 0,
        },
      })

      if (updated.count === 0) {
        return { conflict: true }
      }

      await tx.auditLog.create({
        data: {
          actorType: "user",
          actorId: input.userId,
          action: "agent_action.failed",
          resource: "agent_actions",
          ipAddress: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          details: capDetails({
            actionId: input.actionId,
            tier: 3,
            status: "failed",
            error: errorMessage,
          }) as Prisma.InputJsonValue,
        },
      })

      return { conflict: false }
    })

    if (failUpdate.conflict) {
      return {
        status: "conflict",
        error: "Action status was modified concurrently",
      }
    }

    return {
      status: "ok",
      actionId: input.actionId,
      decision: "approve",
      actionStatus: "failed",
      error: errorMessage,
    }
  }

  // Run handler OUTSIDE any transaction
  const startTime = Date.now()
  const execResult = await executeActionHandler({
    actionId: input.actionId,
    actionType: policy.actionType,
    agentId: policy.agentId ?? actionRow?.agentId ?? null,
    agentName: policy.agentName,
    tier: 3,
    inputPayload: actionRow?.inputPayload,
  })
  const processingTimeMs = Date.now() - startTime
  const nextStatus = nextStatusAfterHandler(3, execResult.success)

  // Transaction 2: guarded updateMany where { id: actionId, status: "approved" }
  const tx2Result = await tenantPrisma.$transaction(async (tx) => {
    const updated = await tx.agentAction.updateMany({
      where: {
        id: input.actionId,
        status: "approved",
      },
      data: {
        status: nextStatus,
        outputPayload: (execResult.success
          ? execResult.outputPayload
          : { error: execResult.error }) as Prisma.InputJsonValue,
        processingTimeMs,
      },
    })

    if (updated.count === 0) {
      return { conflict: true }
    }

    await tx.auditLog.create({
      data: {
        actorType: "user",
        actorId: input.userId,
        action: `agent_action.${nextStatus}`,
        resource: "agent_actions",
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        details: capDetails({
          actionId: input.actionId,
          tier: 3,
          status: nextStatus,
          outputSummary: summarizePayload(execResult.outputPayload),
          error: execResult.error,
          processingTimeMs,
        }) as Prisma.InputJsonValue,
      },
    })

    return { conflict: false }
  })

  if (tx2Result.conflict) {
    return {
      status: "conflict",
      error: "Action status was modified concurrently before result could be recorded",
    }
  }

  return {
    status: "ok",
    actionId: input.actionId,
    decision: "approve",
    actionStatus: nextStatus,
    outputPayload: execResult.outputPayload,
    error: execResult.error,
  }
}

/**
 * Human override for executed/notified Tier 1 or Tier 2 actions.
 * Only permitted once per action.
 */
export async function overrideAction(
  tenantPrisma: TenantPrisma,
  input: OverrideActionInput
): Promise<OverrideResult> {
  if (!isValidUuid(input.userId)) {
    return {
      status: "invalid",
      error: "userId must be a valid UUID",
    }
  }

  const reasonVal = validateReason(input.reason)
  if (!reasonVal.valid) {
    return {
      status: "invalid",
      error: reasonVal.error ?? "Invalid override reason",
    }
  }

  const txResult = await tenantPrisma.$transaction(async (tx) => {
    const updated = await tx.agentAction.updateMany({
      where: {
        id: input.actionId,
        tier: { in: [1, 2] },
        status: { in: ["executed", "notified"] },
        isOverride: false,
      },
      data: {
        isOverride: true,
        approvedBy: input.userId,
        decidedAt: new Date(),
        decisionReason: reasonVal.trimmed,
      },
    })

    if (updated.count === 0) {
      return { conflict: true }
    }

    await tx.auditLog.create({
      data: {
        actorType: "user",
        actorId: input.userId,
        action: "agent_action.overridden",
        resource: "agent_actions",
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        details: capDetails({
          actionId: input.actionId,
          reason: reasonVal.trimmed,
          isOverride: true,
        }) as Prisma.InputJsonValue,
      },
    })

    return { conflict: false }
  })

  if (txResult.conflict) {
    return {
      status: "conflict",
      error:
        "Action cannot be overridden (must be Tier 1 or 2, executed or notified, and not previously overridden)",
    }
  }

  return {
    status: "ok",
    actionId: input.actionId,
  }
}
