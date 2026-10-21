import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { authenticate, resolveTenantContext, requireRole } from "../middleware/auth.js"
import { scoreRisk, ModelServiceError } from "../services/risk-score.js"

/**
 * M1 credit-risk routes.
 * Mounted at /api/risk
 *
 * Middleware chain (M4 contract):
 *   authenticate → resolveTenantContext → requireRole(...)
 */
export const riskRouter = Router()

riskRouter.use(authenticate, resolveTenantContext)

const featuresSchema = z.object({
  contract_amount: z.number().finite().positive(),
  interest_amount: z.number().finite().nonnegative(),
  installment: z.number().finite().positive(),
  tenure: z.number().int().positive(),
  branch: z.string().min(1),
  product_category: z.string().min(1),
  product_type: z.string().min(1),
  product: z.string().min(1),
  // Borrower fields (expert-prior era). Optional: the v2 model ignores them; v3 will use them.
  borrower_age: z.number().int().min(18).max(100).optional(),
  dependants: z.number().int().min(0).max(20).optional(),
  monthly_income: z.number().finite().positive().optional(),
  living_expenses: z.number().finite().nonnegative().optional(),
  other_debt_payment: z.number().finite().nonnegative().optional(),
  business_age_years: z.number().finite().nonnegative().max(80).optional(),
  first_time_borrower: z.union([z.literal(0), z.literal(1)]).optional(),
  occupation: z.string().min(1).optional(),
  income_pattern: z.string().min(1).optional(),
  assets: z.string().min(1).optional(),
  civil_status: z.string().min(1).optional(),
})

// Fields the live model does not use yet; reported back so the UI never implies they moved the score.
const BORROWER_FIELDS = [
  "borrower_age", "dependants", "monthly_income", "living_expenses", "other_debt_payment",
  "business_age_years", "first_time_borrower", "occupation", "income_pattern", "assets", "civil_status",
]

const assessBodySchema = z.object({
  features: featuresSchema,
  loanApplicationId: z.string().uuid().optional(),
  persist: z.boolean().optional().default(false),
})

export async function assessHandler(req: Request, res: Response): Promise<void> {
  const parsed = assessBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    })
    return
  }

  const { features, loanApplicationId, persist } = parsed.data
  let result
  try {
    result = await scoreRisk(features)
  } catch (error) {
    if (error instanceof ModelServiceError) {
      res.status(503).json({ error: error.message })
      return
    }
    console.error("risk scoring failed", error)
    res.status(500).json({ error: "Risk scoring failed" })
    return
  }

  let assessmentId: string | undefined

  if (persist) {
    if (!loanApplicationId) {
      res.status(400).json({
        error: "loanApplicationId is required when persist=true",
      })
      return
    }

    try {
      const prisma = req.tenantPrisma!
      const created = await prisma.riskAssessment.create({
        data: {
          loanApplicationId,
          riskScore: Math.round(result.overdue_prob * 10000) / 100, // stored as 0-100
          classification: result.risk_band,
          recommendation: result.recommendation,
          modelVersion: result.model_version,
          explanationPayload: {
            top_factors: result.top_factors,
            unseen_categories: result.unseen_categories,
            reliability: result.reliability,
            features,
            scored_by: req.user!.userId,
          },
          shapExplanations: {
            create: result.top_factors.map((f) => ({
              featureName: f.feature,
              contribution: f.shap_logodds,
              direction: f.direction,
            })),
          },
        },
        select: { id: true },
      })
      assessmentId = created.id
    } catch (error) {
      console.error("risk persist failed", error)
      res.status(500).json({ error: "Failed to persist risk assessment" })
      return
    }
  }

  res.json({
    ok: true,
    overdue_prob: result.overdue_prob,
    risk_pct: Math.round(result.overdue_prob * 10000) / 100, // 0-100, kept for existing UI
    risk_band: result.risk_band,
    recommendation: result.recommendation,
    reliability: result.reliability,
    model_version: result.model_version,
    explanation: {
      top_factors: result.top_factors,
      unseen_categories: result.unseen_categories,
    },
    assessmentId: assessmentId ?? null,
    borrower_fields_ignored: BORROWER_FIELDS.filter((k) => k in features), // v2 model; empty once v3 is live
    scoredBy: {
      userId: req.user!.userId,
      role: req.user!.role,
      institutionId: req.user!.institutionId,
    },
  })
}

/**
 * POST /api/risk/assess
 * Score a loan feature payload. Optionally persist to tenant risk_assessments.
 * Roles: loan_officer, branch_manager, executive, admin
 */
riskRouter.post(
  "/assess",
  requireRole("loan_officer", "branch_manager", "executive", "admin"),
  assessHandler
)

const decisionBodySchema = z.object({
  assessmentId: z.string().uuid(),
  decision: z.enum(["accept", "override"]),
  reasoning: z.string().trim().max(1000).optional(),
  explanationMode: z.string().min(1).max(50).optional(),
})

export async function decisionHandler(req: Request, res: Response): Promise<void> {
  const parsed = decisionBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() })
    return
  }
  const { assessmentId, decision, reasoning, explanationMode } = parsed.data
  if (decision === "override" && !reasoning) {
    res.status(400).json({ error: "reasoning is required when overriding the recommendation" })
    return
  }

  try {
    const prisma = req.tenantPrisma!
    // The officer id comes from the verified JWT, never from the body; the AI recommendation is
    // read from the stored assessment so the client cannot rewrite what the model said.
    const assessment = await prisma.riskAssessment.findUnique({
      where: { id: assessmentId },
      select: { recommendation: true },
    })
    if (!assessment) {
      res.status(404).json({ error: "Risk assessment not found" })
      return
    }
    const userId = req.user!.userId
    const row = await prisma.decisionLog.create({
      data: {
        userId,
        contextType: "risk_assessment",
        referenceId: assessmentId,
        aiRecommendation: assessment.recommendation,
        humanDecision: decision,
        explanationMode,
        reasoning,
      },
      select: { id: true, createdAt: true },
    })
    if (decision === "override") {
      await prisma.relianceProfile.upsert({
        where: { userId },
        create: { userId, overrideCount: 1 },
        update: { overrideCount: { increment: 1 } },
      })
    }
    res.status(201).json({ ok: true, decisionId: row.id, createdAt: row.createdAt })
  } catch (error) {
    console.error("decision save failed", error)
    res.status(500).json({ error: "Failed to save decision" })
  }
}

/**
 * POST /api/risk/decisions
 * Record the officer's accept / override of a stored assessment (decision_log + reliance_profiles).
 */
riskRouter.post(
  "/decisions",
  requireRole("loan_officer", "branch_manager", "executive", "admin"),
  decisionHandler
)

/**
 * GET /api/risk/health
 * Lightweight check that M1 router is mounted (any authenticated role).
 */
riskRouter.get("/health", (_req, res) => {
  res.json({ ok: true, module: "m1-credit-risk", model_version: "m1-overdue-xgb-v2" })
})
