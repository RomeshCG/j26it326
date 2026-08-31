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
      lead: `The assessment predicts **${defaultRisk}% default risk**.`,
      emphasis: "Do not rely solely on this prediction.",
      uncertainty: "Income data is based on self-reported household cash flow.",
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
      lead: `The assessment predicts **${defaultRisk}% default risk**.`,
      emphasis:
        "The model's strongest evidence is previous repayment behaviour and group performance.",
      uncertainty: null,
      verifyItems: [],
      tone: "confidence",
    }
  }

  return {
    mode: "standard",
    headline: "Assessment summary",
    lead: `The assessment predicts **${defaultRisk}% default risk** with a **${report.classification.toLowerCase()}** classification.`,
    emphasis: report.narrative,
    uncertainty: null,
    verifyItems: [],
    tone: "balanced",
  }
}
