/**
 * M2 routes (Finance and Mission). Mounted at /api/m2 with ONE line in index.ts.
 *
 * Auth chain on every route: authenticate -> resolveTenantContext -> requireRole(finance_officer, executive, admin)
 * All DB access goes through req.tenantPrisma (never a new PrismaClient).
 *
 * Response shapes follow the existing C2 frontend pages (finance dashboard, drift dashboard/detail, social performance).
 */
import { Router, type Request } from "express"
import { z } from "zod"
import { authenticate, resolveTenantContext, requireRole } from "../middleware/auth.js"
import { balanceSheet, profitAndLoss } from "../lib/m2/reports.js"

export const m2Router = Router()

m2Router.use(authenticate, resolveTenantContext, requireRole("finance_officer", "executive", "admin"))

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

function bad(res: import("express").Response, err: z.ZodError) {
  res.status(400).json({ error: "Invalid request", details: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) })
}
const db = (req: Request) => req.tenantPrisma!

// ---------------------------------------------------------------- ledger

m2Router.get("/accounts", async (req, res) => {
  const accounts = await db(req).chartOfAccount.findMany({ orderBy: { accountCode: "asc" } })
  res.json({ accounts })
})

m2Router.get("/journals", async (req, res) => {
  const q = z
    .object({ from: dateStr.optional(), to: dateStr.optional(), limit: z.coerce.number().int().min(1).max(500).default(100) })
    .safeParse(req.query)
  if (!q.success) return bad(res, q.error)
  const { from, to, limit } = q.data
  const entries = await db(req).journalEntry.findMany({
    where: {
      transactionDate: { ...(from ? { gte: toDate(from) } : {}), ...(to ? { lte: toDate(to) } : {}) },
    },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { lines: { include: { account: { select: { accountCode: true, accountName: true } } } } },
  })
  res.json({
    journals: entries.map((e) => ({
      id: e.id,
      date: iso(e.transactionDate),
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      description: e.description,
      dataSource: e.dataSource,
      lines: e.lines.map((l) => ({
        accountCode: l.account.accountCode,
        accountName: l.account.accountName,
        debit: n(l.debitAmount),
        credit: n(l.creditAmount),
      })),
    })),
  })
})

m2Router.get("/reports/pnl", async (req, res) => {
  const q = z.object({ from: dateStr, to: dateStr }).safeParse(req.query)
  if (!q.success) return bad(res, q.error)
  res.json(await profitAndLoss(db(req), toDate(q.data.from), toDate(q.data.to)))
})

m2Router.get("/reports/balance-sheet", async (req, res) => {
  const q = z.object({ asOf: dateStr }).safeParse(req.query)
  if (!q.success) return bad(res, q.error)
  res.json(await balanceSheet(db(req), toDate(q.data.asOf)))
})

// ---------------------------------------------------------------- KPIs & social

m2Router.get("/kpis", async (req, res) => {
  const rows = await db(req).financialKpiSnapshot.findMany({ orderBy: { period: "asc" } })
  res.json({
    kpis: rows.map((r) => ({
      period: iso(r.period),
      par30: n(r.par30),
      oss: n(r.oss),
      oer: n(r.oer),
      portfolioYield: n(r.portfolioYield),
      portfolioOutstanding: n(r.portfolioOutstanding),
      avgLoanSize: n(r.avgLoanSize),
      dataSource: r.dataSource,
    })),
  })
})

m2Router.get("/social", async (req, res) => {
  const rows = await db(req).socialPerformanceIndicator.findMany({ orderBy: { period: "asc" } })
  res.json({
    social: rows.map((r) => ({
      period: iso(r.period),
      female: n(r.femaleBorrowerRatio),
      rural: n(r.ruralBorrowerRatio),
      lowIncome: n(r.lowIncomeClientRatio),
      newToBanking: n(r.newToBankingRatio),
      dropout: n(r.dropoutRate),
      poverty: n(r.povertyProxyScore), // share of borrowers below the poverty line
      dataSource: r.dataSource,
    })),
  })
})

// ---------------------------------------------------------------- MDI & alerts
// Convention: HIGHER MDI = MORE mission drift (opposite of the old mock dashboard).

type Trend = { indicator: string; label: string; weight: number; baseline: number; current: number; relativeChange: number; contribution: number }

function scoreView(r: { period: Date; mdiScore: unknown; thresholdState: string; contributingTrends: unknown; dataSource: string }) {
  return {
    period: iso(r.period),
    mdi: n(r.mdiScore),
    state: r.thresholdState,
    contributingTrends: (r.contributingTrends ?? []) as Trend[],
    dataSource: r.dataSource,
  }
}

m2Router.get("/mdi", async (req, res) => {
  const rows = await db(req).missionDriftScore.findMany({ orderBy: { period: "asc" } })
  res.json({ threshold: 20, scores: rows.map(scoreView) })
})

m2Router.get("/mdi/latest", async (req, res) => {
  const rows = await db(req).missionDriftScore.findMany({ orderBy: { period: "desc" }, take: 2 })
  if (rows.length === 0) return res.status(404).json({ error: "No MDI scores yet" })
  const [latest, prev] = rows
  const cur = scoreView(latest!)
  const velocity = prev ? Number(((cur.mdi ?? 0) - (n(prev.mdiScore) ?? 0)).toFixed(3)) : null
  res.json({ ...cur, previousMdi: prev ? n(prev.mdiScore) : null, changeVelocity: velocity, velocityUnit: "points/month" })
})

