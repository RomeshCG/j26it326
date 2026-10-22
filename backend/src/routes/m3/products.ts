/**
 * M3 — Loan Products routes
 * GET  /api/m3/products          List active products
 * POST /api/m3/products          Create a product (admin)
 */
import { Router } from "express"
import { z } from "zod"
import { requireAuth, requireRole } from "../../lib/m3/auth.js"
import { resolveTenant } from "../../lib/m3/tenant-guard.js"

export const productsRouter = Router()

// ── GET /api/m3/products ─────────────────────────────────────────────────────
productsRouter.get("/", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  try {
    const products = await tenant.prisma.loanProduct.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    })
    res.json({ data: products })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch products"
    res.status(500).json({ error: message })
  }
})

// ── POST /api/m3/products ────────────────────────────────────────────────────
const CreateProductSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  productCategory: z.string().min(1),
  defaultInterestRate: z.number().positive(),
  minAmount: z.number().positive(),
  maxAmount: z.number().positive(),
  minTermMonths: z.number().int().positive(),
  maxTermMonths: z.number().int().positive(),
})

productsRouter.post(
  "/",
  requireAuth,
  // LO may ensure a demo product exists when wiring approve from the UI.
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = CreateProductSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const d = parsed.data
    try {
      const product = await tenant.prisma.loanProduct.create({
        data: {
          code: d.code,
          name: d.name,
          productCategory: d.productCategory,
          defaultInterestRate: d.defaultInterestRate,
          minAmount: d.minAmount,
          maxAmount: d.maxAmount,
          minTermMonths: d.minTermMonths,
          maxTermMonths: d.maxTermMonths,
        },
      })
      res.status(201).json({ data: product })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create product"
      res.status(500).json({ error: message })
    }
  }
)
