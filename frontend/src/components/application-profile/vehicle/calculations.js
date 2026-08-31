function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sumAssetValues(rows = []) {
  return rows.reduce((total, row) => total + num(row.value), 0)
}

function sumLiabilities(rows = []) {
  return rows.reduce(
    (acc, row) => ({
      outstanding: acc.outstanding + num(row.amountOutstanding),
      monthly: acc.monthly + num(row.monthlyPayment),
    }),
    { outstanding: 0, monthly: 0 }
  )
}

export function computeVehicleSummary(form) {
  const applicantIncome = num(form.income?.netMonthlyIncome)
  const guarantor1Income = num(form.guarantor1?.netMonthlyIncome)
  const guarantor2Income = num(form.guarantor2?.netMonthlyIncome)
  const expectedVehicleIncome = num(form.vehicle?.expectedIncome)
  const liabilities = sumLiabilities(form.liabilities)
  const totalAssets =
    sumAssetValues(form.movableAssets) + sumAssetValues(form.immovableAssets)
  const totalSupportIncome =
    applicantIncome + guarantor1Income + guarantor2Income + expectedVehicleIncome
  const surplus = totalSupportIncome - liabilities.monthly
  const dscr =
    liabilities.monthly > 0 ? totalSupportIncome / liabilities.monthly : null

  return {
    applicantIncome,
    guarantor1Income,
    guarantor2Income,
    expectedVehicleIncome,
    totalSupportIncome,
    totalAssets,
    totalLiabilitiesOutstanding: liabilities.outstanding,
    totalMonthlyLiabilities: liabilities.monthly,
    surplus,
    dscr,
  }
}

export function computeVehicleRiskScore(form, summary) {
  let score = 70
  const amount = num(form.financeAmount || form.cashPrice)

  if (amount > 800000) score -= 10
  if (amount < 200000) score += 4
  if (summary.surplus < 0) score -= 14
  if (summary.surplus > 15000) score += 6
  if (summary.dscr != null && summary.dscr < 1) score -= 12
  if (summary.dscr != null && summary.dscr >= 1.5) score += 5
  if (form.vehicle?.condition === "unregistered") score -= 6
  if (!form.guarantor1?.name?.trim()) score -= 8

  return Math.max(18, Math.min(96, score))
}
