import { Router } from "express"
import { centralPrisma } from "../lib/prisma-central.js"
import {
  signAccessToken,
  comparePassword,
  recordLoginAudit,
  logSafeError,
  DUMMY_HASH,
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
import {
  loginIpTotalLimiter,
  checkLoginIpFailLimit,
  checkLoginLockout,
  handleLoginFailure,
  clearLoginCounters,
  GENERIC_RATE_LIMIT_ERROR,
} from "../middleware/rate-limit.js"

export const authRouter = Router()

/**
 * POST /auth/login
 * Body: { email, password }
 * Validates against central.users, compares bcrypt hash, requires status 'active',
 * logs attempt to login_audit, returns short-lived access token.
 * Protected by IP total cap, IP failed attempts limiter, and pair/aggregate lockout.
 */
authRouter.post("/login", loginIpTotalLimiter, async (req, res) => {
  const { email, password } = req.body ?? {}
  const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1"

  // 1. IP failed attempts limit check (Amendment 3)
  const ipFailCheck = checkLoginIpFailLimit(clientIp)
  if (!ipFailCheck.allowed) {
    res.setHeader("Retry-After", String(ipFailCheck.retryAfter))
    res.status(429).json({ error: GENERIC_RATE_LIMIT_ERROR })
    return
  }

  // 2. Body validation
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()

  // 3. Login Lockout Check: pair (email|ip) and aggregate (email) (Amendment 1)
  const lockoutCheck = checkLoginLockout(normalizedEmail, clientIp)
  if (lockoutCheck.locked) {
    // Run dummy bcrypt to maintain timing parity with non-locked requests,
    // preventing attackers from distinguishing locked accounts from rapid rejections.
    await comparePassword(password, DUMMY_HASH)
    res.setHeader("Retry-After", String(lockoutCheck.retryAfter))
    res.status(429).json({ error: GENERIC_RATE_LIMIT_ERROR })
    return
  }

  try {
    // 4. Find user in central
    const user = await centralPrisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        institution: true,
      },
    })

    // Constant-time comparison: runs against user.passwordHash if found, or DUMMY_HASH if not
    const passwordValid = await comparePassword(password, user?.passwordHash)

    // Helper to process non-success login outcome
    const recordFailureAndCheckLockout = async () => {
      // Count EVERY non-success outcome toward failure counters and lockout.
      // Rationale: If disabled/pending/inactive statuses did not increment failure counters,
      // or behaved differently under lockout, an attacker could deduce account state
      // or verify password correctness on non-active accounts (a password-correctness oracle).
      const failResult = handleLoginFailure(normalizedEmail, clientIp)
      if (failResult.justLocked && user) {
        // Record account_locked ONCE when lock begins for an existing user (Amendment 7)
        await recordLoginAudit({
          userId: user.id,
          event: "account_locked",
          ipAddress: clientIp,
        })
      }
    }

    // Check credentials (identical error message to prevent user enumeration)
    if (!user || !passwordValid) {
      if (user) {
        await recordLoginAudit({
          userId: user.id,
          event: "login_failed",
          ipAddress: clientIp,
        })
      }
      await recordFailureAndCheckLockout()
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    // 5. Check user status (verified password required first)
    if (user.status === "pending") {
      await recordLoginAudit({
        userId: user.id,
        event: "account_disabled",
        ipAddress: clientIp,
      })
      await recordFailureAndCheckLockout()
      res.status(403).json({ error: "Account is pending administrator approval" })
      return
    }

    if (user.status !== "active") {
      await recordLoginAudit({
        userId: user.id,
        event: "account_disabled",
        ipAddress: clientIp,
      })
      await recordFailureAndCheckLockout()
      res.status(401).json({ error: "Invalid email or password" }) // Avoid revealing disabled status
      return
    }

    // 6. Check institution status
    if (user.institution.status === "provisioning" || user.institution.status === "failed") {
      await recordLoginAudit({
        userId: user.id,
        event: "institution_inactive",
        ipAddress: clientIp,
      })
      await recordFailureAndCheckLockout()
      res.status(401).json({ error: "Invalid email or password" })
      return
    }

    if (user.institution.status !== "active") {
      await recordLoginAudit({
        userId: user.id,
        event: "institution_inactive",
        ipAddress: clientIp,
      })
      await recordFailureAndCheckLockout()
      res.status(403).json({ error: "Institution account is not active" })
      return
    }

    // 7. Validate role name
    const roleName = user.role.name
    if (!isValidRole(roleName)) {
      res.status(500).json({ error: `Internal error: unrecognized role '${roleName}'` })
      return
    }

    // 8. Generate token & record audit success
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

    // Clear failed attempt counters and lockout state upon authenticated login success
    clearLoginCounters(normalizedEmail, clientIp)

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
