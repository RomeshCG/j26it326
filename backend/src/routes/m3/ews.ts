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

// Input validation schemas
const AlertsQuerySchema = z.object({
  status: z.enum(["new", "in_progress", "resolved", "dismissed", "open"]).optional(),
  branchId: z.string().uuid("Invalid branchId format").optional(),
  assignedOfficerId: z.string().uuid("Invalid assignedOfficerId format").optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const ScoresQuerySchema = z.object({
  borrowerId: z.string().uuid("Invalid borrowerId format").optional(),
  groupId: z.string().uuid("Invalid groupId format").optional(),
  riskBand: z.enum(["low", "medium", "watch", "high", "critical"]).optional(),
})

const InterventionSchema = z.object({
  actionTaken: z.string().min(1, "Action taken is required").max(1000),
  outcome: z.string().max(1000).optional(),
  resolveAlert: z.boolean().optional().default(false),
})

const UuidParamSchema = z.object({
  id: z.string().uuid("Invalid alert ID format"),
})

// ── GET /api/m3/ews/alerts ────────────────────────────────────────────────────
ewsRouter.get("/alerts", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const parsed = AlertsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const { status: rawStatus, branchId, assignedOfficerId, limit, offset } = parsed.data

  // Map 'open' alias to active statuses
  const statusFilter =
    rawStatus === "open"
      ? { status: { in: ["new", "in_progress"] } }
      : rawStatus
      ? { status: rawStatus }
      : { status: { in: ["new", "in_progress"] } }

  // Loan officers see their assigned alerts or unassigned alerts in pool
  const officerFilter =
    req.auth?.role === "loan_officer"
      ? {
          OR: [
            { assignedOfficerId: req.auth.userId },
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
      take: limit,
      skip: offset,
    })
    res.json({ data: alerts })
  } catch (err) {
    console.error("[M3][EWS] alerts list error:", err)
    res.status(500).json({ error: "Failed to retrieve distress alerts. Please try again later." })
  }
})

// ── GET /api/m3/ews/alerts/:id ────────────────────────────────────────────────
ewsRouter.get("/alerts/:id", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const paramParsed = UuidParamSchema.safeParse(req.params)
  if (!paramParsed.success) {
    res.status(400).json({
      error: "Invalid alert ID format",
      details: paramParsed.error.flatten().fieldErrors,
    })
    return
  }

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
    console.error("[M3][EWS] alert detail error:", err)
    res.status(500).json({ error: "Failed to retrieve alert details. Please try again later." })
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

    const paramParsed = UuidParamSchema.safeParse(req.params)
    if (!paramParsed.success) {
      res.status(400).json({
        error: "Invalid alert ID format",
        details: paramParsed.error.flatten().fieldErrors,
      })
      return
    }

    try {
      const updated = await tenant.prisma.ewsAlert.update({
        where: { id: p(req.params.id) },
        data: { status: "in_progress" },
      })
      res.json({ data: updated })
    } catch (err) {
      console.error("[M3][EWS] alert acknowledge error:", err)
      res.status(500).json({ error: "Failed to acknowledge alert. Please try again later." })
    }
  }
)

// ── POST /api/m3/ews/alerts/:id/interventions ────────────────────────────────
ewsRouter.post(
  "/alerts/:id/interventions",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const paramParsed = UuidParamSchema.safeParse(req.params)
    if (!paramParsed.success) {
      res.status(400).json({
        error: "Invalid alert ID format",
        details: paramParsed.error.flatten().fieldErrors,
      })
      return
    }

    const parsed = InterventionSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid intervention payload",
        details: parsed.error.flatten().fieldErrors,
      })
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
      console.error("[M3][EWS] log intervention error:", err)
      res.status(500).json({ error: "Failed to record intervention. Please verify inputs and retry." })
    }
  }
)

// ── GET /api/m3/ews/scores ────────────────────────────────────────────────────
ewsRouter.get("/scores", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const parsed = ScoresQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const { borrowerId, groupId, riskBand } = parsed.data

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
    console.error("[M3][EWS] scores error:", err)
    res.status(500).json({ error: "Failed to fetch early warning risk scores." })
  }
})

// ── POST /api/m3/ews/batch-score ─────────────────────────────────────────────
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
          res.status(502).json({ error: "Early warning ML service returned an error status." })
          return
        }

        const mlData = await mlResponse.json()
        res.json({ data: mlData, source: "ml_live" })
      } catch (err) {
        console.error("[M3][EWS] ML service batch scoring error:", err)
        res.status(502).json({ error: "Unable to reach Early Warning ML scoring service." })
      }
    } else {
      // ── Heuristic fallback ──────────────────────────────────────
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
        console.error("[M3][EWS] fallback batch-score error:", err)
        res.status(500).json({ error: "Batch scoring failed to complete." })
      }
    }
  }
)
