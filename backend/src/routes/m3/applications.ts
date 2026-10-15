/**
 * M3 — Loan Application routes
 *
 * POST  /api/m3/applications                    Create draft application
 * GET   /api/m3/applications                    List applications (filter: status, branchId)
 * GET   /api/m3/applications/:id                Full application detail
 * POST  /api/m3/applications/:id/submit         Draft → submitted
 * POST  /api/m3/applications/:id/approve        Branch manager: approve → creates Loan + schedule
 * POST  /api/m3/applications/:id/reject         Branch manager: reject
 * POST  /api/m3/applications/:id/risk-score     Proxy call to M1 /assess-risk (stub until M1 ready)
 */
import { Router } from "express"
import { z } from "zod"
import { requireAuth, requireRole } from "../../lib/m3/mock-auth.js"
import { resolveTenant } from "../../lib/m3/tenant-guard.js"
import { generateSchedule } from "../../lib/m3/schedule-generator.js"
import { qs, p } from "../../lib/m3/query-helpers.js"

export const applicationsRouter = Router()

// ── POST /api/m3/applications ────────────────────────────────────────────────
const CreateApplicationSchema = z
  .object({
    branchId: z.string().uuid(),
    productId: z.string().uuid(),
    applicationType: z.enum(["individual", "group"]),
    borrowerId: z.string().uuid().optional(),
    groupId: z.string().uuid().optional(),
    requestedAmount: z.number().positive(),
    requestedTermMonths: z.number().int().positive().optional(),
    purpose: z.string().optional(),
    purposeDetail: z.string().optional(),
    collateralType: z.string().optional(),
    collateralDetail: z.record(z.string(), z.unknown()).optional(),
    guarantorName: z.string().optional(),
    guarantorNic: z.string().optional(),
    guarantorContact: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.applicationType === "individual" && !d.borrowerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Individual applications require borrowerId",
        path: ["borrowerId"],
      })
    }
    if (d.applicationType === "group" && !d.groupId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Group applications require groupId",
        path: ["groupId"],
      })
    }
  })

applicationsRouter.post(
  "/",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = CreateApplicationSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const d = parsed.data
    try {
      const application = await tenant.prisma.loanApplication.create({
        data: {
          branchId: d.branchId,
          productId: d.productId,
          applicationType: d.applicationType,
          borrowerId: d.borrowerId,
          groupId: d.groupId,
          requestedAmount: d.requestedAmount,
          requestedTermMonths: d.requestedTermMonths,
          purpose: d.purpose,
          purposeDetail: d.purposeDetail,
          collateralType: d.collateralType,
          collateralDetail: (d.collateralDetail as any) ?? undefined,
          guarantorName: d.guarantorName,
          guarantorNic: d.guarantorNic,
          guarantorContact: d.guarantorContact,
          submittedBy: req.auth!.userId,
          status: "draft",
        },
      })
      res.status(201).json({ data: application })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create application"
      res.status(500).json({ error: message })
    }
  }
)

// ── GET /api/m3/applications ─────────────────────────────────────────────────
applicationsRouter.get("/", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const status = qs(req.query.status as string | string[] | undefined)
  const branchId = qs(req.query.branchId as string | string[] | undefined)
  const submittedBy = qs(req.query.submittedBy as string | string[] | undefined)
  const applicationType = qs(req.query.applicationType as string | string[] | undefined)

  try {
    const applications = await tenant.prisma.loanApplication.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(branchId ? { branchId } : {}),
        ...(submittedBy ? { submittedBy } : {}),
        ...(applicationType ? { applicationType } : {}),
      },
      include: {
        product: { select: { id: true, name: true, productCategory: true } },
        borrower: { select: { id: true, fullName: true, nicNumber: true } },
        group: { select: { id: true, groupName: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    res.json({ data: applications })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list applications"
    res.status(500).json({ error: message })
  }
})

// ── GET /api/m3/applications/:id ─────────────────────────────────────────────
applicationsRouter.get("/:id", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  try {
    const application = await tenant.prisma.loanApplication.findUnique({
      where: { id: p(req.params.id) },
      include: {
        product: true,
        borrower: true,
        group: { include: { members: { include: { borrower: { select: { fullName: true } } } } } },
        documents: true,
        loans: {
          select: { id: true, status: true, principal: true, activatedAt: true },
        },
      },
    })

    if (!application) {
      res.status(404).json({ error: "Application not found" })
      return
    }

    res.json({ data: application })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch application"
    res.status(500).json({ error: message })
  }
})

