import { Router } from "express"
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
})

const assessBodySchema = z.object({
  features: featuresSchema,
  loanApplicationId: z.string().uuid().optional(),
  persist: z.boolean().optional().default(false),
})

/**
 * POST /api/risk/assess
 * Score a loan feature payload. Optionally persist to tenant risk_assessments.
 * Roles: loan_officer, branch_manager, executive, admin
 */
riskRouter.post(
  "/assess",
  requireRole("loan_officer", "branch_manager", "executive", "admin"),
  async (req, res) => {
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
      throw error
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
        const message = error instanceof Error ? error.message : "Failed to persist risk assessment"
        res.status(500).json({ error: message })
        return
      }
    }

    res.json({
      ok: true,
      overdue_prob: result.overdue_prob,
      risk_pct: Math.round(result.overdue_prob * 10000) / 100, // 0-100, kept for existing UI
      risk_band: result.risk_band,
      recommendation: result.recommendation,
      model_version: result.model_version,
      explanation: {
        top_factors: result.top_factors,
        unseen_categories: result.unseen_categories,
      },
      assessmentId: assessmentId ?? null,
      scoredBy: {
        userId: req.user!.userId,
        role: req.user!.role,
        institutionId: req.user!.institutionId,
      },
    })
  }
)

/**
 * GET /api/risk/health
 * Lightweight check that M1 router is mounted (any authenticated role).
 */
riskRouter.get("/health", (_req, res) => {
  res.json({ ok: true, module: "m1-credit-risk", model_version: "m1-overdue-xgb-v2" })
})
