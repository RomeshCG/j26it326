/**
 * M3 — Lending Groups routes
 * POST   /api/m3/groups                        Create group
 * GET    /api/m3/groups                        List groups (filter: branchId, status)
 * GET    /api/m3/groups/:id                    Group detail + members
 * POST   /api/m3/groups/:id/members            Add member to group
 * DELETE /api/m3/groups/:id/members/:borrowerId Remove member
 */
import { Router } from "express"
import { z } from "zod"
import { requireAuth, requireRole } from "../../lib/m3/auth.js"
import { resolveTenant } from "../../lib/m3/tenant-guard.js"
import { qs, p } from "../../lib/m3/query-helpers.js"

export const groupsRouter = Router()

// ── POST /api/m3/groups ──────────────────────────────────────────────────────
const CreateGroupSchema = z.object({
  branchId: z.string().uuid(),
  groupName: z.string().min(1),
  leaderBorrowerId: z.string().uuid().optional(),
})

groupsRouter.post(
  "/",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = CreateGroupSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const d = parsed.data
    try {
      const group = await tenant.prisma.lendingGroup.create({
        data: {
          branchId: d.branchId,
          groupName: d.groupName,
          leaderBorrowerId: d.leaderBorrowerId,
          status: "forming",
        },
      })
      res.status(201).json({ data: group })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create group"
      res.status(500).json({ error: message })
    }
  }
)

// ── GET /api/m3/groups ───────────────────────────────────────────────────────
groupsRouter.get("/", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const branchId = qs(req.query.branchId as string | string[] | undefined)
  const status = qs(req.query.status as string | string[] | undefined)

  try {
    const groups = await tenant.prisma.lendingGroup.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        _count: { select: { members: true } },
        leaderBorrower: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    })
    res.json({ data: groups })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list groups"
    res.status(500).json({ error: message })
  }
})

// ── GET /api/m3/groups/:id ───────────────────────────────────────────────────
groupsRouter.get("/:id", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  try {
    const group = await tenant.prisma.lendingGroup.findUnique({
      where: { id: p(req.params.id) },
      include: {
        members: {
          include: {
            borrower: {
              select: {
                id: true,
                fullName: true,
                nicNumber: true,
                gender: true,
                status: true,
              },
            },
          },
        },
        leaderBorrower: { select: { id: true, fullName: true } },
        repaymentStats: { orderBy: { period: "desc" }, take: 6 },
      },
    })

    if (!group) {
      res.status(404).json({ error: "Group not found" })
      return
    }

    res.json({ data: group })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch group"
    res.status(500).json({ error: message })
  }
})

// ── POST /api/m3/groups/:id/members ─────────────────────────────────────────
const AddMemberSchema = z.object({
  borrowerId: z.string().uuid(),
  roleInGroup: z.string().optional(),
  joinedAt: z.string().optional(), // ISO date
})

groupsRouter.post(
  "/:id/members",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = AddMemberSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const d = parsed.data
    try {
      const member = await tenant.prisma.groupMember.create({
        data: {
          groupId: p(req.params.id),
          borrowerId: d.borrowerId,
          roleInGroup: d.roleInGroup,
          joinedAt: d.joinedAt ? new Date(d.joinedAt) : new Date(),
        },
        include: {
          borrower: { select: { id: true, fullName: true } },
        },
      })
      res.status(201).json({ data: member })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add member"
      if (message.includes("Unique constraint")) {
        res.status(409).json({ error: "Borrower is already a member of this group" })
        return
      }
      res.status(500).json({ error: message })
    }
  }
)

// ── DELETE /api/m3/groups/:id/members/:borrowerId ────────────────────────────
groupsRouter.delete(
  "/:id/members/:borrowerId",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    try {
      await tenant.prisma.groupMember.deleteMany({
        where: {
          groupId: p(req.params.id),
          borrowerId: p(req.params.borrowerId),
        },
      })
      res.json({ data: { removed: true } })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove member"
      res.status(500).json({ error: message })
    }
  }
)
