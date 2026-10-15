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


