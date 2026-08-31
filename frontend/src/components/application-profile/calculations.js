function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sumRows(rows) {
  return rows.reduce((total, row) => total + num(row.amount), 0)
}

export function computeFinancialSummary(form) {
  const income = form.income ?? {}
  const totalNetIncome =
    num(income.netSalary) + num(income.otherIncome) - num(income.livingExpenses)
  const totalDebtService =
    num(income.existingRentals) +
    num(income.otherDebtService) +
    num(income.proposedCommitment)
  const surplus = totalNetIncome - totalDebtService

  const earnTotal = sumRows(form.incomeRows ?? [])
  const expenseTotal = sumRows(form.expenseRows ?? [])
  const loanExpenseTotal = sumRows(form.loanExpenseRows ?? [])
  const dscr =
    totalDebtService > 0
      ? totalNetIncome / totalDebtService
      : totalNetIncome > 0
        ? null
        : 0

  return {
    totalNetIncome,
    totalDebtService,
    surplus,
    earnTotal,
    expenseTotal,
    loanExpenseTotal,
    dscr,
  }
}

export function computeMockRiskScore(form, summary) {
  let score = 72
  const amount = num(form.loanAmount || form.facilityAmount)

  if (amount > 150000) score -= 8
  if (amount < 50000) score += 4
  if (summary.surplus < 0) score -= 15
  if (summary.surplus > 10000) score += 6
  if (summary.dscr != null && summary.dscr < 1) score -= 12
  if (summary.dscr != null && summary.dscr >= 1.5) score += 5
  if ((form.existingLoans ?? []).some((row) => num(row.arrears) > 0)) score -= 10

  return Math.max(18, Math.min(96, score))
}

export function scoreToBand(score) {
  if (score >= 75) return "LOW"
  if (score >= 55) return "MEDIUM"
  return "HIGH"
}