m2Router.get("/alerts", async (req, res) => {
  const q = z.object({ status: z.enum(["new", "acknowledged", "resolved"]).optional() }).safeParse(req.query)
  if (!q.success) return bad(res, q.error)
  const alerts = await db(req).missionDriftAlert.findMany({
    where: q.data.status ? { status: q.data.status } : {},
    orderBy: { createdAt: "desc" },
    include: { mdiScore: true },
  })
  res.json({
    alerts: alerts.map((a) => ({
      id: a.id,
      status: a.status,
      narrative: a.narrative,
      createdAt: a.createdAt,
      reviewedBy: a.reviewedBy,
      score: scoreView(a.mdiScore), // evidence = linked score's contributingTrends
    })),
  })
})

m2Router.patch("/alerts/:id", async (req, res) => {
  const body = z.object({ status: z.enum(["acknowledged", "resolved"]) }).safeParse(req.body)
  if (!body.success) return bad(res, body.error)
  const id = z.string().uuid().safeParse(req.params.id)
  if (!id.success) return bad(res, id.error)
  const existing = await db(req).missionDriftAlert.findUnique({ where: { id: id.data } })
  if (!existing) return res.status(404).json({ error: "Alert not found" })
  const updated = await db(req).missionDriftAlert.update({
    where: { id: id.data },
    data: { status: body.data.status, reviewedBy: req.user!.userId },
  })
  res.json({ id: updated.id, status: updated.status, reviewedBy: updated.reviewedBy })
})

// ---------------------------------------------------------------- dashboards (page-shaped)

/** Finance dashboard: position summary + MDI snapshot + latest KPIs. */
m2Router.get("/dashboard/finance", async (req, res) => {
  const prisma = db(req)
  const latestKpi = await prisma.financialKpiSnapshot.findFirst({ orderBy: { period: "desc" } })
  const asOf = latestKpi
    ? new Date(Date.UTC(latestKpi.period.getUTCFullYear(), latestKpi.period.getUTCMonth() + 1, 0))
    : new Date()
  const [bs, mdiRows] = await Promise.all([
    balanceSheet(prisma, asOf),
    prisma.missionDriftScore.findMany({ orderBy: { period: "desc" }, take: 1 }),
  ])
  const cash = bs.assets.find((a) => a.code === "1000")?.amount ?? 0
  res.json({
    asOf: bs.asOf,
    summary: { cashPosition: cash, assets: bs.totalAssets, liabilities: bs.totalLiabilities, equity: bs.totalEquity },
    balanced: bs.balanced,
    kpi: latestKpi && {
      period: iso(latestKpi.period),
      par30: n(latestKpi.par30),
      oss: n(latestKpi.oss),
      oer: n(latestKpi.oer),
      portfolioYield: n(latestKpi.portfolioYield),
      portfolioOutstanding: n(latestKpi.portfolioOutstanding),
      dataSource: latestKpi.dataSource,
    },
    mdi: mdiRows[0] ? scoreView(mdiRows[0]) : null,
  })
})

/**
 * Drift dashboard: latest MDI + financial-vs-social movement (last-3-month mean vs first-3-month baseline).
 * Percent changes are relative; `adverse` marks whether the move is bad for the mission.
 */
m2Router.get("/dashboard/drift", async (req, res) => {
  const prisma = db(req)
  const [scores, kpis] = await Promise.all([
    prisma.missionDriftScore.findMany({ orderBy: { period: "asc" } }),
    prisma.financialKpiSnapshot.findMany({ orderBy: { period: "asc" } }),
  ])
  if (scores.length === 0) return res.status(404).json({ error: "No MDI scores yet" })
  const latest = scores[scores.length - 1]!
  const trends = ((latest.contributingTrends ?? []) as Trend[]).slice()
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1)
  const pct = (cur: number, base: number) => (base ? Number((((cur - base) / base) * 100).toFixed(1)) : 0)

  const port = kpis.map((k) => Number(k.portfolioOutstanding ?? 0))
  const par = kpis.map((k) => Number(k.par30 ?? 0))
  const oss = kpis.map((k) => Number(k.oss ?? 0))
  const financial =
    kpis.length >= 6
      ? [
          { label: "Portfolio", change: pct(mean(port.slice(-3)), mean(port.slice(0, 3))), positiveIsGood: true },
          { label: "OSS", change: pct(mean(oss.slice(-3)), mean(oss.slice(0, 3))), positiveIsGood: true },
          { label: "PAR30", change: pct(mean(par.slice(-3)), mean(par.slice(0, 3))), positiveIsGood: false },
        ]
      : []

  res.json({
    period: iso(latest.period),
    mdi: n(latest.mdiScore),
    state: latest.thresholdState,
    threshold: 20,
    dataSource: latest.dataSource,
    financialPerformance: financial,
    socialPerformance: trends.map((t) => ({
      indicator: t.indicator,
      label: t.label,
      change: Number((t.relativeChange * 100).toFixed(1)),
      contribution: t.contribution,
      adverse: t.contribution > 0,
    })),
    history: scores.map((s) => ({ period: iso(s.period), mdi: n(s.mdiScore), state: s.thresholdState })),
  })
})
