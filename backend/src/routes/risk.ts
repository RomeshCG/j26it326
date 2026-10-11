import { Router } from "express"
import { z } from "zod"
import { authenticate, resolveTenantContext, requireRole } from "../middleware/auth.js"
import { scoreRisk, type RiskFeatures } from "../services/risk-score.js"

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
  contract_amount: z.number().finite().nonnegative(),
  balance_total: z.number().finite().nonnegative(),
  arr_cap: z.number().finite().nonnegative().default(0),
  arr_int: z.number().finite().nonnegative().default(0),
  bal_penalty: z.number().finite().nonnegative().default(0),
  bal_charges: z.number().finite().nonnegative().default(0),
  paid_pct: z.number().finite().nonnegative(),
  interest_amount: z.number().finite().nonnegative().optional(),
  installment: z.number().finite().nonnegative().optional(),
  tenure: z.number().finite().positive().optional(),
  branch: z.string().optional(),
  product: z.string().optional(),
  product_category: z.string().optional(),
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
    const result = scoreRisk(features as RiskFeatures)

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
            riskScore: result.risk_pct,
            classification: result.risk_band,
            recommendation: result.recommendation,
            modelVersion: result.model_version,
            explanationPayload: {
              top_factors: result.top_factors,
              features,
              scored_by: req.user!.userId,
            },
            shapExplanations: {
              create: result.top_factors.map((f) => ({
                featureName: f.feature,
                contribution: f.contribution,
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
      risk_pct: result.risk_pct,
      risk_band: result.risk_band,
      recommendation: result.recommendation,
      model_version: result.model_version,
      explanation: {
        top_factors: result.top_factors,
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
  res.json({ ok: true, module: "m1-credit-risk", model_version: "m1-heuristic-v1" })
})
