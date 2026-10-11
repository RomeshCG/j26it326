/**
 * M1 risk scoring (v1 heuristic — same formula as ml/m1_credit_risk features/schema).
 * Swap `scoreRisk` internals later for a Python/XGBoost call without changing the route contract.
 */

export const RISK_MODEL_VERSION = "m1-heuristic-v1"

export type RiskFeatures = {
  contract_amount: number
  balance_total: number
  arr_cap: number
  arr_int: number
  bal_penalty: number
  bal_charges: number
  paid_pct: number
  // optional extras accepted but not required for v1 score
  interest_amount?: number
  installment?: number
  tenure?: number
  branch?: string
  product?: string
  product_category?: string
}

export type RiskFactor = {
  feature: string
  contribution: number
  direction: "increases_risk" | "decreases_risk"
}

export type RiskScoreResult = {
  risk_pct: number
  risk_band: "low" | "medium" | "high"
  recommendation: "approve" | "review" | "reject"
  model_version: string
  top_factors: RiskFactor[]
}

function clip(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function band(riskPct: number): RiskScoreResult["risk_band"] {
  if (riskPct < 35) return "low"
  if (riskPct <= 65) return "medium"
  return "high"
}

function recommendation(riskPct: number): RiskScoreResult["recommendation"] {
  if (riskPct < 35) return "approve"
  if (riskPct <= 65) return "review"
  return "reject"
}

/** Compute risk_pct 0–100 and additive factor breakdown (explainable stand-in for SHAP). */
export function scoreRisk(features: RiskFeatures): RiskScoreResult {
  const amount = Math.max(Number(features.contract_amount) || 0, 1)
  const balance = Math.max(Number(features.balance_total) || 0, 1)
  const arrCap = Math.max(Number(features.arr_cap) || 0, 0)
  const arrInt = Math.max(Number(features.arr_int) || 0, 0)
  const penalty = Math.max(Number(features.bal_penalty) || 0, 0)
  const charges = Math.max(Number(features.bal_charges) || 0, 0)
  let paidPct = Number(features.paid_pct) || 0
  if (paidPct <= 1.5) paidPct = paidPct * 100
  paidPct = clip(paidPct, 0, 100)

  const arrearsTotal = arrCap + arrInt
  const arrearsRatio = clip(arrearsTotal / balance, 0, 2)
  const paidProgress = paidPct / 100
  const penRatio = clip(penalty / amount, 0, 1)
  const chgRatio = clip(charges / amount, 0, 1)

  const parts: RiskFactor[] = [
    {
      feature: "arrears_ratio",
      contribution: 40 * arrearsRatio,
      direction: arrearsRatio > 0 ? "increases_risk" : "decreases_risk",
    },
    {
      feature: "paid_pct",
      contribution: 25 * (1 - paidProgress),
      direction: paidProgress >= 0.5 ? "decreases_risk" : "increases_risk",
    },
    {
      feature: "bal_penalty",
      contribution: 20 * penRatio,
      direction: penRatio > 0 ? "increases_risk" : "decreases_risk",
    },
    {
      feature: "bal_charges",
      contribution: 15 * chgRatio,
      direction: chgRatio > 0 ? "increases_risk" : "decreases_risk",
    },
  ]

  const riskPct = clip(
    parts.reduce((s, p) => s + p.contribution, 0),
    0,
    100
  )

  const top_factors = [...parts]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .map((p) => ({
      feature: p.feature,
      contribution: Math.round(p.contribution * 10000) / 10000,
      direction: p.direction,
    }))

  return {
    risk_pct: Math.round(riskPct * 100) / 100,
    risk_band: band(riskPct),
    recommendation: recommendation(riskPct),
    model_version: RISK_MODEL_VERSION,
    top_factors,
  }
}
