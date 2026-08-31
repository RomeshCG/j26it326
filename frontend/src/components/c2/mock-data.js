export const MISSION_DRIFT = {
  dashboard: {
    mdi: 72,
    status: "Stable",
    statusHint: "Social indicators declining while financial metrics improve",
  },
  detail: {
    currentMdi: 58,
    changeVelocity: -7.4,
    velocityUnit: "points/month",
    status: "Increasing mission drift",
    insight:
      "Financial performance improved by 12% while outreach to the lowest-income segment declined by 9%.",
    historicalTrend: [
      { month: "Jan", value: 88 },
      { month: "Feb", value: 92 },
      { month: "Mar", value: 78 },
      { month: "Apr", value: 66 },
      { month: "May", value: 58 },
    ],
  },
  financialPerformance: [
    { label: "Portfolio", change: 14, direction: "up" },
    { label: "Revenue", change: 11, direction: "up" },
    { label: "ROA", change: 6, direction: "up" },
    { label: "PAR", change: 2, direction: "down", positiveIsGood: true },
  ],
  socialPerformance: [
    { label: "Low-income clients", change: 8, direction: "down" },
    { label: "Rural borrowers", change: 11, direction: "down" },
    { label: "Women borrowers", change: 3, direction: "down" },
    { label: "Outreach", change: 9, direction: "down" },
  ],
}

export const FINANCE_SUMMARY = {
  cashPosition: 48_200_000,
  assets: 520_000_000,
  liabilities: 390_000_000,
  equity: 130_000_000,
}

export const BALANCE_SHEET = {
  asOf: "2026-08-31",
  assets: [
    { label: "Cash and equivalents", amount: 48_200_000 },
    { label: "Loan portfolio (net)", amount: 412_500_000 },
    { label: "Fixed assets", amount: 38_400_000 },
    { label: "Other assets", amount: 20_900_000 },
  ],
  liabilities: [
    { label: "Deposits and borrowings", amount: 298_000_000 },
    { label: "Accrued expenses", amount: 42_600_000 },
    { label: "Other liabilities", amount: 49_400_000 },
  ],
  equity: [
    { label: "Retained earnings", amount: 96_800_000 },
    { label: "Reserves", amount: 33_200_000 },
  ],
}

export const CASH_FLOW_SUMMARY = {
  period: "August 2026",
  operating: 18_400_000,
  investing: -6_200_000,
  financing: -2_100_000,
  netChange: 10_100_000,
  openingCash: 38_100_000,
  closingCash: 48_200_000,
}

export function formatLkrMillions(amount) {
  if (amount >= 1_000_000) {
    return `Rs. ${(amount / 1_000_000).toFixed(1)}M`
  }
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatLkr(amount) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount)
}
