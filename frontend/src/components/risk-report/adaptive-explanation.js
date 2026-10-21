import { STATUS_META, TRUST_PROFILE } from "@/components/trust-profile/mock-data"

import {
  getExplanationStyle,
  getTrustStatusFromStyle,
} from "./officer-profile-style"

export function getOfficerTrustSnapshot(styleId) {
  const status = getTrustStatusFromStyle(styleId)
  const statusMeta = STATUS_META[status]
  const profile = TRUST_PROFILE

  return {
    historicalDecisions: profile.historicalDecisions ?? profile.totalDecisions,
    aiFollowRate: profile.aiFollowRate ?? 100 - profile.underRelianceRate,
    status,
    statusLabel: statusMeta.label,
    statusClassName: statusMeta.className,
    overRelianceRate: profile.overRelianceRate,
    explanationStyle: getExplanationStyle(styleId),
  }
}

export function getAdaptiveExplanation(report, trust) {
  const defaultRisk = report.defaultProbability

  if (trust.status === "OVER-RELIANT") {
    return {
      mode: "caution",
      headline: "Review required",
      lead: `The assessment predicts a **${defaultRisk}% chance of becoming seriously overdue**.`,
      emphasis: "Do not rely solely on this prediction.",
      uncertainty:
        "The model scores loan terms, branch and product only. It has not seen this borrower's income, debts or expenses.",
      verifyItems: [
        "Recent income activity",
        "Existing debt obligations",
        "Household expenses",
      ],
      tone: "uncertainty",
    }
  }

  if (trust.status === "UNDER-RELIANT") {
    return {
      mode: "evidence",
      headline: "Assessment guidance",
      lead: `The assessment predicts a **${defaultRisk}% chance of becoming seriously overdue**.`,
      emphasis:
        "The model's evidence is the factor list below, learned from 7,245 partner loans under grouped cross-validation (AUC 0.81).",
      uncertainty: null,
      verifyItems: [],
      tone: "confidence",
    }
  }

  return {
    mode: "standard",
    headline: "Assessment summary",
    lead: `The assessment predicts a **${defaultRisk}% chance of becoming seriously overdue** (**${report.classification.toLowerCase()}** band).`,
    emphasis: report.narrative,
    uncertainty: null,
    verifyItems: [],
    tone: "balanced",
  }
}
