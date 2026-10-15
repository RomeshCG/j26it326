/**
 * M3 — EWS (Early Warning System) routes
 *
 * GET   /api/m3/ews/alerts                        Loan officer alert inbox (ranked by distress score)
 * GET   /api/m3/ews/alerts/:id                    Alert detail + interventions
 * PATCH /api/m3/ews/alerts/:id/acknowledge        Mark alert seen
 * POST  /api/m3/ews/alerts/:id/interventions      Log intervention action + outcome
 * GET   /api/m3/ews/scores                        Current EWS scores (filter: borrowerId, riskBand)
 * POST  /api/m3/ews/batch-score                   Trigger batch scoring (calls ML service or PAR fallback)
 */
import { Router } from "express"
import { z } from "zod"
import { requireAuth, requireRole } from "../../lib/m3/mock-auth.js"
import { resolveTenant } from "../../lib/m3/tenant-guard.js"
import { computePar } from "../../lib/m3/par-computer.js"
import { qs, p } from "../../lib/m3/query-helpers.js"

export const ewsRouter = Router()

// ── GET /api/m3/ews/alerts ────────────────────────────────────────────────────
ewsRouter.get("/alerts", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const rawStatus = qs(req.query.status as string | string[] | undefined)
  const branchId = qs(req.query.branchId as string | string[] | undefined)
  const assignedOfficerId = qs(req.query.assignedOfficerId as string | string[] | undefined)

  // Map 'open' alias to active statuses
  const statusFilter =
    rawStatus === "open"
      ? { status: { in: ["new", "in_progress"] } }
      : rawStatus
      ? { status: rawStatus }
      : { status: { in: ["new", "in_progress"] } }

  // Loan officers see their assigned alerts or unassigned alerts in pool
  const officerFilter =
    req.auth!.role === "loan_officer"
      ? {
          OR: [
            { assignedOfficerId: req.auth!.userId },
            { assignedOfficerId: null },
          ],
        }
      : assignedOfficerId
      ? { assignedOfficerId }
      : {}

  try {
    const alerts = await tenant.prisma.ewsAlert.findMany({
      where: {
        ...statusFilter,
        ...(branchId ? { branchId } : {}),
        ...officerFilter,
      },
      include: {
        ewsScore: {
          include: {
            borrower: { select: { id: true, fullName: true, nicNumber: true } },
            group: { select: { id: true, groupName: true } },
          },
        },
        interventions: { orderBy: { loggedAt: "desc" }, take: 1 },
      },
      orderBy: [
        { ewsScore: { distressScore: "desc" } }, // highest distress first
        { createdAt: "desc" },
      ],
    })
    res.json({ data: alerts })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list alerts"
    res.status(500).json({ error: message })
  }
})

// ── GET /api/m3/ews/alerts/:id ────────────────────────────────────────────────
ewsRouter.get("/alerts/:id", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  try {
    const alert = await tenant.prisma.ewsAlert.findUnique({
      where: { id: p(req.params.id) },
      include: {
        ewsScore: {
          include: {
            borrower: true,
            group: true,
          },
        },
        interventions: { orderBy: { loggedAt: "asc" } },
      },
    })

    if (!alert) {
      res.status(404).json({ error: "Alert not found" })
      return
    }

    res.json({ data: alert })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch alert"
    res.status(500).json({ error: message })
  }
})

// ── PATCH /api/m3/ews/alerts/:id/acknowledge ─────────────────────────────────
ewsRouter.patch(
  "/alerts/:id/acknowledge",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    try {
      const updated = await tenant.prisma.ewsAlert.update({
        where: { id: p(req.params.id) },
        data: { status: "in_progress" },
      })
      res.json({ data: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to acknowledge alert"
      res.status(500).json({ error: message })
    }
  }
)

// ── POST /api/m3/ews/alerts/:id/interventions ────────────────────────────────
const InterventionSchema = z.object({
  actionTaken: z.string().min(1),
  outcome: z.string().optional(),
  resolveAlert: z.boolean().optional().default(false),
})

ewsRouter.post(
  "/alerts/:id/interventions",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = InterventionSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const d = parsed.data

    try {
      const intervention = await tenant.prisma.intervention.create({
        data: {
          alertId: p(req.params.id),
          officerId: req.auth!.userId,
          actionTaken: d.actionTaken,
          outcome: d.outcome,
        },
      })

      // Optionally resolve the alert
      if (d.resolveAlert) {
        await tenant.prisma.ewsAlert.update({
          where: { id: p(req.params.id) },
          data: { status: "resolved", resolvedAt: new Date() },
        })
      }

      res.status(201).json({ data: intervention })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to log intervention"
      res.status(500).json({ error: message })
    }
  }
)

