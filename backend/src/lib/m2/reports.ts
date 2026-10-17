/**
 * M2 reports computed from journal lines (single source of truth for finance numbers).
 * Amounts are returned as JS numbers (LKR, 2 dp) for JSON; all arithmetic is done in Prisma.Decimal.
 */
import { Prisma } from "../../../node_modules/.prisma/tenant-client/index.js"
import type { PrismaClient as TenantClient } from "../../../node_modules/.prisma/tenant-client/index.js"
import { ACCOUNTS } from "./ledger.js"

type Dec = Prisma.Decimal
const ZERO = () => new Prisma.Decimal(0)

export interface Totals {
  debit: Dec
  credit: Dec
}

/** Debit/credit totals per account code for entries with transactionDate in [from, to] (either bound optional). */
export async function accountTotals(
  prisma: TenantClient,
  range: { from?: Date; to?: Date }
): Promise<Map<string, Totals>> {
  const dateFilter: Prisma.DateTimeFilter = {}
  if (range.from) dateFilter.gte = range.from
  if (range.to) dateFilter.lte = range.to

  const [sums, accounts] = await Promise.all([
    prisma.journalEntryLine.groupBy({
      by: ["accountId"],
      where: Object.keys(dateFilter).length ? { journalEntry: { transactionDate: dateFilter } } : {},
      _sum: { debitAmount: true, creditAmount: true },
    }),
    prisma.chartOfAccount.findMany({ select: { id: true, accountCode: true } }),
  ])
  const codeById = new Map(accounts.map((a) => [a.id, a.accountCode]))
  const out = new Map<string, Totals>()
  for (const s of sums) {
    const code = codeById.get(s.accountId)
    if (!code) continue
    out.set(code, { debit: s._sum.debitAmount ?? ZERO(), credit: s._sum.creditAmount ?? ZERO() })
  }
  return out
}

const debitBal = (m: Map<string, Totals>, code: string): Dec => {
  const t = m.get(code)
  return t ? t.debit.minus(t.credit) : ZERO()
}
const creditBal = (m: Map<string, Totals>, code: string): Dec => debitBal(m, code).neg()
const num = (d: Dec): number => Number(d.toFixed(2))

export interface ProfitAndLoss {
  from: string
  to: string
  income: { code: string; name: string; amount: number }[]
  expenses: { code: string; name: string; amount: number }[]
  totalIncome: number
  totalExpenses: number
  operatingExpenses: number
  netIncome: number
}

export async function profitAndLoss(prisma: TenantClient, from: Date, to: Date): Promise<ProfitAndLoss> {
  const t = await accountTotals(prisma, { from, to })
  const income = [ACCOUNTS.INTEREST_INCOME].map((a) => ({ code: a.code, name: a.name, amount: creditBal(t, a.code) }))
  const expenses = [
    ACCOUNTS.SALARY_EXPENSE,
    ACCOUNTS.OPERATING_EXPENSE,
    ACCOUNTS.INTEREST_EXPENSE,
    ACCOUNTS.PROVISION_EXPENSE,
  ].map((a) => ({ code: a.code, name: a.name, amount: debitBal(t, a.code) }))
  const totalIncome = income.reduce((s, r) => s.plus(r.amount), ZERO())
  const totalExpenses = expenses.reduce((s, r) => s.plus(r.amount), ZERO())
  const opex = debitBal(t, ACCOUNTS.SALARY_EXPENSE.code).plus(debitBal(t, ACCOUNTS.OPERATING_EXPENSE.code))
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    income: income.map((r) => ({ ...r, amount: num(r.amount) })),
    expenses: expenses.map((r) => ({ ...r, amount: num(r.amount) })),
    totalIncome: num(totalIncome),
    totalExpenses: num(totalExpenses),
    operatingExpenses: num(opex),
    netIncome: num(totalIncome.minus(totalExpenses)),
  }
}

