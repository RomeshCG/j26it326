/**
 * Agent Tier Policy Routes (/api/tenant/agent-policies)
 *
 * Implements Graduated Trust policy configuration, tier adjustment workflows,
 * and admin policy creation with strict audit logging.
 */

import { Router, type Request, type Response } from "express"
import { requireRole } from "../middleware/auth.js"
import { ROLES, hasCapability, type RoleName } from "../lib/permissions.js"
import { logSafeError } from "../lib/auth.js"
import {
  isValidUuid,
  type TenantPrisma,
} from "../lib/agent-engine.js"
import { validateReason } from "../lib/agent-engine-core.js"
import type { Prisma } from "../../node_modules/.prisma/tenant-client/index.js"

export const agentPoliciesRouter = Router()

// Role capability filters per IMFS RBAC
export const VIEW_ACTIONS_ROLES: RoleName[] = ROLES.filter((r) =>
  hasCapability(r, "agents:view_actions")
)
export const MANAGE_POLICIES_ROLES: RoleName[] = ROLES.filter((r) =>
  hasCapability(r, "agents:manage_policies")
)

export const KNOWN_AGENT_IDS = new Set(["A1", "A2", "A3", "A4"])
export const ACTION_TYPE_REGEX = /^[a-z0-9_]{1,64}$/

// ----------------------------------------------------------------------------
// Handler functions (exported for isolated unit testing with fake req/res)
// ----------------------------------------------------------------------------

/**
 * GET /agent-policies
 * Lists all configured agent tier policies.
 */
export async function handleListAgentPolicies(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma

    const policies = await tenantPrisma.agentTierPolicy.findMany({
      orderBy: { actionType: "asc" },
    })

    res.json({
      data: policies,
      count: policies.length,
    })
  } catch (err: unknown) {
    logSafeError("[agent-policies] List error", err)
    res.status(500).json({ error: "Failed to list agent policies" })
  }
}

/**
 * POST /agent-policies
 * Creates a new agent tier policy with audit logging (admin only).
 */
export async function handleCreateAgentPolicy(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const { actionType, agentId, agentName, tier, description } = req.body ?? {}

    // 1. actionType format check (lowercase letters, digits, underscore, max 64)
    if (typeof actionType !== "string") {
      res.status(400).json({
        error: "actionType must be a string",
      })
      return
    }
    const actionTypeStr = actionType.trim()
    if (!ACTION_TYPE_REGEX.test(actionTypeStr)) {
      res.status(400).json({
        error:
          "Invalid actionType. Must be 1 to 64 lowercase letters, digits, and underscores.",
      })
      return
    }

    // 2. agentId check (A1-A4)
    if (typeof agentId !== "string") {
      res.status(400).json({ error: "agentId must be a string" })
      return
    }
    const agentIdStr = agentId.trim()
    if (!KNOWN_AGENT_IDS.has(agentIdStr)) {
      res.status(400).json({
        error: "Invalid agentId. Must be A1, A2, A3, or A4.",
      })
      return
    }

    // 3. agentName check (string, 1 to 64 chars)
    if (typeof agentName !== "string" || agentName.trim().length === 0) {
      res.status(400).json({ error: "agentName is required" })
      return
    }
    const agentNameStr = agentName.trim()
    if (agentNameStr.length > 64) {
      res.status(400).json({ error: "agentName cannot exceed 64 characters" })
      return
    }

    // 4. tier check: strictly typeof number and integer 1 to 4 (reject strings, booleans, floats, arrays)
    if (
      typeof tier !== "number" ||
      !Number.isInteger(tier) ||
      ![1, 2, 3, 4].includes(tier)
    ) {
      res.status(400).json({ error: "Invalid tier. Must be an integer 1, 2, 3, or 4." })
      return
    }

    // 5. description check (string, max 500 chars if provided)
    if (description !== undefined && description !== null) {
      if (typeof description !== "string" || description.length > 500) {
        res.status(400).json({
          error: "Invalid description. Must be a string up to 500 characters.",
        })
        return
      }
    }

    // 6. Duplicate check
    const existing = await tenantPrisma.agentTierPolicy.findUnique({
      where: { actionType: actionTypeStr },
    })
    if (existing) {
      res.status(409).json({ error: "Policy for this actionType already exists" })
      return
    }

    const userId = req.user!.userId

    // 7. Transaction: create policy + audit entry
    const createdPolicy = await tenantPrisma.$transaction(async (tx) => {
      const policy = await tx.agentTierPolicy.create({
        data: {
          actionType: actionTypeStr,
          agentId: agentIdStr,
          agentName: agentNameStr,
          tier,
          description: description ? String(description).trim() : null,
          isActive: true,
        },
      })

      await tx.auditLog.create({
        data: {
          actorType: "user",
          actorId: userId,
          action: "agent_policy.created",
          resource: "agent_tier_policies",
          ipAddress: req.ip ?? null,
          userAgent: (req.headers["user-agent"] as string) ?? null,
          details: {
            policyId: policy.id,
            actionType: actionTypeStr,
            agentId: agentIdStr,
            agentName: agentNameStr,
            tier,
          },
        },
      })

      return policy
    })

    res.status(201).json({ status: "ok", policy: createdPolicy })
  } catch (err: unknown) {
    if ((err as any)?.code === "P2002") {
      res.status(409).json({ error: "Policy for this actionType already exists" })
      return
    }
    logSafeError("[agent-policies] Create error", err)
    res.status(500).json({ error: "Failed to create agent policy" })
  }
}

