export const MATRIX_FEATURES = [
  "Income Volatility",
  "Savings",
  "Group Strength",
  "Existing Debt",
]

/** Symmetric interaction values (upper triangle). Key: "i-j" with i < j */
export const INTERACTION_MATRIX = {
  "0-1": 0.08,
  "0-2": -0.03,
  "0-3": 0.21,
  "1-2": -0.14,
  "1-3": -0.05,
  "2-3": -0.09,
}

export const INTERACTION_DETAILS = {
  "0-3": {
    label: "COMPOUNDING",
    tone: "negative",
    breakdown: { factorA: 8, factorB: 7, combined: 21 },
    explanation:
      "The applicant's irregular household income increases repayment uncertainty. Combined with existing debt obligations, the available repayment buffer becomes significantly smaller.",
  },
  "0-1": {
    label: "COMPOUNDING",
    tone: "negative",
    breakdown: { factorA: 4, factorB: 3, combined: 8 },
    explanation:
      "Unstable income alongside limited savings leaves little room to absorb missed payments. Together they create more repayment pressure than either factor alone.",
  },
  "0-2": {
    label: "COMPENSATORY",
    tone: "positive",
    breakdown: { factorA: 5, factorB: -4, combined: -3 },
    explanation:
      "Strong group behaviour partially offsets the uncertainty introduced by irregular income, keeping overall risk contained.",
  },
  "1-2": {
    label: "COMPENSATORY",
    tone: "positive",
    breakdown: { factorA: -6, factorB: -5, combined: -14 },
    explanation:
      "Consistent savings and strong group guarantees reinforce each other, reducing the likelihood of missed repayments.",
  },
  "1-3": {
    label: "COMPENSATORY",
    tone: "positive",
    breakdown: { factorA: -4, factorB: 6, combined: -5 },
    explanation:
      "Healthy savings help absorb existing debt obligations, leaving a more manageable monthly repayment buffer.",
  },
  "2-3": {
    label: "COMPENSATORY",
    tone: "positive",
    breakdown: { factorA: -5, factorB: 5, combined: -9 },
    explanation:
      "Group strength mitigates the risk associated with existing debt through social collateral and peer monitoring.",
  },
}

export function getInteractionDetail(key) {
  const [row, col] = key.split("-").map(Number)
  const detail = INTERACTION_DETAILS[key] ?? INTERACTION_DETAILS[DEFAULT_SELECTED_INTERACTION]
  return {
    key,
    row,
    col,
    factorA: MATRIX_FEATURES[row],
    factorB: MATRIX_FEATURES[col],
    strength: getMatrixValue(row, col),
    ...detail,
  }
}

export const DEFAULT_SELECTED_INTERACTION = "0-3"

export const RISK_REPORT = {
  applicant: {
    name: "Kumari Fernando",
    nic: "895612347V",
    date: "2026-08-23",
  },
  loanAmount: 150000,
  officerName: "Nimali Jayasuriya",
  riskScore: 69,
  defaultProbability: 31,
  classification: "MEDIUM",
  confidence: 78,
  keyFactors: [
    { label: "Strong repayment history", tone: "positive" },
    { label: "Strong group performance", tone: "positive" },
    { label: "Income volatility", tone: "caution" },
    { label: "Existing debt", tone: "caution" },
  ],
  narrativeStyle: "uncertainty",
  narrative:
    "This application sits in a moderate-risk band. The model is moderately confident, but several signals pull in opposite directions. Group guarantee strength and a stable repayment history reduce concern, while income volatility and existing debt compound each other. Treat the MEDIUM classification as a prompt for closer review rather than a clear approve-or-reject signal.",
  shapContributors: [
    { feature: "Previous repayment", direction: "down", impact: 4, level: "High" },
    { feature: "Strong group behaviour", direction: "down", impact: 2, level: "Medium" },
    { feature: "Savings consistency", direction: "down", impact: 1, level: "Low" },
    { feature: "Income volatility", direction: "up", impact: 2, level: "Medium" },
    { feature: "Existing debt", direction: "up", impact: 2, level: "Medium" },
    { feature: "Dependents", direction: "up", impact: 1, level: "Low" },
  ],
  /** @deprecated Used by A/B experiment panel */
  shapFactors: [
    { feature: "Loan-to-income ratio", value: 0.28 },
    { feature: "Group guarantee strength", value: -0.22 },
    { feature: "Savings behaviour", value: 0.16 },
    { feature: "Repayment history", value: -0.14 },
    { feature: "Business seasonality", value: 0.11 },
  ],
  /** @deprecated Used by A/B experiment panel */
  interactions: [
    {
      id: "compensatory",
      pair: "Group Guarantee + Loan Amount",
      label: "COMPENSATORY",
      text: "Strong group support partially offsets high loan-to-income risk",
    },
    {
      id: "compounding",
      pair: "Income Volatility + Existing Debt",
      label: "COMPOUNDING",
      text: "When income volatility and existing debt are both high, their combined contribution to predicted risk is greater than their individual effects.",
    },
    {
      id: "independent",
      pair: "Field Officer Rating + Repayment History",
      label: "INDEPENDENT",
      text: "These factors contribute separately with no interaction effect",
    },
  ],
}