export interface BalanceSheet {
  asOf: string
  assets: { code: string; name: string; amount: number }[]
  liabilities: { code: string; name: string; amount: number }[]
  equity: { code: string; name: string; amount: number }[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  balanced: boolean
}

export async function balanceSheet(prisma: TenantClient, asOf: Date): Promise<BalanceSheet> {
  const t = await accountTotals(prisma, { to: asOf })
  const assets = [ACCOUNTS.CASH, ACCOUNTS.LOAN_PORTFOLIO, ACCOUNTS.LOAN_LOSS_ALLOWANCE].map((a) => ({
    code: a.code,
    name: a.name,
    amount: debitBal(t, a.code), // allowance has a credit balance -> negative
  }))
  const liabilities = [ACCOUNTS.BORROWINGS].map((a) => ({ code: a.code, name: a.name, amount: creditBal(t, a.code) }))
  const income = creditBal(t, ACCOUNTS.INTEREST_INCOME.code)
  const expenses = [
    ACCOUNTS.SALARY_EXPENSE,
    ACCOUNTS.OPERATING_EXPENSE,
    ACCOUNTS.INTEREST_EXPENSE,
    ACCOUNTS.PROVISION_EXPENSE,
  ].reduce((s, a) => s.plus(debitBal(t, a.code)), ZERO())
  const equity = [
    { code: ACCOUNTS.EQUITY.code, name: ACCOUNTS.EQUITY.name, amount: creditBal(t, ACCOUNTS.EQUITY.code) },
    { code: "RE", name: "Retained earnings (cumulative result)", amount: income.minus(expenses) },
  ]
  const sum = (rows: { amount: Dec }[]) => rows.reduce((s, r) => s.plus(r.amount), ZERO())
  const ta = sum(assets)
  const tl = sum(liabilities)
  const te = sum(equity)
  return {
    asOf: asOf.toISOString().slice(0, 10),
    assets: assets.map((r) => ({ ...r, amount: num(r.amount) })),
    liabilities: liabilities.map((r) => ({ ...r, amount: num(r.amount) })),
    equity: equity.map((r) => ({ ...r, amount: num(r.amount) })),
    totalAssets: num(ta),
    totalLiabilities: num(tl),
    totalEquity: num(te),
    balanced: ta.equals(tl.plus(te)),
  }
}

export interface PeriodKpis {
  portfolioOutstanding: number
  oss: number | null
  oer: number | null // annualised operating expense / average portfolio
  portfolioYield: number | null // annualised interest income / average portfolio
  netIncome: number
}

/** KPIs for one calendar month, computed from journal lines. */
export async function monthlyJournalKpis(prisma: TenantClient, monthStart: Date, monthEnd: Date): Promise<PeriodKpis> {
  const dayBefore = new Date(monthStart.getTime() - 24 * 3600 * 1000)
  const [open, close, pl] = await Promise.all([
    accountTotals(prisma, { to: dayBefore }),
    accountTotals(prisma, { to: monthEnd }),
    profitAndLoss(prisma, monthStart, monthEnd),
  ])
  const pOpen = debitBal(open, ACCOUNTS.LOAN_PORTFOLIO.code)
  const pClose = debitBal(close, ACCOUNTS.LOAN_PORTFOLIO.code)
  const avg = pOpen.plus(pClose).div(2)
  const months = new Prisma.Decimal(12)
  const interest = new Prisma.Decimal(pl.income[0]?.amount ?? 0)
  return {
    portfolioOutstanding: num(pClose),
    oss: pl.totalExpenses > 0 ? Number((pl.totalIncome / pl.totalExpenses).toFixed(4)) : null,
    oer: avg.gt(0) ? Number(new Prisma.Decimal(pl.operatingExpenses).times(months).div(avg).toFixed(4)) : null,
    portfolioYield: avg.gt(0) ? Number(interest.times(months).div(avg).toFixed(4)) : null,
    netIncome: pl.netIncome,
  }
}
