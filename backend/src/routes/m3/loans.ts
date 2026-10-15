/**
 * M3 — Loans routes
 * GET  /api/m3/loans               List loans (filter: borrowerId, groupId, status)
 * GET  /api/m3/loans/:id           Loan detail + schedule + collections
 * GET  /api/m3/loans/:id/schedule  Repayment schedule only
 * POST /api/m3/loans/:id/disburse  Record disbursement → activate loan + emit M2 event
 */
import { Router } from "express"
import { z } from "zod"
import { requireAuth, requireRole } from "../../lib/m3/mock-auth.js"
import { resolveTenant } from "../../lib/m3/tenant-guard.js"
import { emitLoanDisbursed } from "../../lib/m3/m2-events.js"
import { qs, p } from "../../lib/m3/query-helpers.js"

export const loansRouter = Router()

// ── GET /api/m3/loans ─────────────────────────────────────────────────────────
loansRouter.get("/", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const borrowerId = qs(req.query.borrowerId as string | string[] | undefined)
  const groupId = qs(req.query.groupId as string | string[] | undefined)
  const status = qs(req.query.status as string | string[] | undefined)

  try {
    const loans = await tenant.prisma.loan.findMany({
      where: {
        ...(borrowerId ? { borrowerId } : {}),
        ...(groupId ? { groupId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        product: { select: { id: true, name: true } },
        borrower: { select: { id: true, fullName: true, nicNumber: true } },
        group: { select: { id: true, groupName: true } },
        _count: { select: { schedules: true, collections: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    res.json({ data: loans })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list loans"
    res.status(500).json({ error: message })
  }
})

// ── GET /api/m3/loans/:id ────────────────────────────────────────────────────
loansRouter.get("/:id", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  try {
    const loan = await tenant.prisma.loan.findUnique({
      where: { id: p(req.params.id) },
      include: {
        product: true,
        borrower: true,
        group: true,
        disbursements: { orderBy: { createdAt: "desc" } },
        schedules: { orderBy: { installmentNo: "asc" } },
        collections: {
          orderBy: { visitDate: "desc" },
          take: 20,
          include: { receipts: true },
        },
        parStatuses: { orderBy: { computedAt: "desc" }, take: 1 },
      },
    })

    if (!loan) {
      res.status(404).json({ error: "Loan not found" })
      return
    }

    res.json({ data: loan })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch loan"
    res.status(500).json({ error: message })
  }
})

// ── GET /api/m3/loans/:id/schedule ──────────────────────────────────────────
loansRouter.get("/:id/schedule", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  try {
    const schedules = await tenant.prisma.repaymentSchedule.findMany({
      where: { loanId: p(req.params.id) },
      orderBy: { installmentNo: "asc" },
    })
    res.json({ data: schedules })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch schedule"
    res.status(500).json({ error: message })
  }
})

// ── POST /api/m3/loans/:id/disburse ─────────────────────────────────────────
const DisburseSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1), // bank_transfer | cash | mobile_money
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  disbursedAt: z.string().optional(), // ISO datetime — defaults to now
})

loansRouter.post(
  "/:id/disburse",
  requireAuth,
  requireRole("branch_manager", "finance_officer", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = DisburseSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const d = parsed.data

    try {
      const loan = await tenant.prisma.loan.findUnique({
        where: { id: p(req.params.id) },
      })

      if (!loan) {
        res.status(404).json({ error: "Loan not found" })
        return
      }
      if (loan.status !== "pending_disbursement") {
        res.status(409).json({
          error: `Loan status is '${loan.status}' — can only disburse 'pending_disbursement' loans`,
        })
        return
      }

      const disbursedAt = d.disbursedAt ? new Date(d.disbursedAt) : new Date()

      const [disbursement, updatedLoan] = await tenant.prisma.$transaction(async (tx) => {
        const dis = await tx.disbursement.create({
          data: {
            loanId: loan.id,
            amount: d.amount,
            method: d.method,
            referenceNumber: d.referenceNumber,
            status: "completed",
            disbursedBy: req.auth!.userId,
            disbursedAt,
            notes: d.notes,
          },
        })

        const updated = await tx.loan.update({
          where: { id: loan.id },
          data: {
            status: "active",
            activatedAt: disbursedAt,
          },
        })

        return [dis, updated]
      })

      // Emit event to M2 (best-effort — don't fail the disbursement if M2 is down)
      emitLoanDisbursed({
        loanId: loan.id,
        disbursementId: disbursement.id,
        amount: d.amount,
        date: disbursedAt.toISOString(),
        institutionId: tenant.institutionId,
      }).catch((err) =>
        console.error("[M3→M2] Failed to emit loan_disbursed event:", err)
      )

      res.status(201).json({ data: { disbursement, loan: updatedLoan } })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disburse loan"
      res.status(500).json({ error: message })
    }
  }
)
