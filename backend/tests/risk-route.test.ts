// Run from backend/:  npx tsx --test tests/risk-route.test.ts
// Calls the handler directly (auth/RBAC are covered by verify-auth-rbac.ts); the model service is mocked.
import test from "node:test"
import assert from "node:assert/strict"
import { assessHandler, decisionHandler } from "../src/routes/risk.js"

const FEATURES = {
  contract_amount: 50000, interest_amount: 20000, installment: 1950, tenure: 36,
  branch: "Kandy", product_category: "Micro Loan", product_type: "Weekly", product: "SASIRI LOAN 01",
}
const MODEL_OUT = {
  overdue_prob: 0.42, risk_band: "medium", model_version: "m1-overdue-xgb-v2",
  top_factors: [{ feature: "branch", value: "Kandy", shap_logodds: 0.3, direction: "increases_risk" }],
  unseen_categories: [],
}

function call(body: unknown, opts: { create?: (a: any) => Promise<{ id: string }> } = {}) {
  const req: any = {
    body,
    user: { userId: "u1", role: "loan_officer", institutionId: "i1" },
    tenantPrisma: { riskAssessment: { create: opts.create ?? (async () => ({ id: "a1" })) } },
  }
  let status = 200, json: any
  const res: any = { status(c: number) { status = c; return res }, json(j: unknown) { json = j; return res } }
  return assessHandler(req, res).then(() => ({ status, json }))
}

const realFetch = globalThis.fetch
const mockModel = (ok: boolean) => { globalThis.fetch = (async () => ok ? new Response(JSON.stringify(MODEL_OUT)) : Promise.reject(new Error("down"))) as any }
test.afterEach(() => { globalThis.fetch = realFetch })

test("valid input returns score and maps recommendation", async () => {
  mockModel(true)
  const r = await call({ features: FEATURES })
  assert.equal(r.status, 200)
  assert.equal(r.json.risk_pct, 42)
  assert.equal(r.json.recommendation, "review")
  assert.deepEqual(r.json.borrower_fields_ignored, [])
})

test("unseen branch/product never auto-approves or rejects", async () => {
  const low = { ...MODEL_OUT, overdue_prob: 0.1, risk_band: "low", unseen_categories: ["branch"] }
  globalThis.fetch = (async () => new Response(JSON.stringify(low))) as any
  const r = await call({ features: { ...FEATURES, branch: "Colombo Head Office" } })
  assert.equal(r.json.recommendation, "review")
  assert.equal(r.json.reliability, "reduced")
})

test("borrower fields are accepted and reported as ignored by v2", async () => {
  mockModel(true)
  const r = await call({ features: { ...FEATURES, monthly_income: 60000, occupation: "Trader" } })
  assert.equal(r.status, 200)
  assert.deepEqual(r.json.borrower_fields_ignored, ["monthly_income", "occupation"])
})

test("400 on bad input", async () => {
  mockModel(true)
  assert.equal((await call({ features: { ...FEATURES, contract_amount: -1 } })).status, 400)
  assert.equal((await call({ features: { ...FEATURES, borrower_age: 5 } })).status, 400)
  assert.equal((await call({ features: FEATURES, persist: true })).status, 400) // needs loanApplicationId
})

test("503 when model service is down", async () => {
  mockModel(false)
  assert.equal((await call({ features: FEATURES })).status, 503)
})

test("persist returns assessmentId; DB error gives generic 500", async () => {
  mockModel(true)
  const id = "6f1c5c0e-1f0a-4b7e-9d53-2a3d3c9e7b11"
  const ok = await call({ features: FEATURES, persist: true, loanApplicationId: id })
  assert.equal(ok.json.assessmentId, "a1")
  const bad = await call({ features: FEATURES, persist: true, loanApplicationId: id },
    { create: async () => { throw new Error("secret db detail") } })
  assert.equal(bad.status, 500)
  assert.ok(!JSON.stringify(bad.json).includes("secret"))
})

const AID = "6f1c5c0e-1f0a-4b7e-9d53-2a3d3c9e7b11"
function decide(body: unknown, found = true) {
  const calls: any = { log: null, upsert: null }
  const req: any = {
    body,
    user: { userId: "u1", role: "loan_officer", institutionId: "i1" },
    tenantPrisma: {
      riskAssessment: { findUnique: async () => (found ? { recommendation: "reject" } : null) },
      decisionLog: { create: async (a: any) => { calls.log = a.data; return { id: "d1", createdAt: "now" } } },
      relianceProfile: { upsert: async (a: any) => { calls.upsert = a; return {} } },
    },
  }
  let status = 200, json: any
  const res: any = { status(c: number) { status = c; return res }, json(j: unknown) { json = j; return res } }
  return decisionHandler(req, res).then(() => ({ status, json, calls }))
}

test("decision: accept logs the stored AI recommendation, no reliance change", async () => {
  const r = await decide({ assessmentId: AID, decision: "accept" })
  assert.equal(r.status, 201)
  assert.equal(r.calls.log.userId, "u1")
  assert.equal(r.calls.log.aiRecommendation, "reject")
  assert.equal(r.calls.upsert, null)
})

test("decision: override needs reasoning, then bumps override count", async () => {
  assert.equal((await decide({ assessmentId: AID, decision: "override" })).status, 400)
  const r = await decide({ assessmentId: AID, decision: "override", reasoning: "known good client" })
  assert.equal(r.status, 201)
  assert.equal(r.calls.upsert.update.overrideCount.increment, 1)
})

test("decision: 400 on bad body, 404 on unknown assessment", async () => {
  assert.equal((await decide({ assessmentId: "x", decision: "accept" })).status, 400)
  assert.equal((await decide({ assessmentId: AID, decision: "maybe" })).status, 400)
  assert.equal((await decide({ assessmentId: AID, decision: "accept" }, false)).status, 404)
})
