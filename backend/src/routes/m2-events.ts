/**
 * M3 -> M2 event webhook: POST /api/m2/events/loan-lifecycle
 *
 * M3 sends no JWT, so this router authenticates with a shared secret header `x-internal-key`
 * (M2_INTERNAL_KEY in .env, >= 16 chars). Returns 503 until the key is configured.
 * The tenant is found with resolveTenantByInstitutionId(payload.institutionId).
 *
 * Idempotent: disbursementId / collectionId is saved as the journal's referenceId; replays are skipped.
 * Each event creates one balanced journal through the single posting function.
 */
import crypto from "node:crypto"
import { Router } from "express"
import { z } from "zod"
import { resolveTenantByInstitutionId } from "../lib/tenant-context.js"
import { logSafeError } from "../lib/auth.js"
import { LedgerError, disbursementLines, postJournalEntry, repaymentLines } from "../lib/m2/ledger.js"

export const m2EventsRouter = Router()

function keyMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const amount = z.number().positive().refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "max 2 decimals")
const base = { loanId: z.string().uuid(), date: z.string().min(8), institutionId: z.string().uuid() }

const disbursed = z.object({
  event: z.literal("loan_disbursed"),
  payload: z.object({ ...base, disbursementId: z.string().uuid(), amount }),
})
const collected = z.object({
  event: z.literal("payment_collected"),
  payload: z.object({
    ...base,
    collectionId: z.string().uuid(),
    amount,
    // not sent by M3 yet: until then the whole amount is posted to principal
    principalAmount: z.number().nonnegative().optional(),
    interestAmount: z.number().nonnegative().optional(),
  }),
})
const eventSchema = z.discriminatedUnion("event", [disbursed, collected])

m2EventsRouter.post("/loan-lifecycle", async (req, res) => {
  const expected = process.env.M2_INTERNAL_KEY
  if (!expected || expected.length < 16) {
    res.status(503).json({ error: "M2 event endpoint is not configured (set M2_INTERNAL_KEY)" })
    return
  }
  if (!keyMatches(req.header("x-internal-key"), expected)) {
    res.status(401).json({ error: "Invalid internal key" })
    return
  }

  const parsed = eventSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid event", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) })
    return
  }
  const { event, payload } = parsed.data
  const when = new Date(payload.date)
  if (Number.isNaN(when.getTime())) {
    res.status(400).json({ error: "Invalid event", details: ["payload.date: not a valid date"] })
    return
  }

  try {
    const tenant = await resolveTenantByInstitutionId(payload.institutionId)
    if (!tenant.ok) {
      res.status(tenant.status).json({ error: tenant.message })
      return
    }

    if (event === "loan_disbursed") {
      const r = await postJournalEntry(tenant.prisma, {
        transactionDate: when,
        referenceType: "loan_disbursed",
        referenceId: payload.disbursementId,
        description: `Loan disbursed (loan ${payload.loanId})`,
        dataSource: "app",
        lines: disbursementLines(payload.amount.toFixed(2)),
      })
      res.status(r.duplicate ? 200 : 201).json({ journalId: r.id, duplicate: r.duplicate })
      return
    }

    // payment_collected: principal/interest split if provided, otherwise everything to principal
    const interest = payload.interestAmount ?? 0
    const principal = payload.principalAmount ?? payload.amount - interest
    if (principal < 0 || Math.abs(principal + interest - payload.amount) > 0.005) {
      res.status(400).json({ error: "principalAmount + interestAmount must equal amount" })
      return
    }
    const r = await postJournalEntry(tenant.prisma, {
      transactionDate: when,
      referenceType: "payment_collected",
      referenceId: payload.collectionId,
      description: `Payment collected (loan ${payload.loanId})`,
      dataSource: "app",
      lines: repaymentLines(principal.toFixed(2), interest.toFixed(2)),
    })
    res.status(r.duplicate ? 200 : 201).json({ journalId: r.id, duplicate: r.duplicate })
  } catch (err) {
    if (err instanceof LedgerError) {
      res.status(422).json({ error: err.message })
      return
    }
    logSafeError("m2.events.loan-lifecycle", err)
    res.status(500).json({ error: "Failed to record event" })
  }
})
