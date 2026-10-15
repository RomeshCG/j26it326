/**
 * M3 — PAR (Portfolio at Risk) routes
 * POST /api/m3/par/compute   Trigger rule-based PAR computation for this tenant
 * GET  /api/m3/par/summary   Get latest PAR summary (no re-compute)
 */
import { Router } from "express"
import { requireAuth, requireRole } from "../../lib/m3/mock-auth.js"
import { resolveTenant } from "../../lib/m3/tenant-guard.js"
import { computePar, getParSummary } from "../../lib/m3/par-computer.js"

export const parRouter = Router()

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
      const message = err instanceof Error ? err.message : "PAR computation failed"
      res.status(500).json({ error: message })
    }
  }
)

// ── GET /api/m3/par/summary ───────────────────────────────────────────────────
parRouter.get("/summary", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  try {
    const summary = await getParSummary(tenant.prisma)
    res.json({ data: summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch PAR summary"
    res.status(500).json({ error: message })
  }
})
