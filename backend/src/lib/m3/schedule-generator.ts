/**
 * M3 — Repayment Schedule Generator
 *
 * Generates an amortised repayment schedule for a newly approved loan.
 * Supports two methods:
 *   - flat       : equal total installment (principal + interest spread evenly)
 *   - declining  : declining-balance (interest re-computed on outstanding principal)
 *
 * Returns an array of installment rows ready to bulk-insert into repayment_schedules.
 */

export type InstallmentRow = {
  installmentNo: number
  dueDate: Date
  principalDue: number
  interestDue: number
  amountDue: number
}

export type ScheduleInput = {
  principal: number          // total disbursed amount (LKR)
  annualInterestRate: number // e.g. 0.24 for 24%
  termMonths: number
  firstDueDate: Date         // date of first installment (usually 1 month after disbursement)
  method?: "flat" | "declining"
}

/**
 * Adds exactly one calendar month to a date, snapping to end-of-month when needed.
 */
function addMonth(date: Date, months: number): Date {
  const d = new Date(date)
  const originalDay = date.getDate()
  d.setMonth(d.getMonth() + months)
  // Snap to end of month if original day > new month's last day
  if (d.getDate() !== originalDay) d.setDate(0)
  return d
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function generateSchedule(input: ScheduleInput): InstallmentRow[] {
  const { principal, annualInterestRate, termMonths, firstDueDate, method = "flat" } = input

  if (termMonths <= 0) throw new Error("termMonths must be > 0")
  if (principal <= 0) throw new Error("principal must be > 0")

  const monthlyRate = annualInterestRate / 12
  const rows: InstallmentRow[] = []

  if (method === "flat") {
    // Equal monthly total (EMI) using standard annuity formula
    let emi: number
    if (monthlyRate === 0) {
      emi = round2(principal / termMonths)
    } else {
      emi = round2(
        (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
          (Math.pow(1 + monthlyRate, termMonths) - 1)
      )
    }

    let balance = principal
    for (let i = 1; i <= termMonths; i++) {
      const interestDue = round2(balance * monthlyRate)
      const isLast = i === termMonths
      // On last installment, use exact balance to avoid rounding drift
      const principalDue = isLast ? round2(balance) : round2(emi - interestDue)
      const amountDue = round2(principalDue + interestDue)
      balance = round2(balance - principalDue)

      rows.push({
        installmentNo: i,
        dueDate: addMonth(firstDueDate, i - 1),
        principalDue,
        interestDue,
        amountDue,
      })
    }
  } else {
    // Declining balance: interest computed on outstanding principal each month
    const principalPerMonth = round2(principal / termMonths)
    let balance = principal

    for (let i = 1; i <= termMonths; i++) {
      const interestDue = round2(balance * monthlyRate)
      const isLast = i === termMonths
      const principalDue = isLast ? round2(balance) : principalPerMonth
      const amountDue = round2(principalDue + interestDue)
      balance = round2(balance - principalDue)

      rows.push({
        installmentNo: i,
        dueDate: addMonth(firstDueDate, i - 1),
        principalDue,
        interestDue,
        amountDue,
      })
    }
  }

  return rows
}
