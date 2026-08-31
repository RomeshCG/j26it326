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
    explanation:
      "When income volatility and existing debt are both high, their combined contribution to predicted risk is greater than their individual effects.",
  },
  "0-1": {
    label: "COMPOUNDING",
    tone: "negative",
    explanation:
      "Low savings combined with unstable income amplifies repayment uncertainty beyond what either factor suggests alone.",
  },
  "0-2": {
    label: "COMPENSATORY",
    tone: "positive",
    explanation:
      "Strong group behaviour partially buffers the risk introduced by income volatility.",
  },
  "1-2": {
    label: "COMPENSATORY",
    tone: "positive",
    explanation:
      "Consistent savings and strong group guarantees reinforce each other, reducing overall default likelihood.",
  },
  "1-3": {
    label: "COMPENSATORY",
    tone: "positive",
    explanation:
      "Healthy savings offset existing debt obligations, lowering the combined stress on cash flow.",
  },
  "2-3": {
    label: "COMPENSATORY",
    tone: "positive",
    explanation:
      "Group strength mitigates the risk associated with existing debt through social collateral and peer monitoring.",
  },
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
