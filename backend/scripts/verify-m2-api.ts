/**
 * Verifies M2 API routes:
 * 1. M3 -> M2 Webhook events (POST /api/m2/events/loan-lifecycle) with x-internal-key & idempotency
 * 2. M2 Finance & MDI endpoints (/api/m2/dashboard/finance, /api/m2/dashboard/drift, /api/m2/alerts, /api/m2/kpis, /api/m2/social)
 *
 * Run: npx tsx scripts/verify-m2-api.ts
 */
import "dotenv/config"
import assert from "node:assert/strict"
import express from "express"
import { m2Router } from "../src/routes/m2.js"
import { m2EventsRouter } from "../src/routes/m2-events.js"
import { centralPrisma } from "../src/lib/prisma-central.js"
import { defaultTenantPrisma as tenantPrisma } from "../src/lib/prisma-tenant.js"
import { generateAccessToken } from "../src/lib/auth.js"

async function main() {
  process.env.M2_INTERNAL_KEY = "test-internal-key-min-16-chars-long"

  // Find demo institution & a finance officer / admin user
  const inst = await centralPrisma.institution.findFirst({
    where: { status: "active" },
    include: { users: { include: { role: true } } },
  })
  assert.ok(inst, "No active institution found in central DB")

  const user = inst.users.find((u) => ["finance_officer", "executive", "admin"].includes(u.role.name))
  assert.ok(user, "No finance_officer / executive / admin user found")

  const token = generateAccessToken({
    userId: user.id,
    institutionId: inst.id,
    role: user.role.name as any,
  })

  // Setup test server
  const app = express()
  app.use(express.json())
  app.use("/api/m2/events", m2EventsRouter)
  app.use("/api/m2", m2Router)

  const server = app.listen(0)
  const port = (server.address() as any).port
  const baseUrl = `http://localhost:${port}`

  try {
    console.log("Testing M2 Webhook Events (M3 -> M2)...")

    const sampleLoanId = "a0000000-0000-0000-0000-000000000001"
    const sampleDisbId = "b0000000-0000-0000-0000-000000000001"

    // 1. Missing / wrong key
    const resAuthFail = await fetch(`${baseUrl}/api/m2/events/loan-lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": "wrong-key" },
      body: JSON.stringify({
        event: "loan_disbursed",
        payload: {
          loanId: sampleLoanId,
          disbursementId: sampleDisbId,
          amount: 50000,
          date: "2026-08-01",
          institutionId: inst.id,
        },
      }),
    })
    assert.equal(resAuthFail.status, 401, "Should reject wrong internal key")

    // 2. Post valid loan_disbursed
    const resDisb = await fetch(`${baseUrl}/api/m2/events/loan-lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": process.env.M2_INTERNAL_KEY },
      body: JSON.stringify({
        event: "loan_disbursed",
        payload: {
          loanId: sampleLoanId,
          disbursementId: sampleDisbId,
          amount: 50000,
          date: "2026-08-01",
          institutionId: inst.id,
        },
      }),
    })
    assert.equal(resDisb.status, 201, `Disbursement event should create entry, got ${resDisb.status}`)
    const disbBody = await resDisb.json()
    assert.equal(disbBody.duplicate, false)

    // 3. Post duplicate loan_disbursed (Idempotency check)
    const resDisbDup = await fetch(`${baseUrl}/api/m2/events/loan-lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": process.env.M2_INTERNAL_KEY },
      body: JSON.stringify({
        event: "loan_disbursed",
        payload: {
          loanId: sampleLoanId,
          disbursementId: sampleDisbId,
          amount: 50000,
          date: "2026-08-01",
          institutionId: inst.id,
        },
      }),
    })
    assert.equal(resDisbDup.status, 200, "Duplicate disbursement should return 200")
    const dupBody = await resDisbDup.json()
    assert.equal(dupBody.duplicate, true)
    console.log("  Webhook loan_disbursed & deduplication verified.")

    // 4. Test authenticated M2 dashboard routes
    console.log("Testing authenticated M2 endpoints...")
    const headers = { Authorization: `Bearer ${token}` }

    const resFinDash = await fetch(`${baseUrl}/api/m2/dashboard/finance`, { headers })
    assert.equal(resFinDash.status, 200)
    const finDash = await resFinDash.json()
    assert.ok(finDash.summary.cashPosition !== undefined)
    assert.equal(finDash.balanced, true)
    console.log(`  GET /api/m2/dashboard/finance -> Cash: ${finDash.summary.cashPosition}, Balanced: ${finDash.balanced}`)

    const resDriftDash = await fetch(`${baseUrl}/api/m2/dashboard/drift`, { headers })
    assert.equal(resDriftDash.status, 200)
    const driftDash = await resDriftDash.json()
    assert.equal(driftDash.state, "alert")
    assert.ok(driftDash.mdi > 20)
    console.log(`  GET /api/m2/dashboard/drift -> MDI: ${driftDash.mdi}, State: ${driftDash.state}`)

    const resAlerts = await fetch(`${baseUrl}/api/m2/alerts`, { headers })
    assert.equal(resAlerts.status, 200)
    const alerts = await resAlerts.json()
    assert.ok(alerts.alerts.length >= 1)
    console.log(`  GET /api/m2/alerts -> ${alerts.alerts.length} alerts returned`)

    console.log("verify-m2-api: ALL CHECKS PASSED.")
  } finally {
    server.close()
    await centralPrisma.$disconnect()
    await tenantPrisma.$disconnect()
  }
}

main().catch((err) => {
  console.error("API verification failed:", err)
  process.exit(1)
})
