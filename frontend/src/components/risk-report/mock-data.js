export const RISK_REPORT = {
  applicant: {
    name: "Kumari Fernando",
    nic: "895612347V",
    date: "2026-08-23",
  },
  officerName: "Nimali Jayasuriya",
  riskScore: 62,
  defaultProbability: 18.4,
  classification: "MEDIUM",
  narrativeStyle: "uncertainty",
  narrative:
    "This application sits in a moderate-risk band. The model is moderately confident, but several signals pull in opposite directions. Group guarantee strength and a stable field-officer rating reduce concern, while a relatively high loan-to-income ratio and irregular savings behaviour raise it. Treat the MEDIUM classification as a prompt for closer review rather than a clear approve-or-reject signal — especially given the seasonal income pattern linked to the borrower's business type.",
  shapFactors: [
    { feature: "Loan-to-income ratio", value: 0.28 },
    { feature: "Group guarantee strength", value: -0.22 },
    { feature: "Savings behaviour", value: 0.16 },
    { feature: "Repayment history", value: -0.14 },
    { feature: "Business seasonality", value: 0.11 },
  ],
  interactions: [
    {
      id: "compensatory",
      pair: "Group Guarantee + Loan Amount",
      label: "COMPENSATORY",
      text: "Strong group support partially offsets high loan-to-income risk",
    },
    {
      id: "compounding",
      pair: "Savings Behaviour + Business Type",
      label: "COMPOUNDING",
      text: "Irregular savings combined with seasonal business increases risk",
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
      label: "LOW",
      className:
        "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      gaugeColor: "#10b981",
    }
  }
  if (classification === "HIGH") {
    return {
      label: "HIGH",
      className:
        "border-transparent bg-destructive/15 text-destructive",
      gaugeColor: "#ef4444",
    }
  }
  return {
    label: "MEDIUM",
    className:
      "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
    gaugeColor: "#f59e0b",
  }
}

export function scoreToClassification(score) {
  if (score < 40) return "LOW"
  if (score < 70) return "MEDIUM"
  return "HIGH"
}
