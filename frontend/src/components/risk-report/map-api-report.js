/**
 * Map M1 POST /api/risk/assess → Risk Report UI shape.
 * UI riskScore is creditworthiness (higher = safer). API risk_pct is default risk.
 */

import { RISK_REPORT, buildRiskReport } from "./mock-data"

const FEATURE_LABELS = {
  arrears_ratio: "Arrears ratio",
  paid_pct: "Paid %",
  bal_penalty: "Balance penalty",
  bal_charges: "Balance charges",
  arr_cap: "Arrears capital",
  arr_int: "Arrears interest",
}

function humanize(feature) {
  return FEATURE_LABELS[feature] || feature.replace(/_/g, " ")
}

function impactLevel(contribution) {
  const abs = Math.abs(contribution)
  if (abs >= 15) return { impact: 4, level: "High" }
  if (abs >= 8) return { impact: 3, level: "High" }
  if (abs >= 3) return { impact: 2, level: "Medium" }
  return { impact: 1, level: "Low" }
}

/** Build assess features from application / navigation state. */
export function buildAssessFeatures(state = {}) {
  const amount = Number(state.loanAmount) || Number(state.features?.contract_amount) || 100000
  const paidPct = Number(state.features?.paid_pct ?? 60)
  const balanceTotal = Number(state.features?.balance_total ?? amount * 0.45)
  const arrCap = Number(state.features?.arr_cap ?? amount * 0.03)
  const arrInt = Number(state.features?.arr_int ?? amount * 0.004)
  const balPenalty = Number(state.features?.bal_penalty ?? amount * 0.005)
  const balCharges = Number(state.features?.bal_charges ?? amount * 0.002)

  return {
    contract_amount: amount,
    balance_total: balanceTotal,
    arr_cap: arrCap,
    arr_int: arrInt,
    bal_penalty: balPenalty,
    bal_charges: balCharges,
    paid_pct: paidPct,
    interest_amount: Number(state.features?.interest_amount ?? amount * 0.15),
    installment: Number(state.features?.installment ?? amount / 24),
    tenure: Number(state.features?.tenure ?? 24),
    branch: state.features?.branch || state.branch || "Head Office",
    product_category: state.features?.product_category || "Micro",
    product: state.product || state.features?.product || "Micro Loan",
  }
}

export function mapAssessResponseToReport(api, state = {}) {
  const riskPct = Number(api.risk_pct) || 0
  const band = String(api.risk_band || "medium").toLowerCase()
  const classification =
    band === "low" ? "LOW" : band === "high" ? "HIGH" : "MEDIUM"

  const factors = api.explanation?.top_factors || []
  const shapContributors = factors.map((f) => {
    const { impact, level } = impactLevel(f.contribution)
    const increases = f.direction === "increases_risk" || f.direction === "increases"
    return {
      feature: humanize(f.feature),
      direction: increases ? "up" : "down",
      impact,
      level,
    }
  })

  const keyFactors = factors.slice(0, 4).map((f) => {
    const increases = f.direction === "increases_risk" || f.direction === "increases"
    return {
      label: humanize(f.feature),
      tone: increases ? "caution" : "positive",
    }
  })

  const base = buildRiskReport({
    ...state,
    loanAmount: state.loanAmount ?? api.features?.contract_amount,
    riskScore: Math.round(100 - riskPct),
  })

  return {
    ...base,
    riskScore: Math.round(100 - riskPct),
    defaultProbability: Math.round(riskPct),
    classification,
    confidence: 80,
    keyFactors: keyFactors.length ? keyFactors : RISK_REPORT.keyFactors,
    shapContributors: shapContributors.length
      ? shapContributors
      : RISK_REPORT.shapContributors,
    recommendation: api.recommendation || null,
    modelVersion: api.model_version || null,
    assessmentId: api.assessmentId || null,
    source: "api",
    narrative:
      `Live M1 assessment (${api.model_version || "m1"}). ` +
      `Estimated default risk ${Math.round(riskPct)}% → ${classification} band` +
      (api.recommendation ? `; system suggests ${api.recommendation}.` : "."),
  }
}
