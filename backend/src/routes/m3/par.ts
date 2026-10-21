/**
 * M3 — PAR (Portfolio at Risk) routes
 * POST /api/m3/par/compute   Trigger rule-based PAR computation for this tenant
 * GET  /api/m3/par/summary   Get latest PAR summary (no re-compute)
 */
import { Router } from "express"
import { z } from "zod"
import { requireAuth, requireRole } from "../../lib/m3/mock-auth.js"
import { resolveTenant } from "../../lib/m3/tenant-guard.js"
import { computePar, getParSummary } from "../../lib/m3/par-computer.js"

export const parRouter = Router()

const ParSummaryQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD").optional(),
})

// ── POST /api/m3/par/compute ─────────────────────────────────────────────────
parRouter.post(
  "/compute",
  requireAuth,
  requireRole("branch_manager", "finance_officer", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    try {
      const summary = await computePar(tenant.prisma)
      res.json({ data: summary })
    } catch (err) {
      console.error("[M3][PAR] compute error:", err)
      res.status(500).json({
        error: "Unable to complete portfolio-at-risk calculation. Please verify database connectivity.",
      })
    }
  }
)

// ── GET /api/m3/par/summary ───────────────────────────────────────────────────
parRouter.get("/summary", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const parsed = ParSummaryQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten().fieldErrors,
    })
    return
  }

  try {
    const summary = await getParSummary(tenant.prisma)
    res.json({ data: summary })
  } catch (err) {
    console.error("[M3][PAR] summary error:", err)
    res.status(500).json({
      error: "Unable to retrieve portfolio-at-risk summary. Please try again later.",
    })
  }
})