/**
 * PUT /agent-policies/:id
 * Updates an existing agent tier policy (admin only).
 * Read and write occur inside transaction with updateMany where { id, tier: <tier read> }.
 * If tier changes, justification reason is strictly required.
 */
export async function handleUpdateAgentPolicy(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const tenantPrisma = req.tenantPrisma as TenantPrisma
    const policyId = String(req.params.id ?? "").trim()

    // 1. UUID check on :id
    if (!isValidUuid(policyId)) {
      res.status(400).json({ error: "Invalid policy ID format. Must be a valid UUID" })
      return
    }

    // 2. Strict input checks
    const body = req.body ?? {}
    const { tier, isActive, description, reason } = body

    if (tier === undefined && isActive === undefined && description === undefined) {
      res.status(400).json({ error: "At least one update field (tier, isActive, description) must be provided" })
      return
    }

    if (tier !== undefined) {
      if (
        typeof tier !== "number" ||
        !Number.isInteger(tier) ||
        ![1, 2, 3, 4].includes(tier)
      ) {
        res.status(400).json({ error: "Invalid tier. Must be an integer 1, 2, 3, or 4." })
        return
      }
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        res.status(400).json({ error: "Invalid isActive. Must be a boolean." })
        return
      }
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== "string" || description.length > 500) {
        res.status(400).json({
          error: "Invalid description. Must be a string up to 500 characters.",
        })
        return
      }
    }

    const userId = req.user!.userId

    // 3. Transaction with guarded read and guarded write
    const result = await tenantPrisma.$transaction(async (tx) => {
      // Guarded read inside transaction
      const existing = await tx.agentTierPolicy.findUnique({
        where: { id: policyId },
      })
      if (!existing) {
        return { status: "not_found" } as const
      }

      const tierChanged = tier !== undefined && tier !== existing.tier
      const isActiveChanged = isActive !== undefined && isActive !== existing.isActive
      const descNormalized =
        description !== undefined
          ? (description ? String(description).trim() : null)
          : existing.description
      const descChanged = description !== undefined && descNormalized !== existing.description

      // An update body with no changes returns 400 and writes no audit entry
      if (!tierChanged && !isActiveChanged && !descChanged) {
        return { status: "no_changes" } as const
      }

      let validatedReasonText: string | null = null
      if (tierChanged) {
        const reasonVal = validateReason(reason)
        if (!reasonVal.valid) {
          return {
            status: "invalid_reason",
            error:
              reasonVal.error ??
              "A valid justification reason of 10 to 1000 characters is required when altering policy tier.",
          } as const
        }
        validatedReasonText = reasonVal.trimmed ?? null
      }

      const updateData: Prisma.AgentTierPolicyUpdateInput = {}
      if (tierChanged) updateData.tier = tier
      if (isActiveChanged) updateData.isActive = isActive
      if (descChanged) updateData.description = descNormalized

      // Guarded write inside transaction with updateMany where { id, tier: <tier read> }
      const updateResult = await tx.agentTierPolicy.updateMany({
        where: {
          id: policyId,
          tier: existing.tier,
        },
        data: updateData,
      })

      if (updateResult.count === 0) {
        // Record was concurrently modified
        return { status: "conflict" } as const
      }

      // Audit entry in same transaction: oldTier and newTier from guarded read
      await tx.auditLog.create({
        data: {
          actorType: "user",
          actorId: userId,
          action: "agent_policy.updated",
          resource: "agent_tier_policies",
          ipAddress: req.ip ?? null,
          userAgent: (req.headers["user-agent"] as string) ?? null,
          details: {
            policyId,
            actionType: existing.actionType,
            oldTier: existing.tier,
            newTier: tierChanged ? tier : existing.tier,
            tierChanged,
            reason: validatedReasonText,
            isActive: isActiveChanged ? isActive : existing.isActive,
          },
        },
      })

      return {
        status: "ok",
        policy: {
          ...existing,
          ...updateData,
          updatedAt: new Date(),
        },
      } as const
    })

    if (result.status === "not_found") {
      res.status(404).json({ error: "Agent tier policy not found" })
      return
    }
    if (result.status === "no_changes") {
      res.status(400).json({ error: "No changes detected in update payload" })
      return
    }
    if (result.status === "invalid_reason") {
      res.status(400).json({ error: result.error })
      return
    }
    if (result.status === "conflict") {
      res.status(409).json({ error: "Policy was modified concurrently" })
      return
    }

    res.status(200).json({ status: "ok", policy: result.policy })
  } catch (err: unknown) {
    logSafeError("[agent-policies] Update error", err)
    res.status(500).json({ error: "Failed to update agent policy" })
  }
}

// ----------------------------------------------------------------------------
// Route Registrations
// ----------------------------------------------------------------------------

// List policies (view permissions)
agentPoliciesRouter.get(
  "/",
  requireRole(...VIEW_ACTIONS_ROLES),
  handleListAgentPolicies
)

// Create policy (admin only)
agentPoliciesRouter.post(
  "/",
  requireRole(...MANAGE_POLICIES_ROLES),
  handleCreateAgentPolicy
)

// Update policy (admin only)
agentPoliciesRouter.put(
  "/:id",
  requireRole(...MANAGE_POLICIES_ROLES),
  handleUpdateAgentPolicy
)
