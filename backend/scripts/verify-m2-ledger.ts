/**
 * Verifies the M2 ledger rules without a database.
 * Run: npx tsx scripts/verify-m2-ledger.ts
 */
import assert from "node:assert/strict"
import { Prisma } from "../node_modules/.prisma/tenant-client/index.js"
import {
  ACCOUNTS,
  LedgerError,
  assertBalanced,
  disbursementLines,
  expenseLines,
  provisionLines,
  repaymentLines,
} from "../src/lib/m2/ledger.js"

const sum = (lines: ReturnType<typeof disbursementLines>, side: "debit" | "credit") =>
  lines.reduce((s, l) => s.plus(new Prisma.Decimal(l[side] ?? 0)), new Prisma.Decimal(0))

// 1. Every posting rule balances (several amounts, including awkward decimals)
for (const amt of ["100000", "0.01", "12345.67", "315268702.55"]) {
  for (const lines of [
    disbursementLines(amt),
    repaymentLines(amt),
    repaymentLines(amt, "0.10"),
    repaymentLines("0.1", "0.2"),
    expenseLines(ACCOUNTS.SALARY_EXPENSE.code, amt),
    expenseLines(ACCOUNTS.OPERATING_EXPENSE.code, amt),
    expenseLines(ACCOUNTS.INTEREST_EXPENSE.code, amt),
    provisionLines(amt),
  ]) {
    assert.ok(sum(lines, "debit").equals(sum(lines, "credit")))
    assertBalanced(lines)
  }
}

// 2. Decimal safety: 0.1 + 0.2 must equal 0.3 exactly (fails with JS floats)
assertBalanced([
  { accountCode: ACCOUNTS.CASH.code, debit: "0.3" },
  { accountCode: ACCOUNTS.LOAN_PORTFOLIO.code, credit: "0.1" },
  { accountCode: ACCOUNTS.INTEREST_INCOME.code, credit: "0.2" },
])

// 3. Unbalanced entries are refused
assert.throws(
  () =>
    assertBalanced([
      { accountCode: ACCOUNTS.CASH.code, debit: "100.00" },
      { accountCode: ACCOUNTS.LOAN_PORTFOLIO.code, credit: "99.99" },
    ]),
  LedgerError
)

// 4. Other invalid entries are refused
assert.throws(() => assertBalanced([{ accountCode: ACCOUNTS.CASH.code, debit: "5" }]), LedgerError) // 1 line
assert.throws(
  () => assertBalanced([{ accountCode: "1000", debit: "-5" }, { accountCode: "1100", credit: "-5" }]),
  LedgerError
) // negative
assert.throws(
  () => assertBalanced([{ accountCode: "1000", debit: "5", credit: "5" }, { accountCode: "1100", debit: "1" }]),
  LedgerError
) // both sides on one line
assert.throws(
  () => assertBalanced([{ accountCode: "1000", debit: "1.005" }, { accountCode: "1100", credit: "1.005" }]),
  LedgerError
) // > 2 dp
assert.throws(() => assertBalanced([{ accountCode: "1000" }, { accountCode: "1100" }]), LedgerError) // zero

console.log("verify-m2-ledger: all posting rules balance; unbalanced/invalid entries are refused")
