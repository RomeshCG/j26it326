import { Router } from "express"
import { authenticate, resolveTenantContext, requireRole } from "../middleware/auth.js"
import { validateUserId } from "../lib/auth.js"

/**
 * Example router for teammates in Component 1 (Risk), 2 (Finance), and 3 (Loans).
 * Demonstrates standard IMFS integration patterns:
 *   Pattern 1: Any authenticated user in the institution
 *   Pattern 2: Single role restriction
 *   Pattern 3: Multiple role restriction
 *   Pattern 4: Safe read access using req.tenantPrisma
 *   Pattern 5: Soft foreign key user_id validation
 *
 * NOTE: This router is mounted ONLY when NODE_ENV !== "production".
 * All examples are READ-ONLY and contain no writes or destructive actions.
 */
export const exampleRouter = Router()

// Common middleware applied to all routes in this module:
// 1. authenticate: validates JWT signature and expiration
// 2. resolveTenantContext: checks active status in central and attaches req.tenantPrisma
exampleRouter.use(authenticate, resolveTenantContext)

/**
 * Pattern 1: Any logged-in user belonging to this tenant
 * Access: admin, executive, finance_officer, hr_officer, branch_manager, loan_officer
 */
exampleRouter.get("/any-user", (req, res) => {
  res.json({
    message: "Pattern 1: Available to any authenticated role",
    user: {
      userId: req.user!.userId,
      role: req.user!.role,
      institutionId: req.user!.institutionId,
    },
  })
})

/**
 * Pattern 2: Single role restriction
 * Example: Restricted strictly to loan officers
 */
exampleRouter.get("/loan-officers-only", requireRole("loan_officer"), (req, res) => {
  res.json({
    message: "Pattern 2: Restricted to loan_officer",
    role: req.user!.role,
  })
})

/**
 * Pattern 3: Multiple role restriction
 * Example: Accessible by either branch managers or admins
 */
exampleRouter.get("/management-only", requireRole("admin", "branch_manager"), (req, res) => {
  res.json({
    message: "Pattern 3: Restricted to admin or branch_manager",
    role: req.user!.role,
  })
})

/**
 * Pattern 4: Safe tenant data read using req.tenantPrisma
 * Always use req.tenantPrisma. Never create a new PrismaClient or new connection string!
 */
exampleRouter.get("/tenant-data-read", async (req, res) => {
  try {
    // req.tenantPrisma is pre-connected to the caller's specific physical database
    const branchCount = await req.tenantPrisma!.branch.count()

    res.json({
      message: "Pattern 4: Queried caller's dedicated tenant database safely",
      institutionId: req.user!.institutionId,
      branchCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database query failed"
    res.status(500).json({ error: message })
  }
})

/**
 * Pattern 5: Validating a user_id before storing a soft reference
 * Use this pattern whenever accepting a submittedBy, approvedBy, or officerId in a request.
 */
exampleRouter.get("/validate-user-example/:targetUserId", async (req, res) => {
  const targetUserId = String(req.params.targetUserId)

  // Validate against central.users within the caller's institution boundary
  const validation = await validateUserId(targetUserId, req.user!.institutionId)

  if (!validation.valid) {
    res.status(400).json({
      error: `Invalid user reference: ${validation.error}`,
    })
    return
  }

  res.json({
    message: "Pattern 5: User soft reference validated successfully",
    targetUser: {
      id: validation.user!.id,
      fullName: validation.user!.fullName,
      role: validation.user!.roleName,
    },
  })
})
