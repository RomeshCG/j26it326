/**
 * M2 ledger: chart of accounts, balanced posting, and posting rules.
 *
 * One posting function (`postJournalEntry`) is used by everything (seed script, M3 events, future payroll).
 * It REFUSES any entry where total debits != total credits. All money uses Prisma.Decimal (never JS floats).
 */
import { Prisma } from "../../../node_modules/.prisma/tenant-client/index.js"
import type { PrismaClient as TenantClient } from "../../../node_modules/.prisma/tenant-client/index.js"

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense"

export const ACCOUNTS = {
  CASH: { code: "1000", name: "Cash and bank", type: "asset" },
  LOAN_PORTFOLIO: { code: "1100", name: "Loan portfolio", type: "asset" },
  LOAN_LOSS_ALLOWANCE: { code: "1190", name: "Loan-loss allowance", type: "asset" }, // contra-asset (credit balance)
  BORROWINGS: { code: "2000", name: "Borrowings", type: "liability" },
  EQUITY: { code: "3000", name: "Equity", type: "equity" },
  INTEREST_INCOME: { code: "4000", name: "Interest income", type: "income" },
  SALARY_EXPENSE: { code: "5000", name: "Salary expense", type: "expense" },
  OPERATING_EXPENSE: { code: "5100", name: "Operating expense", type: "expense" },
  INTEREST_EXPENSE: { code: "5200", name: "Interest expense (funding cost)", type: "expense" },
  PROVISION_EXPENSE: { code: "5300", name: "Provision expense", type: "expense" },
} as const satisfies Record<string, { code: string; name: string; type: AccountType }>

export type AccountCode = (typeof ACCOUNTS)[keyof typeof ACCOUNTS]["code"]

export type DataSource = "app" | "synthetic" | "par" | "par+synthetic"

export interface LineInput {
  accountCode: string
  debit?: Prisma.Decimal.Value
  credit?: Prisma.Decimal.Value
}

export interface PostEntryInput {
  transactionDate: Date
  referenceType: string
  /** M3 disbursementId / collectionId (uuid). Used for idempotency together with referenceType. */
  referenceId?: string | null
  description?: string
  createdBy?: string | null
  dataSource?: DataSource
  lines: LineInput[]
}

export class LedgerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LedgerError"
  }
}

const D = (v: Prisma.Decimal.Value | undefined) => new Prisma.Decimal(v ?? 0)

/** Pure validation: throws LedgerError unless the lines are a valid, balanced entry. */
export function assertBalanced(lines: LineInput[]): { debit: Prisma.Decimal; credit: Prisma.Decimal } {
  if (lines.length < 2) throw new LedgerError("A journal entry needs at least 2 lines")
  let debit = new Prisma.Decimal(0)
  let credit = new Prisma.Decimal(0)
  for (const l of lines) {
    const dr = D(l.debit)
    const cr = D(l.credit)
    if (dr.isNegative() || cr.isNegative()) throw new LedgerError("Debit and credit must not be negative")
    if (dr.gt(0) && cr.gt(0)) throw new LedgerError(`Line ${l.accountCode} has both debit and credit`)
    if (dr.isZero() && cr.isZero()) throw new LedgerError(`Line ${l.accountCode} has no amount`)
    if (dr.decimalPlaces() > 2 || cr.decimalPlaces() > 2) throw new LedgerError("Amounts are limited to 2 decimal places")
    debit = debit.plus(dr)
    credit = credit.plus(cr)
  }
  if (!debit.equals(credit)) {
    throw new LedgerError(`Unbalanced entry: debits ${debit.toFixed(2)} != credits ${credit.toFixed(2)}`)
  }
  return { debit, credit }
}

/** Posting rule: loan disbursed. Dr Loan portfolio / Cr Cash. */
export function disbursementLines(amount: Prisma.Decimal.Value): LineInput[] {
  const a = D(amount)
  return [
    { accountCode: ACCOUNTS.LOAN_PORTFOLIO.code, debit: a },
    { accountCode: ACCOUNTS.CASH.code, credit: a },
  ]
}

/**
 * Posting rule: repayment. Dr Cash / Cr Loan portfolio (principal) / Cr Interest income.
 * If the interest split is unknown (M3 sends only a total), pass principal = total and interest = 0.
 */
export function repaymentLines(principal: Prisma.Decimal.Value, interest: Prisma.Decimal.Value = 0): LineInput[] {
  const p = D(principal)
  const i = D(interest)
  const lines: LineInput[] = [
    { accountCode: ACCOUNTS.CASH.code, debit: p.plus(i) },
    { accountCode: ACCOUNTS.LOAN_PORTFOLIO.code, credit: p },
  ]
  if (i.gt(0)) lines.push({ accountCode: ACCOUNTS.INTEREST_INCOME.code, credit: i })
  return lines
}

/** Posting rule: expense paid in cash (salary, opex, funding cost). */
export function expenseLines(expenseCode: string, amount: Prisma.Decimal.Value): LineInput[] {
  const a = D(amount)
  return [
    { accountCode: expenseCode, debit: a },
    { accountCode: ACCOUNTS.CASH.code, credit: a },
  ]
}

/** Posting rule: loan-loss provision. Dr Provision expense / Cr Loan-loss allowance. */
export function provisionLines(amount: Prisma.Decimal.Value): LineInput[] {
  const a = D(amount)
  return [
    { accountCode: ACCOUNTS.PROVISION_EXPENSE.code, debit: a },
    { accountCode: ACCOUNTS.LOAN_LOSS_ALLOWANCE.code, credit: a },
  ]
}

export async function seedChartOfAccounts(prisma: TenantClient): Promise<number> {
  for (const a of Object.values(ACCOUNTS)) {
    await prisma.chartOfAccount.upsert({
      where: { accountCode: a.code },
      update: { accountName: a.name, accountType: a.type },
      create: { accountCode: a.code, accountName: a.name, accountType: a.type },
    })
  }
  return Object.keys(ACCOUNTS).length
}

/**
 * Post a balanced journal entry atomically.
 * Idempotent when referenceId is given: the same (referenceType, referenceId) returns the existing entry.
 */
export async function postJournalEntry(
  prisma: TenantClient,
  input: PostEntryInput
): Promise<{ id: string; duplicate: boolean }> {
  assertBalanced(input.lines)

  if (input.referenceId) {
    const existing = await prisma.journalEntry.findFirst({
      where: { referenceType: input.referenceType, referenceId: input.referenceId },
      select: { id: true },
    })
    if (existing) return { id: existing.id, duplicate: true }
  }

  const codes = [...new Set(input.lines.map((l) => l.accountCode))]
  const accounts = await prisma.chartOfAccount.findMany({ where: { accountCode: { in: codes } } })
  const idByCode = new Map(accounts.map((a) => [a.accountCode, a.id]))
  for (const c of codes) {
    if (!idByCode.has(c)) throw new LedgerError(`Unknown account code ${c} (seed the chart of accounts first)`)
  }

  const entry = await prisma.journalEntry.create({
    data: {
      transactionDate: input.transactionDate,
      referenceType: input.referenceType,
      referenceId: input.referenceId ?? null,
      description: input.description,
      createdBy: input.createdBy ?? null,
      dataSource: input.dataSource ?? "app",
      lines: {
        create: input.lines.map((l) => ({
          accountId: idByCode.get(l.accountCode)!,
          debitAmount: D(l.debit),
          creditAmount: D(l.credit),
        })),
      },
    },
    select: { id: true },
  })
  return { id: entry.id, duplicate: false }
}