// ── GET /api/m3/ews/scores ────────────────────────────────────────────────────
ewsRouter.get("/scores", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const borrowerId = qs(req.query.borrowerId as string | string[] | undefined)
  const groupId = qs(req.query.groupId as string | string[] | undefined)
  const riskBand = qs(req.query.riskBand as string | string[] | undefined)

  try {
    const scores = await tenant.prisma.ewsScore.findMany({
      where: {
        ...(borrowerId ? { borrowerId } : {}),
        ...(groupId ? { groupId } : {}),
        ...(riskBand ? { riskBand } : {}),
      },
      include: {
        borrower: { select: { id: true, fullName: true } },
        group: { select: { id: true, groupName: true } },
      },
      orderBy: [{ distressScore: "desc" }, { computedAt: "desc" }],
    })
    res.json({ data: scores })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch EWS scores"
    res.status(500).json({ error: message })
  }
})

// ── POST /api/m3/ews/batch-score ─────────────────────────────────────────────
// Calls ML scoring service when available; falls back to PAR-derived heuristic.
ewsRouter.post(
  "/batch-score",
  requireAuth,
  requireRole("branch_manager", "finance_officer", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const mlUrl = process.env.M3_ML_SERVICE_URL

    if (mlUrl) {
      // ── Real ML service call ──────────────────────────────────────────────
      try {
        const mlResponse = await fetch(`${mlUrl}/score-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ institutionId: tenant.institutionId }),
        })

        if (!mlResponse.ok) {
          res.status(502).json({ error: "ML service returned an error" })
          return
        }

        const mlData = await mlResponse.json()
        res.json({ data: mlData, source: "ml_live" })
      } catch (err) {
        const message = err instanceof Error ? err.message : "ML service call failed"
        res.status(502).json({ error: message })
      }
    } else {
      // ── PAR-based heuristic fallback ──────────────────────────────────────
      // Uses PAR bucket to create EWS scores + alerts for overdue loans.
      try {
        const parSummary = await computePar(tenant.prisma)

        // Fetch loans that are PAR30 or PAR90 from latest computation
        const at = parSummary.computedAt
        const overdueRows = await tenant.prisma.parStatus.findMany({
          where: {
            computedAt: at,
            parBucket: { in: ["PAR30", "PAR90"] },
          },
          include: {
            loan: {
              select: {
                id: true,
                borrowerId: true,
                groupId: true,
                principal: true,
              },
            },
          },
        })

        let alertsCreated = 0
        for (const par of overdueRows) {
          const distressScore = par.parBucket === "PAR90" ? 0.85 : 0.60
          const riskBand = par.parBucket === "PAR90" ? "high" : "watch"
          const rationale = `Loan is ${par.daysPastDue} days past due (${par.parBucket} bucket).`

          const score = await tenant.prisma.ewsScore.create({
            data: {
              borrowerId: par.loan.borrowerId,
              groupId: par.loan.groupId ?? undefined,
              distressScore,
              riskBand,
              modelVersion: "rule_based_par_v1",
              fusionSummary: { parBucket: par.parBucket, daysPastDue: par.daysPastDue },
            },
          })

          // Find branch from loan → borrower → branch
          const borrower = await tenant.prisma.borrower.findUnique({
            where: { id: par.loan.borrowerId },
            select: { branchId: true },
          })

          if (borrower) {
            await tenant.prisma.ewsAlert.create({
              data: {
                ewsScoreId: score.id,
                branchId: borrower.branchId,
                rationale,
                status: "new",
              },
            })
            alertsCreated++
          }
        }

        res.json({
          data: {
            ...parSummary,
            alertsCreated,
          },
          source: "rule_based_par_fallback",
          note: "Set M3_ML_SERVICE_URL env var to use the trained ML model",
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Batch scoring failed"
        res.status(500).json({ error: message })
      }
    }
  }
)
