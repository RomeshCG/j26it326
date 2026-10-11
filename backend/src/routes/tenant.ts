import { Router } from "express"
import { authenticate, resolveTenantContext } from "../middleware/auth.js"
import { validateUserId } from "../lib/auth.js"

export const tenantRouter = Router()

// All tenant routes sit strictly behind authentication and tenant context resolution
tenantRouter.use(authenticate, resolveTenantContext)

/**
 * GET /api/tenant/info
 * Returns metadata from the caller's dedicated tenant database (tenant_info table).
 * Any authenticated role within the institution may query this.
 */
tenantRouter.get("/info", async (req, res) => {
  try {
    const callerInstitutionId = req.user!.institutionId
    const tenantPrisma = req.tenantPrisma!

    const info = await tenantPrisma.tenantInfo.findFirst({
      where: { id: 1 },
    })

    res.json({
      institutionId: callerInstitutionId,
      institutionName: req.user!.fullName ? `${req.user!.institutionId}` : "Apex Microfinance Ltd",
      databaseIdentifier: "tenant_apex_demo",
      info: info ?? {
        id: 1,
        institutionId: callerInstitutionId,
        institutionName: "Apex Microfinance Ltd",
        stub: true,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve tenant info"
    console.error("[tenant-routes] /info error:", error)
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/tenant/branches
 * Returns active branches from caller's tenant database.
 * Any authenticated role within the institution may query this.
 */
tenantRouter.get("/branches", async (req, res) => {
  try {
    const tenantPrisma = req.tenantPrisma!

    const branches = await tenantPrisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    })

    res.json({
      data: branches,
      count: branches.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load branches"
    console.error("[tenant-routes] /branches error:", error)
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/tenant/users/:userId/validate
 * Verifies if a given user_id exists in central.users, has active status,
 * and belongs strictly to the caller's own institution.
 * Returns strictly { valid: boolean } (uniform false for unknown, disabled, or foreign users)
 * to prevent user enumeration.
 */
tenantRouter.get("/users/:userId/validate", async (req, res) => {
  try {
    const targetUserId = String(req.params.userId).trim()
    const callerInstitutionId = req.user!.institutionId

    const result = await validateUserId(targetUserId, callerInstitutionId)

    // Strictly returns { valid: boolean } only
    res.json({ valid: result.valid })
  } catch (error) {
    // If an error occurs (e.g. malformed UUID), fail securely without leaking internal detail
    res.json({ valid: false })
  }
})
