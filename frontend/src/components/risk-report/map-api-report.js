/**
 * Map M1 POST /api/risk/assess → Risk Report UI shape.
 * UI riskScore is creditworthiness (higher = safer). API overdue_prob is the chance the loan
 * becomes seriously overdue (arrears age > 1 period in the partner PAR snapshot).
 */

import { RISK_REPORT, buildRiskReport } from "./mock-data"

const FEATURE_LABELS = {
  branch: "Branch",
  product: "Loan product",
  product_category: "Product category",
  product_type: "Repayment frequency",
  contract_amount: "Loan amount",
  interest_amount: "Interest amount",
  installment: "Instalment size",
  tenure: "Loan term",
  installment_ratio: "Instalment vs loan amount",
  interest_ratio: "Interest vs loan amount",
}

function humanize(f) {
  const label = FEATURE_LABELS[f.feature] || f.feature.replace(/_/g, " ")
  return typeof f.value === "string" ? `${label}: ${f.value}` : label
}

// SHAP values are in log-odds, so the bands are much smaller than the old 0-100 scale.
function impactLevel(shap) {
  const abs = Math.abs(shap)
  if (abs >= 0.5) return { impact: 4, level: "High" }
  if (abs >= 0.2) return { impact: 3, level: "High" }
  if (abs >= 0.05) return { impact: 2, level: "Medium" }
  return { impact: 1, level: "Low" }
}

// Typical values from the partner PAR snapshot (weekly micro loans). Used ONLY for fields
// the application does not provide; the report tells the officer which ones were assumed.
const DEMO_DEFAULTS = {
  interest_ratio: 0.4,
  tenure: 36,
  branch: "Kandy",
  product_category: "Micro Loan",
  product_type: "Weekly",
  product: "SASIRI LOAN 01 (sl01)",
}

/** Build the 8 origination-time loan terms the model needs. Returns { features, assumed }. */
export function buildAssessFeatures(state = {}) {
  const given = state.features ?? {}
  const assumed = []
  const pick = (key, value, fallback) => {
    if (value !== undefined && value !== null && value !== "") return value
    assumed.push(key)
    return fallback
  }

  const amount = Number(pick("contract_amount", state.loanAmount ?? given.contract_amount, RISK_REPORT.loanAmount))
  const tenure = Number(pick("tenure", given.tenure, DEMO_DEFAULTS.tenure))
  const interest = Number(
    pick("interest_amount", given.interest_amount, Math.round(amount * DEMO_DEFAULTS.interest_ratio))
  )
  const installment = Number(
    pick("installment", given.installment, Math.round((amount + interest) / tenure))
  )

  const features = {
    contract_amount: amount,
    interest_amount: interest,
    installment,
    tenure,
    branch: pick("branch", given.branch ?? state.branch, DEMO_DEFAULTS.branch),
    product_category: pick("product_category", given.product_category, DEMO_DEFAULTS.product_category),
    product_type: pick("product_type", given.product_type, DEMO_DEFAULTS.product_type),
    product: pick("product", state.product ?? given.product, DEMO_DEFAULTS.product),
  }
  return { features, assumed }
}

export function mapAssessResponseToReport(api, state = {}, assumed = []) {
  const riskPct = Number(api.risk_pct ?? api.overdue_prob * 100) || 0
  const band = String(api.risk_band || "medium").toLowerCase()
  const classification = band === "low" ? "LOW" : band === "high" ? "HIGH" : "MEDIUM"

  const factors = api.explanation?.top_factors || []
  const isUp = (f) => f.direction === "increases_risk" || f.direction === "increases"

  const shapContributors = factors.map((f) => {
    const { impact, level } = impactLevel(f.shap_logodds ?? f.contribution ?? 0)
    return { feature: humanize(f), direction: isUp(f) ? "up" : "down", impact, level }
  })
  const keyFactors = factors.slice(0, 4).map((f) => ({
    label: humanize(f),
    tone: isUp(f) ? "caution" : "positive",
  }))

  const base = buildRiskReport({
    ...state,
    loanAmount: state.loanAmount,
    riskScore: Math.round(100 - riskPct),
  })

  return {
    ...base,
    riskScore: Math.round(100 - riskPct),
    defaultProbability: Math.round(riskPct),
    classification,
    keyFactors: keyFactors.length ? keyFactors : RISK_REPORT.keyFactors,
    shapContributors: shapContributors.length ? shapContributors : RISK_REPORT.shapContributors,
    recommendation: api.recommendation || null,
    modelVersion: api.model_version || null,
    assessmentId: api.assessmentId || null,
    assumedFields: assumed,
    unseenCategories: api.explanation?.unseen_categories ?? [],
    source: "api",
    narrative:
      `Live M1 assessment (${api.model_version || "m1"}). ` +
      `Estimated ${Math.round(riskPct)}% chance this loan becomes seriously overdue → ${classification} band` +
      (api.recommendation ? `; system suggests ${api.recommendation}.` : "."),
  }
}
