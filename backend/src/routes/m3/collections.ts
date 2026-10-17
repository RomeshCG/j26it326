/**
 * M3 — Collections & Receipts routes
 *
 * POST /api/m3/collections          Record a field collection visit
 * GET  /api/m3/collections          List collections (filter: loanId, officerId, date range)
 * GET  /api/m3/collections/:id      Collection detail + receipt(s)
 * POST /api/m3/collections/sync     Offline batch sync (array of queued entries)
 */
import { Router } from "express"
import { z } from "zod"
import { requireAuth, requireRole } from "../../lib/m3/mock-auth.js"
import { resolveTenant } from "../../lib/m3/tenant-guard.js"
import { emitPaymentCollected } from "../../lib/m3/m2-events.js"
import { qs, p } from "../../lib/m3/query-helpers.js"

export const collectionsRouter = Router()

// ── Shared schema ─────────────────────────────────────────────────────────────
const CollectionEntrySchema = z.object({
  loanId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  visitDate: z.string(), // ISO date
  outcome: z.enum(["paid", "partial", "missed", "promise_to_pay", "not_at_home"]),
  amountCollected: z.number().min(0),
  notes: z.string().optional(),
  promiseDate: z.string().optional(),
  syncedOfflineEntry: z.boolean().optional().default(false),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processCollection(
  tx: any,
  entry: z.infer<typeof CollectionEntrySchema>,
  officerId: string,
  _institutionId: string
) {
  // 1. Create the collection record
  const collection = await tx.collection.create({
    data: {
      loanId: entry.loanId,
      scheduleId: entry.scheduleId,
      officerId,
      visitDate: new Date(entry.visitDate),
      outcome: entry.outcome,
      amountCollected: entry.amountCollected,
      promiseDate: entry.promiseDate ? new Date(entry.promiseDate) : undefined,
      syncedOfflineEntry: entry.syncedOfflineEntry ?? false,
    },
  })

  // 2. Update the repayment schedule's amountPaid
  const schedule = await tx.repaymentSchedule.findUnique({
    where: { id: entry.scheduleId },
  })

  if (schedule) {
    const newAmountPaid = Number(schedule.amountPaid) + entry.amountCollected
    const newStatus =
      newAmountPaid >= Number(schedule.amountDue)
        ? "paid"
        : entry.amountCollected > 0
        ? "partial"
        : schedule.status

    await tx.repaymentSchedule.update({
      where: { id: entry.scheduleId },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
    })
  }

  // 3. Generate a receipt if amount > 0
  let receipt = null
  if (entry.amountCollected > 0) {
    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    receipt = await tx.receipt.create({
      data: {
        collectionId: collection.id,
        receiptNumber,
        amount: entry.amountCollected,
      },
    })
  }

  return { collection, receipt }
}

// ── POST /api/m3/collections ─────────────────────────────────────────────────
collectionsRouter.post(
  "/",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = CollectionEntrySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const entry = parsed.data

    try {
      const { collection, receipt } = await tenant.prisma.$transaction(async (tx) => {
        return processCollection(tx as any, entry, req.auth!.userId, tenant.institutionId)
      })

      // Emit M2 event (best-effort)
      if (entry.amountCollected > 0) {
        emitPaymentCollected({
          loanId: entry.loanId,
          collectionId: collection.id,
          amount: entry.amountCollected,
          date: entry.visitDate,
          institutionId: tenant.institutionId,
        }).catch((err) => console.error("[M3→M2] Failed to emit payment_collected event:", err))
      }

      res.status(201).json({ data: { collection, receipt } })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record collection"
      res.status(500).json({ error: message })
    }
  }
)

// ── GET /api/m3/collections ───────────────────────────────────────────────────
collectionsRouter.get("/", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  const loanId = qs(req.query.loanId as string | string[] | undefined)
  const officerId = qs(req.query.officerId as string | string[] | undefined)
  const from = qs(req.query.from as string | string[] | undefined)
  const to = qs(req.query.to as string | string[] | undefined)

  try {
    const collections = await tenant.prisma.collection.findMany({
      where: {
        ...(loanId ? { loanId } : {}),
        ...(officerId ? { officerId } : {}),
        ...(from || to
          ? {
              visitDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        receipts: true,
        schedule: { select: { installmentNo: true, dueDate: true, amountDue: true } },
      },
      orderBy: { visitDate: "desc" },
    })
    res.json({ data: collections })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list collections"
    res.status(500).json({ error: message })
  }
})

// ── GET /api/m3/collections/:id ──────────────────────────────────────────────
collectionsRouter.get("/:id", requireAuth, async (req, res) => {
  const tenant = await resolveTenant(req, res)
  if (!tenant) return

  try {
    const collection = await tenant.prisma.collection.findUnique({
      where: { id: p(req.params.id) },
      include: {
        receipts: true,
        schedule: true,
        loan: {
          select: { id: true, principal: true, status: true, borrower: { select: { fullName: true } } },
        },
      },
    })

    if (!collection) {
      res.status(404).json({ error: "Collection not found" })
      return
    }

    res.json({ data: collection })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch collection"
    res.status(500).json({ error: message })
  }
})

// ── POST /api/m3/collections/sync ────────────────────────────────────────────
// Offline batch sync: accepts an array of queued collection entries
const SyncPayloadSchema = z.object({
  entries: z.array(
    CollectionEntrySchema.extend({
      localId: z.string(), // client-side idempotency key
    })
  ),
})

collectionsRouter.post(
  "/sync",
  requireAuth,
  requireRole("loan_officer", "branch_manager", "admin"),
  async (req, res) => {
    const tenant = await resolveTenant(req, res)
    if (!tenant) return

    const parsed = SyncPayloadSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }

    const results: Array<{
      localId: string
      status: "created" | "error"
      collectionId?: string
      receiptNumber?: string
      error?: string
    }> = []

    for (const entry of parsed.data.entries) {
      try {
        const { collection, receipt } = await tenant.prisma.$transaction(async (tx) => {
          return processCollection(tx as any, entry, req.auth!.userId, tenant.institutionId)
        })

        if (entry.amountCollected > 0) {
          emitPaymentCollected({
            loanId: entry.loanId,
            collectionId: collection.id,
            amount: entry.amountCollected,
            date: entry.visitDate,
            institutionId: tenant.institutionId,
          }).catch(() => {})
        }

        results.push({
          localId: entry.localId,
          status: "created",
          collectionId: collection.id,
          receiptNumber: receipt?.receiptNumber,
        })
      } catch (err) {
        results.push({
          localId: entry.localId,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        })
      }
    }

    res.json({ data: results })
  }
)
