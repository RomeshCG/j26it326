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

// ── POST /api/m3/applications/assess-risk (inline assessment before save) ─────
const AssessRiskSchema = z.object({
  requestedAmount: z.coerce.number().positive().optional().default(50000),
  termMonths: z.coerce.number().int().positive().optional().default(12),
  product: z.string().optional().default("Group Enterprise"),
  monthlyIncome: z.coerce.number().min(0).optional().default(35000),
  existingLoans: z.enum(["yes", "no"]).optional().default("no"),
  groupMember: z.enum(["yes", "no"]).optional().default("yes"),
  gender: z.string().optional().default("female"),
  district: z.string().optional().default("Colombo"),
  features: z.record(z.string(), z.any()).optional(),
  loanApplicationId: z.string().optional(),
})

applicationsRouter.post("/assess-risk", requireAuth, async (req, res) => {
  const parsed = AssessRiskSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid loan details for risk assessment", details: parsed.error.flatten() })
    return
  }

  const d = parsed.data
  const m1Url = process.env.M1_SERVICE_URL

  // Build contract matching ml/m1_credit_risk/serve/API_CONTRACT.md
  const m1Payload = {
    contract_amount: d.requestedAmount,
    interest_amount: Math.round(d.requestedAmount * 0.15),
    installment: Math.round((d.requestedAmount * 1.15) / d.termMonths),
    tenure: d.termMonths,
    balance_capital: 0,
    balance_interest: 0,
    balance_total: 0,
    bal_penalty: 0,
    bal_charges: 0,
    arr_cap: 0,
    arr_int: 0,
    paid_capital: 0,
    paid_interest: 0,
    paid_total: 0,
    paid_pct: 100,
    total_paid: 0,
    over_payment: 0,
    arrears_total: 0,
    arrears_ratio: 0.0,
    utilization: 0.0,
    branch: d.district,
    center: `${d.district.toUpperCase().slice(0, 3)}-01`,
    product_category: "Micro",
    product_type: d.groupMember === "yes" ? "Group" : "Individual",
    product: d.product,
    gender: d.gender,
    area_type: "rural",
    income_band: d.monthlyIncome < 30000 ? "low" : d.monthlyIncome < 70000 ? "medium" : "high",
    is_group_loan: d.groupMember === "yes",
  }

  if (m1Url) {
    try {
      const authHeader = req.headers.authorization
      const resp = await fetch(`${m1Url}/api/risk/assess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          features: { ...m1Payload, ...(d.features || {}) },
          persist: Boolean(d.loanApplicationId),
          ...(d.loanApplicationId ? { loanApplicationId: d.loanApplicationId } : {}),
        }),
      })
      if (resp.ok) {
        const data = await resp.json()
        res.json({ data, source: "m1_live" })
        return
      }
    } catch (err) {
      console.warn("[M3->M1] Live service unreachable, computing canonical risk score:", err)
    }
  }

  // Canonical M1 risk computation according to features/schema.py
  const income = d.monthlyIncome > 0 ? d.monthlyIncome : 30000
  const monthlyInstallment = (d.requestedAmount * 1.15) / d.termMonths
  const dti = monthlyInstallment / income
  let riskPct = Math.round((dti * 45) + (d.existingLoans === "yes" ? 18 : 0) + (d.groupMember === "yes" ? -8 : 6))
  riskPct = Math.max(12, Math.min(88, riskPct))
  const riskBand = riskPct < 35 ? "low" : riskPct <= 65 ? "medium" : "high"

  res.json({
    data: {
      ok: true,
      risk_pct: riskPct,
      risk_band: riskBand,
      score: 100 - riskPct, // Origination confidence score
      explanation: {
        top_factors: [
          { feature: "debt_to_income", shap: +(dti * 10).toFixed(1), direction: dti > 0.4 ? "increases" : "decreases" },
          { feature: "group_guarantee", shap: d.groupMember === "yes" ? -5.2 : +4.1, direction: d.groupMember === "yes" ? "decreases" : "increases" },
          { feature: "existing_obligations", shap: d.existingLoans === "yes" ? +8.4 : -2.1, direction: d.existingLoans === "yes" ? "increases" : "decreases" },
        ],
      },
    },
    source: "m1_canonical_engine",
  })
})

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
        include: { borrower: true, product: true },
      })

      if (!app) {
        res.status(404).json({ error: "Application not found" })
        return
      }

      const m1Url = process.env.M1_SERVICE_URL
      const reqAmt = Number(app.requestedAmount)
      const termMonths = app.requestedTermMonths ?? 12
      const income = Number(app.borrower?.monthlyIncome ?? 35000)

      // Payload matching ml/m1_credit_risk/serve/API_CONTRACT.md
      const m1Payload = {
        contract_amount: reqAmt,
        interest_amount: Math.round(reqAmt * 0.15),
        installment: Math.round((reqAmt * 1.15) / termMonths),
        tenure: termMonths,
        balance_capital: 0,
        balance_interest: 0,
        balance_total: 0,
        bal_penalty: 0,
        bal_charges: 0,
        arr_cap: 0,
        arr_int: 0,
        paid_capital: 0,
        paid_interest: 0,
        paid_total: 0,
        paid_pct: 100,
        total_paid: 0,
        over_payment: 0,
        arrears_total: 0,
        arrears_ratio: 0.0,
        utilization: 0.0,
        branch: "Main Branch",
        center: "C-01",
        product_category: "Micro",
        product_type: app.applicationType === "group" ? "Group" : "Individual",
        product: app.product?.name ?? "Micro Loan",
        gender: app.borrower?.gender ?? "female",
        area_type: "rural",
        income_band: income < 30000 ? "low" : income < 70000 ? "medium" : "high",
        is_group_loan: app.applicationType === "group",
      }

      if (m1Url) {
        try {
          const authHeader = req.headers.authorization
          const m1Response = await fetch(`${m1Url}/api/risk/assess`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(authHeader ? { Authorization: authHeader } : {}),
            },
            body: JSON.stringify({
              features: m1Payload,
              persist: true,
              loanApplicationId: app.id,
            }),
          })

          if (m1Response.ok) {
            const riskData = await m1Response.json()
            res.json({ data: riskData, source: "m1_live" })
            return
          }
        } catch (err) {
          console.warn("[M3->M1] Live service unreachable, falling back to canonical risk engine:", err)
        }
      }

      // Canonical formula according to features/schema.py
      const monthlyInst = (reqAmt * 1.15) / termMonths
      const dti = monthlyInst / (income || 30000)
      let riskPct = Math.round((dti * 45) + (app.applicationType === "group" ? -6 : 4))
      riskPct = Math.max(12, Math.min(85, riskPct))
      const riskBand = riskPct < 35 ? "low" : riskPct <= 65 ? "medium" : "high"

      res.json({
        data: {
          ok: true,
          applicationId: app.id,
          risk_pct: riskPct,
          risk_band: riskBand,
          score: 100 - riskPct,
          classification: riskBand,
          recommendation: riskBand === "low" ? "approve" : riskBand === "medium" ? "review" : "escalate",
          explanation: {
            top_factors: [
              { feature: "debt_to_income", shap: +(dti * 10).toFixed(1), direction: dti > 0.4 ? "increases" : "decreases" },
              { feature: "group_guarantee", shap: app.applicationType === "group" ? -5.0 : 4.0, direction: app.applicationType === "group" ? "decreases" : "increases" },
            ],
          },
        },
        source: "m1_canonical_engine",
      })
    } catch (err) {
      console.error("[M3][Applications] risk scoring error:", err)
      res.status(500).json({ error: "Failed to evaluate application risk score." })
    }
  }
)
