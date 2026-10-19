/**
 * M1 risk scoring client. The model lives in the internal FastAPI service
 * (ml/m1_credit_risk/serve/app.py); Express keeps auth, tenancy and RBAC.
 */

export type LoanTerms = {
  contract_amount: number
  interest_amount: number
  installment: number
  tenure: number
  branch: string
  product_category: string
  product_type: string
  product: string
  // Optional borrower fields; forwarded as-is, the model service decides which it uses.
  [borrowerField: string]: string | number | undefined
}

export type RiskFactor = {
  feature: string
  value: string | number
  shap_logodds: number
  direction: "increases_risk" | "reduces_risk"
}

export type RiskScoreResult = {
  overdue_prob: number
  risk_band: "low" | "medium" | "high"
  recommendation: "approve" | "review" | "reject"
  model_version: string
  top_factors: RiskFactor[]
  unseen_categories: string[]
}

export class ModelServiceError extends Error {}

const MODEL_URL = () => process.env.M1_MODEL_URL ?? "http://127.0.0.1:8001"

// Provisional: bands come from the model service; mapping to an officer-facing hint is ours.
const RECOMMENDATION = { low: "approve", medium: "review", high: "reject" } as const

export async function scoreRisk(terms: LoanTerms): Promise<RiskScoreResult> {
  let res: Response
  try {
    res = await fetch(`${MODEL_URL()}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(terms),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    throw new ModelServiceError("Risk model service is unreachable")
  }
  if (!res.ok) throw new ModelServiceError(`Risk model service returned ${res.status}`)

  const out = (await res.json()) as Omit<RiskScoreResult, "recommendation">
  return { ...out, recommendation: RECOMMENDATION[out.risk_band] }
}
