import { Router } from "express"
import { centralPrisma } from "../lib/prisma-central.js"
import {
  signAccessToken,
  comparePassword,
  recordLoginAudit,
  logSafeError,
} from "../lib/auth.js"
import {
  ROLE_PERMISSIONS,
  isValidRole,
  type RoleName,
} from "../lib/permissions.js"
import {
  authenticate,
  resolveTenantContext,
  requireRole,
} from "../middleware/auth.js"

export const authRouter = Router()

// ============================================================================
// TODO: Phase 2 Security Extra — Login Rate Limiting & Account Lockout
// Place rate limiting middleware here (e.g., max 5 attempts per IP / email per 15 min)
// ============================================================================

/**
 * POST /auth/login
 * Body: { email, password }
 * Validates against central.users, compares bcrypt hash, requires status 'active',
 * logs attempt to login_audit, returns short-lived access token.
 */
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {}
  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()

  try {
    // 1. Find user in central
    const user = await centralPrisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        institution: true,
      },
    })

    // Constant-time comparison: runs against user.passwordHash if found, or DUMMY_HASH if not
    const passwordValid = await comparePassword(password, user?.passwordHash)

    // Check credentials (identical error message to prevent user enumeration)
    if (!user || !passwordValid) {
      if (user) {
        await recordLoginAudit({
          userId: user.id,
          event: "login_failed",
          ipAddress: clientIp,
        })
      }
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    // 2. Check user status (verified password required first)
    if (user.status === "pending") {
      await recordLoginAudit({
        userId: user.id,
        event: "account_disabled",
        ipAddress: clientIp,
      })
      res.status(403).json({ error: "Account is pending administrator approval" })
      return
    }

    if (user.status !== "active") {
      await recordLoginAudit({
        userId: user.id,
        event: "account_disabled",
        ipAddress: clientIp,
      })
      res.status(401).json({ error: "Invalid email or password" }) // Avoid revealing disabled status to unauthorized parties
      return
    }

    // 3. Check institution status
    if (user.institution.status === "provisioning" || user.institution.status === "failed") {
      await recordLoginAudit({
        userId: user.id,
        event: "institution_inactive",
        ipAddress: clientIp,
      })
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    if (user.institution.status !== "active") {
      await recordLoginAudit({
        userId: user.id,
        event: "institution_inactive",
        ipAddress: clientIp,
      })
      res.status(403).json({ error: "Institution account is not active" })
      return
    }

    // 4. Validate role name
    const roleName = user.role.name
    if (!isValidRole(roleName)) {
      res.status(500).json({ error: `Internal error: unrecognized role '${roleName}'` })
      return
    }

    // 5. Generate token & record audit success
    const token = signAccessToken({
      userId: user.id,
      institutionId: user.institutionId,
      role: roleName,
    })

    await recordLoginAudit({
      userId: user.id,
      event: "login_success",
      ipAddress: clientIp,
    })

    res.json({
      token,
      expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: roleName,
        institutionId: user.institutionId,
        institutionName: user.institution.name,
      },
    })
  } catch (error) {
    logSafeError("[auth] Login error", error)
    res.status(500).json({ error: "Internal login error" })
  }
})

/**
 * GET /auth/me
 * Returns profile and allowed capabilities for the currently logged-in user.
 */
authRouter.get("/me", authenticate, resolveTenantContext, (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const role = req.user.role
  const permissions = ROLE_PERMISSIONS[role] ?? []

  res.json({
    userId: req.user.userId,
    email: req.user.email,
    fullName: req.user.fullName,
    institutionId: req.user.institutionId,
    role,
    capabilities: permissions,
  })
})

// ============================================================================
// Non-production test routes to demonstrate 200 vs 403 role checks
// Available only when NODE_ENV !== "production"
// ============================================================================
if (process.env.NODE_ENV !== "production") {
  authRouter.get(
    "/test/admin",
    authenticate,
    resolveTenantContext,
    requireRole("admin"),
    (req, res) => {
      res.json({
        ok: true,
        message: "Admin test route reached successfully",
        user: req.user,
      })
    }
  )

  authRouter.get(
    "/test/executive",
    authenticate,
    resolveTenantContext,
    requireRole("admin", "executive"),
    (req, res) => {
      res.json({
        ok: true,
        message: "Executive test route reached successfully",
        user: req.user,
      })
    }
  )

  authRouter.get(
    "/test/finance",
    authenticate,
    resolveTenantContext,
    requireRole("admin", "finance_officer"),
    (req, res) => {
      res.json({
        ok: true,
        message: "Finance test route reached successfully",
        user: req.user,
      })
    }
  )

  authRouter.get(
    "/test/hr",
    authenticate,
    resolveTenantContext,
    requireRole("admin", "hr_officer"),
    (req, res) => {
      res.json({
        ok: true,
        message: "HR test route reached successfully",
        user: req.user,
      })
    }
  )

  authRouter.get(
    "/test/branch",
    authenticate,
    resolveTenantContext,
    requireRole("admin", "branch_manager"),
    (req, res) => {
      res.json({
        ok: true,
        message: "Branch manager test route reached successfully",
        user: req.user,
      })
    }
  )

  authRouter.get(
    "/test/loan-officer",
    authenticate,
    resolveTenantContext,
    requireRole("admin", "loan_officer"),
    (req, res) => {
      res.json({
        ok: true,
        message: "Loan officer test route reached successfully",
        user: req.user,
      })
    }
  )
}
