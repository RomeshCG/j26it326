/**
 * M3 — Borrower routes
 * POST  /api/m3/borrowers          Create borrower
 * GET   /api/m3/borrowers          List borrowers (filter: branchId, status, kycStatus)
 * GET   /api/m3/borrowers/:id      Single borrower + documents
 * PATCH /api/m3/borrowers/:id      Update borrower / KYC status
 */
import { Router } from "express"
import { z } from "zod"
import { requireAuth, requireRole } from "../../lib/m3/auth.js"
import { resolveTenant } from "../../lib/m3/tenant-guard.js"
import { qs, p } from "../../lib/m3/query-helpers.js"

export const borrowersRouter = Router()

// ── POST /api/m3/borrowers ───────────────────────────────────────────────────
const CreateBorrowerSchema = z.object({
  branchId: z.string().uuid(),
  fullName: z.string().min(1),
  nicNumber: z.string().min(1),
  contactNumber: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  dateOfBirth: z.string().optional(), // ISO date string
  addressLine: z.string().optional(),
  district: z.string().optional(),
  localityType: z.enum(["rural", "urban", "estate"]).optional(),
  monthlyIncome: z.number().positive().optional(),
  incomeBand: z.string().optional(),
  occupation: z.string().optional(),
  householdSize: z.number().int().positive().optional(),
  isNewToBanking: z.boolean().optional(),
  povertyProxyScore: z.number().min(0).max(1).optional(),
})

borrowersRouter.post(
  "/",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = CreateBorrowerSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const d = parsed.data
    try {
      const borrower = await tenant.prisma.borrower.create({
        data: {
          branchId: d.branchId,
          fullName: d.fullName,
          nicNumber: d.nicNumber,
          contactNumber: d.contactNumber,
          gender: d.gender,
          dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : undefined,
          addressLine: d.addressLine,
          district: d.district,
          localityType: d.localityType,
          monthlyIncome: d.monthlyIncome,
          incomeBand: d.incomeBand,
          occupation: d.occupation,
          householdSize: d.householdSize,
          isNewToBanking: d.isNewToBanking,
          povertyProxyScore: d.povertyProxyScore,
          kycStatus: "pending",
          status: "active",
        },
      })
      res.status(201).json({ data: borrower })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create borrower"
      if (message.includes("Unique constraint")) {
        res.status(409).json({ error: "NIC number already registered" })
        return
      }
      res.status(500).json({ error: message })
    }
  }
)

// ── GET /api/m3/borrowers ────────────────────────────────────────────────────
borrowersRouter.get("/", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const branchId = qs(req.query.branchId as string | string[] | undefined)
  const status = qs(req.query.status as string | string[] | undefined)
  const kycStatus = qs(req.query.kycStatus as string | string[] | undefined)
  const search = qs(req.query.search as string | string[] | undefined)

  try {
    const borrowers = await tenant.prisma.borrower.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(status ? { status } : {}),
        ...(kycStatus ? { kycStatus } : {}),
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { nicNumber: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        branchId: true,
        fullName: true,
        nicNumber: true,
        contactNumber: true,
        gender: true,
        district: true,
        kycStatus: true,
        status: true,
        createdAt: true,
      },
    })
    res.json({ data: borrowers })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list borrowers"
    res.status(500).json({ error: message })
  }
})

// ── GET /api/m3/borrowers/:id ────────────────────────────────────────────────
borrowersRouter.get("/:id", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  try {
    const borrower = await tenant.prisma.borrower.findUnique({
      where: { id: p(req.params.id) },
      include: {
        documents: true,
        memberships: { include: { group: true } },
        loans: {
          where: { status: { not: "closed" } },
          select: { id: true, principal: true, status: true, activatedAt: true },
        },
      },
    })

    if (!borrower) {
      res.status(404).json({ error: "Borrower not found" })
      return
    }

    res.json({ data: borrower })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch borrower"
    res.status(500).json({ error: message })
  }
})

// ── PATCH /api/m3/borrowers/:id ──────────────────────────────────────────────
const UpdateBorrowerSchema = z.object({
  fullName: z.string().min(1).optional(),
  contactNumber: z.string().optional(),
  addressLine: z.string().optional(),
  district: z.string().optional(),
  monthlyIncome: z.number().positive().optional(),
  occupation: z.string().optional(),
  householdSize: z.number().int().positive().optional(),
  isNewToBanking: z.boolean().optional(),
  povertyProxyScore: z.number().min(0).max(1).optional(),
  kycStatus: z.enum(["pending", "verified", "rejected"]).optional(),
  status: z.enum(["active", "inactive", "blacklisted"]).optional(),
})

borrowersRouter.patch(
  "/:id",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = UpdateBorrowerSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    try {
      const borrower = await tenant.prisma.borrower.update({
        where: { id: p(req.params.id) },
        data: parsed.data,
      })
      res.json({ data: borrower })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update borrower"
      if (message.includes("Record to update not found")) {
        res.status(404).json({ error: "Borrower not found" })
        return
      }
      res.status(500).json({ error: message })
    }
  }
)
