/**
 * M3 — Rule-based PAR (Portfolio At Risk) computer.
 *
 * Walks every active loan in a tenant DB, computes days-past-due for each
 * outstanding installment, buckets the loan, and upserts a par_status row.
 *
 * PAR buckets:
 *   current  → daysPastDue = 0
 *   PAR1     → 1–29 days past due
 *   PAR30    → 30–89 days past due
 *   PAR90    → 90+ days past due
 *
 * Usage:
 *   import { computePar } from "./par-computer.js"
 *   const result = await computePar(tenantPrisma)
 */
import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client/index.js"

export type ParSummary = {
  computed: number
  byBucket: Record<string, number>
  par30Ratio: number // outstanding PAR30+ / total outstanding
  computedAt: Date
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function parBucket(dpd: number): string {
  if (dpd <= 0) return "current"
  if (dpd < 30) return "PAR1"
  if (dpd < 90) return "PAR30"
  return "PAR90"
}

export async function computePar(prisma: PrismaClient): Promise<ParSummary> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Fetch all active loans with their schedules
  const loans = await prisma.loan.findMany({
    where: { status: { in: ["active", "pending_disbursement"] } },
    include: {
      schedules: {
        where: { status: { not: "paid" } },
        orderBy: { dueDate: "asc" },
      },
    },
  })

  const byBucket: Record<string, number> = {
    current: 0,
    PAR1: 0,
    PAR30: 0,
    PAR90: 0,
  }
  let totalOutstanding = 0
  let par30Outstanding = 0

  for (const loan of loans) {
    const overdueSchedules = loan.schedules.filter(
      (s) => new Date(s.dueDate) < today
    )

    let dpd = 0
    let outstandingPrincipal = 0

    if (overdueSchedules.length > 0) {
      // DPD = today minus the oldest unpaid due date
      const oldest = new Date(overdueSchedules[0].dueDate)
      dpd = daysBetween(oldest, today)

      // Outstanding principal = sum of (principalDue - portion already paid per schedule)
      // Simplified: use principalDue of overdue schedules (amountPaid may cover interest first)
      outstandingPrincipal = overdueSchedules.reduce(
        (sum, s) => sum + Number(s.principalDue),
        0
      )
    }

    const bucket = parBucket(dpd)
    byBucket[bucket] = (byBucket[bucket] ?? 0) + 1
    totalOutstanding += outstandingPrincipal

    if (dpd >= 30) par30Outstanding += outstandingPrincipal

    // Upsert par_status — one row per loan per computation
    await prisma.parStatus.create({
      data: {
        loanId: loan.id,
        parBucket: bucket,
        daysPastDue: dpd,
        outstandingPrincipal: outstandingPrincipal,
        computedAt: today,
      },
    })
  }

  const par30Ratio = totalOutstanding > 0 ? par30Outstanding / totalOutstanding : 0

  return {
    computed: loans.length,
    byBucket,
    par30Ratio: Math.round(par30Ratio * 10000) / 10000,
    computedAt: today,
  }
}

/**
 * Returns the latest PAR summary without re-computing.
 * Aggregates the most recent par_status row per loan.
 */
export async function getParSummary(prisma: PrismaClient): Promise<ParSummary> {
  // Get the latest computedAt timestamp
  const latest = await prisma.parStatus.findFirst({
    orderBy: { computedAt: "desc" },
    select: { computedAt: true },
  })

  if (!latest) {
    return {
      computed: 0,
      byBucket: { current: 0, PAR1: 0, PAR30: 0, PAR90: 0 },
      par30Ratio: 0,
      computedAt: new Date(),
    }
  }

  // Count by bucket for the latest run
  const rows = await prisma.parStatus.findMany({
    where: { computedAt: latest.computedAt },
  })

  const byBucket: Record<string, number> = { current: 0, PAR1: 0, PAR30: 0, PAR90: 0 }
  let totalOutstanding = 0
  let par30Outstanding = 0

  for (const row of rows) {
    byBucket[row.parBucket] = (byBucket[row.parBucket] ?? 0) + 1
    const op = Number(row.outstandingPrincipal ?? 0)
    totalOutstanding += op
    if (row.parBucket === "PAR30" || row.parBucket === "PAR90") par30Outstanding += op
  }

  return {
    computed: rows.length,
    byBucket,
    par30Ratio: totalOutstanding > 0
      ? Math.round((par30Outstanding / totalOutstanding) * 10000) / 10000
      : 0,
    computedAt: latest.computedAt,
  }
}