// ── POST /api/m3/applications/:id/submit ─────────────────────────────────────
applicationsRouter.post(
  "/:id/submit",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    try {
      const app = await tenant.prisma.loanApplication.findUnique({
        where: { id: p(req.params.id) },
      })

      if (!app) {
        res.status(404).json({ error: "Application not found" })
        return
      }
      if (app.status !== "draft") {
        res.status(409).json({ error: `Application is already in status '${app.status}'` })
        return
      }

      const updated = await tenant.prisma.loanApplication.update({
        where: { id: p(req.params.id) },
        data: { status: "submitted" },
      })
      res.json({ data: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit application"
      res.status(500).json({ error: message })
    }
  }
)

// ── POST /api/m3/applications/:id/approve ────────────────────────────────────
const ApproveSchema = z.object({
  approvedAmount: z.number().positive().optional(),
  termMonths: z.number().int().positive().optional(),
  interestRate: z.number().positive().optional(),
  scheduleMethod: z.enum(["flat", "declining"]).optional().default("flat"),
  decisionNotes: z.string().optional(),
  disbursementDate: z.string().optional(),
})

applicationsRouter.post(
  "/:id/approve",
  requireAuth,
  requireRole("branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = ApproveSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const opts = parsed.data

    try {
      // Include product so we have defaultInterestRate + term bounds
      const app = await tenant.prisma.loanApplication.findUnique({
        where: { id: p(req.params.id) },
        include: {
          product: true,
          borrower: true,
        },
      })

      if (!app) {
        res.status(404).json({ error: "Application not found" })
        return
      }
      if (app.status !== "submitted") {
        res.status(409).json({
          error: `Application must be in 'submitted' status to approve (currently '${app.status}')`,
        })
        return
      }

      // Resolve final loan parameters
      const principal = Number(opts.approvedAmount ?? app.requestedAmount)
      const termMonths = opts.termMonths ?? app.requestedTermMonths ?? app.product.minTermMonths
      // interestRate stored as percentage in DB (e.g. 24 for 24%)
      const interestRate = opts.interestRate ?? Number(app.product.defaultInterestRate)

      // Determine borrowerId for the Loan record
      let borrowerId = app.borrowerId
      if (!borrowerId && app.groupId) {
        const group = await tenant.prisma.lendingGroup.findUnique({
          where: { id: app.groupId },
          include: { members: { take: 1, orderBy: { joinedAt: "asc" } } },
        })
        borrowerId = group?.leaderBorrowerId ?? group?.members[0]?.borrowerId ?? null
      }
      if (!borrowerId) {
        res.status(422).json({
          error: "Cannot approve: no borrower resolved for this application",
        })
        return
      }

      // First installment due: disbursementDate + 1 month, or today + 1 month
      const baseDate = opts.disbursementDate ? new Date(opts.disbursementDate) : new Date()
      baseDate.setMonth(baseDate.getMonth() + 1)
      baseDate.setHours(0, 0, 0, 0)
      const firstDueDate = baseDate

      const scheduleRows = generateSchedule({
        principal,
        annualInterestRate: interestRate / 100, // e.g. 24 → 0.24
        termMonths,
        firstDueDate,
        method: opts.scheduleMethod,
      })

      // Transactional: update application + create loan + bulk-create schedule
      const [updatedApp, loan] = await tenant.prisma.$transaction(async (tx) => {
        const updated = await tx.loanApplication.update({
          where: { id: p(req.params.id) },
          data: {
            status: "approved",
            reviewedBy: req.auth!.userId,
            reviewedAt: new Date(),
            decisionNotes: opts.decisionNotes,
          },
        })

        const newLoan = await tx.loan.create({
          data: {
            applicationId: p(req.params.id),
            productId: app.productId,
            borrowerId: borrowerId!,
            groupId: app.groupId,
            principal,
            interestRate,
            termMonths,
            status: "pending_disbursement",
          },
        })

        await tx.repaymentSchedule.createMany({
          data: scheduleRows.map((row) => ({
            loanId: newLoan.id,
            installmentNo: row.installmentNo,
            dueDate: row.dueDate,
            principalDue: row.principalDue,
            interestDue: row.interestDue,
            amountDue: row.amountDue,
            amountPaid: 0,
            status: "upcoming",
          })),
        })

        return [updated, newLoan]
      })

      res.json({
        data: {
          application: updatedApp,
          loan,
          scheduleCount: scheduleRows.length,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve application"
      res.status(500).json({ error: message })
    }
  }
)

// ── POST /api/m3/applications/:id/reject ─────────────────────────────────────
const RejectSchema = z.object({
  decisionNotes: z.string().min(1, "Rejection reason is required"),
})

applicationsRouter.post(
  "/:id/reject",
  requireAuth,
  requireRole("branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = RejectSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    try {
      const app = await tenant.prisma.loanApplication.findUnique({
        where: { id: p(req.params.id) },
      })

      if (!app) {
        res.status(404).json({ error: "Application not found" })
        return
      }
      if (!["submitted", "draft"].includes(app.status)) {
        res.status(409).json({ error: `Cannot reject application in status '${app.status}'` })
        return
      }

      const updated = await tenant.prisma.loanApplication.update({
        where: { id: p(req.params.id) },
        data: {
          status: "rejected",
          reviewedBy: req.auth!.userId,
          reviewedAt: new Date(),
          decisionNotes: parsed.data.decisionNotes,
        },
      })
      res.json({ data: updated })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reject application"
      res.status(500).json({ error: message })
    }
  }
)

// ── POST /api/m3/applications/:id/risk-score ─────────────────────────────────
applicationsRouter.post(
  "/:id/risk-score",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    try {
      const app = await tenant.prisma.loanApplication.findUnique({
        where: { id: p(req.params.id) },
        include: { borrower: true },
      })

      if (!app) {
        res.status(404).json({ error: "Application not found" })
        return
      }

      const m1Url = process.env.M1_SERVICE_URL

      if (m1Url) {
        // ── Real M1 call ──────────────────────────────────────────────────────
        const m1Response = await fetch(`${m1Url}/assess-risk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: app.id,
            borrowerId: app.borrowerId,
            loanAmount: Number(app.requestedAmount),
            termMonths: app.requestedTermMonths,
            borrowerFeatures: {
              gender: app.borrower?.gender,
              monthlyIncome: Number(app.borrower?.monthlyIncome ?? 0),
              householdSize: app.borrower?.householdSize,
              isNewToBanking: app.borrower?.isNewToBanking,
              povertyProxyScore: Number(app.borrower?.povertyProxyScore ?? 0),
              occupation: app.borrower?.occupation,
            },
          }),
        })

        if (!m1Response.ok) {
          res.status(502).json({ error: "M1 risk service returned an error" })
          return
        }

        const riskData = await m1Response.json()
        res.json({ data: riskData, source: "m1_live" })
      } else {
        // ── Stub response ─────────────────────────────────────────────────────
        res.json({
          data: {
            applicationId: app.id,
            riskScore: 0.42,
            classification: "medium",
            recommendation: "review",
            shapPayload: null,
          },
          source: "stub",
          note: "Set M1_SERVICE_URL env var to connect to the real M1 risk engine",
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Risk scoring failed"
      res.status(500).json({ error: message })
    }
  }
)
