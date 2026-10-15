import { Router } from "express"
import { centralPrisma } from "../lib/prisma-central.js"
import { authenticate, resolveTenantContext, requireRole } from "../middleware/auth.js"
import { logSafeError } from "../lib/auth.js"
import {
  verifyDomain,
  signupUser,
  registerDomain,
  resendVerification,
  revokeDomain,
  approveUser,
  rejectUser,
} from "../lib/domain-service.js"
import {
  signupLimiter,
  verifyDomainLimiter,
  adminTenantLimiter,
} from "../middleware/rate-limit.js"

export const publicDomainRouter = Router()
export const tenantDomainRouter = Router()

// ============================================================================
// Public Endpoints (/auth/*)
// ============================================================================

/**
 * POST /auth/domains/verify
 * Public endpoint called with { token } in the body.
 */
publicDomainRouter.post("/domains/verify", verifyDomainLimiter, async (req, res) => {
  const { token } = req.body ?? {}
  const result = await verifyDomain(token)
  if (!result.success) {
    res.status(result.status).json({ error: result.error })
    return
  }
  res.status(result.status).json(result.data)
})

/**
 * POST /auth/signup
 * Staff self-registration under an existing verified institution domain.
 */
publicDomainRouter.post("/signup", signupLimiter, async (req, res) => {
  const { email, password, fullName } = req.body ?? {}
  const result = await signupUser({ email, password, fullName })
  if (!result.success) {
    res.status(result.status).json({ error: result.error })
    return
  }
  res.status(result.status).json(result.data)
})

// ============================================================================
// Tenant-Scoped Admin Endpoints (/api/tenant/*)
// ============================================================================

/**
 * POST /api/tenant/domains
 * Register an email domain for the admin's institution.
 */
tenantDomainRouter.post("/domains", authenticate, resolveTenantContext, requireRole("admin"), adminTenantLimiter, async (req, res) => {
  const institutionId = req.user!.institutionId
  const { domain, defaultRoleId, verificationMailbox } = req.body ?? {}

  const result = await registerDomain({
    institutionId,
    domain,
    verificationMailbox,
    defaultRoleId,
  })

  if (!result.success) {
    res.status(result.status).json({ error: result.error })
    return
  }
  res.status(result.status).json(result.data)
})

/**
 * GET /api/tenant/domains
 * List all domains claimed by the admin's institution.
 */
tenantDomainRouter.get("/domains", authenticate, resolveTenantContext, requireRole("admin"), async (req, res) => {
  const institutionId = req.user!.institutionId

  try {
    const domains = await centralPrisma.institutionDomain.findMany({
      where: { institutionId },
      include: {
        defaultRole: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const payload = domains.map((d) => ({
      id: d.id,
      domain: d.domain,
      status: d.status,
      autoApprove: d.autoApprove,
      defaultRole: d.defaultRole,
      verifiedAt: d.verifiedAt,
      tokenExpiresAt: d.tokenExpiresAt,
      createdAt: d.createdAt,
    }))

    res.status(200).json(payload)
  } catch (error) {
    logSafeError("[domains] List domains error", error)
    res.status(500).json({ error: "Failed to fetch domains" })
  }
})

/**
 * POST /api/tenant/domains/:domainId/resend
 * Resend verification link for a pending domain.
 */
tenantDomainRouter.post("/domains/:domainId/resend", authenticate, resolveTenantContext, requireRole("admin"), adminTenantLimiter, async (req, res) => {
  const institutionId = req.user!.institutionId
  const domainId = String(req.params.domainId)
  const { verificationMailbox } = req.body ?? {}

  const result = await resendVerification({
    institutionId,
    domainId,
    verificationMailbox,
  })

  if (!result.success) {
    res.status(result.status).json({ error: result.error })
    return
  }
  res.status(result.status).json(result.data)
})

/**
 * DELETE /api/tenant/domains/:domainId
 * Revoke a domain. Disables active and pending users only if domain was verified.
 */
tenantDomainRouter.delete("/domains/:domainId", authenticate, resolveTenantContext, requireRole("admin"), adminTenantLimiter, async (req, res) => {
  const institutionId = req.user!.institutionId
  const domainId = String(req.params.domainId)

  const result = await revokeDomain({
    institutionId,
    domainId,
  })

  if (!result.success) {
    res.status(result.status).json({ error: result.error })
    return
  }
  res.status(result.status).json(result.data)
})

/**
 * GET /api/tenant/pending-users
 * List all pending users in the admin's institution.
 */
tenantDomainRouter.get("/pending-users", authenticate, resolveTenantContext, requireRole("admin"), async (req, res) => {
  const institutionId = req.user!.institutionId

  try {
    const pendingUsers = await centralPrisma.user.findMany({
      where: {
        institutionId,
        status: "pending",
      },
      include: {
        role: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const payload = pendingUsers.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    }))

    res.status(200).json(payload)
  } catch (error) {
    logSafeError("[domains] List pending users error", error)
    res.status(500).json({ error: "Failed to fetch pending users" })
  }
})

/**
 * POST /api/tenant/pending-users/:userId/approve
 * Approve a pending user.
 */
tenantDomainRouter.post("/pending-users/:userId/approve", authenticate, resolveTenantContext, requireRole("admin"), adminTenantLimiter, async (req, res) => {
  const institutionId = req.user!.institutionId
  const userId = String(req.params.userId)
  const { roleId } = req.body ?? {}

  const result = await approveUser({
    institutionId,
    userId,
    roleId,
  })

  if (!result.success) {
    res.status(result.status).json({ error: result.error })
    return
  }
  res.status(result.status).json(result.data)
})

/**
 * POST /api/tenant/pending-users/:userId/reject
 * Reject a pending user. Disables the user account and invalidates cache.
 */
tenantDomainRouter.post("/pending-users/:userId/reject", authenticate, resolveTenantContext, requireRole("admin"), adminTenantLimiter, async (req, res) => {
  const institutionId = req.user!.institutionId
  const userId = String(req.params.userId)

  const result = await rejectUser({
    institutionId,
    userId,
  })

  if (!result.success) {
    res.status(result.status).json({ error: result.error })
    return
  }
  res.status(result.status).json(result.data)
})