export const NARRATIVE_STYLES = {
  uncertainty: {
    label: "Uncertainty-emphasising",
    className:
      "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  confidence: {
    label: "Confidence-reinforcing",
    className:
      "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  balanced: {
    label: "Balanced",
    className:
      "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
}

export function classificationMeta(classification) {
  if (classification === "LOW") {
    return {
      label: "Low risk",
      shortLabel: "LOW",
      className:
        "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      gaugeColor: "#10b981",
      dotClass: "bg-emerald-500",
    }
  }
  if (classification === "HIGH") {
    return {
      label: "High risk",
      shortLabel: "HIGH",
      className:
        "border-transparent bg-destructive/15 text-destructive",
      gaugeColor: "#ef4444",
      dotClass: "bg-destructive",
    }
  }
  return {
    label: "Medium risk",
    shortLabel: "MEDIUM",
    className:
      "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
    gaugeColor: "#f59e0b",
    dotClass: "bg-amber-500",
  }
}

export function scoreToClassification(score) {
  if (score >= 75) return "LOW"
  if (score >= 55) return "MEDIUM"
  return "HIGH"
}

export function scoreToDefaultProbability(score) {
  return Math.max(5, Math.min(95, Math.round(100 - score)))
}

export function buildRiskReport(state = {}) {
  const riskScore = state.riskScore ?? RISK_REPORT.riskScore
  const classification = scoreToClassification(riskScore)

  return {
    ...RISK_REPORT,
    applicant: state.applicant ?? RISK_REPORT.applicant,
    loanAmount: state.loanAmount ?? RISK_REPORT.loanAmount,
    product: state.product ?? null,
    riskScore,
    defaultProbability: scoreToDefaultProbability(riskScore),
    classification,
    applicationId: state.applicationId ?? null,
  }
}

export function buildRiskReportFromApplication(application, options = {}) {
  const form = application?.form ?? {}

  return buildRiskReport({
    applicationId: application?.id ?? null,
    riskScore: application?.riskScore,
    applicant: {
      name: form.fullName || "Unnamed applicant",
      nic: form.nic || form.businessRegNo || "—",
      date: form.applicationDate || new Date().toISOString().slice(0, 10),
    },
    loanAmount: form.loanAmount || form.financeAmount,
    product: options.product ?? null,
  })
}

export function getAiRecommendation(report, trustStatus = "OVER-RELIANT") {
  const classMeta = classificationMeta(report.classification)
  let recommendation = "REVIEW"

  if (report.classification === "LOW") {
    recommendation = "APPROVE"
  } else if (report.classification === "HIGH") {
    recommendation = "REJECT"
  } else if (trustStatus === "OVER-RELIANT") {
    recommendation = "REVIEW REQUIRED"
  }

  return {
    risk: report.defaultProbability,
    riskLevel: classMeta.shortLabel,
    recommendation,
    confidence: report.confidence ?? 78,
    keyFactors: report.keyFactors ?? RISK_REPORT.keyFactors,
  }
}

export function getMatrixValue(i, j) {
  if (i === j) return null
  const key = i < j ? `${i}-${j}` : `${j}-${i}`
  return INTERACTION_MATRIX[key] ?? 0
}

export function getInteractionKey(i, j) {
  if (i === j) return null
  return i < j ? `${i}-${j}` : `${j}-${i}`
}

export function formatLkr(amount) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)
}
