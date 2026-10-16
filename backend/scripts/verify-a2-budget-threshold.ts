/**
 * Offline verification for A2 budget-threshold v1 (no DB / no live dispatch).
 *
 * Run: npx tsx scripts/verify-a2-budget-threshold.ts
 */
import {
  A2_BUDGET_ACTION_TYPE,
  A2_BUDGET_MODEL_VERSION,
  A2_BUDGET_SOURCE_V1,
  buildBudgetBreachActionText,
  buildBudgetBreachInputPayload,
  buildBudgetDedupeKey,
  evaluateBudgetThreshold,
  findRecentBudgetDedupeMatch,
  validateBudgetThresholdInput,
} from "../src/lib/agent-a2-budget.js"
import {
  budgetThresholdAlertHandler,
  clearActionHandlers,
  executeActionHandler,
  getActionHandler,
  hasRegisteredActionHandler,
  registerDefaultAgentHandlers,
} from "../src/lib/agent-handlers.js"
import { BUDGET_THRESHOLD_EVAL_ROLES } from "../src/routes/agent-governance.js"
import { hasCapability, type RoleName } from "../src/lib/permissions.js"

let passed = 0
let failed = 0

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`)
}

section("validateBudgetThresholdInput")
assert(
  !validateBudgetThresholdInput(null).ok,
  "rejects null body"
)
assert(
  !validateBudgetThresholdInput({ metricName: "x" }).ok,
  "rejects missing metricValue/threshold"
)
assert(
  !validateBudgetThresholdInput({
    metricName: "opex",
    metricValue: Number.NaN,
    threshold: 100,
  }).ok,
  "rejects NaN metricValue"
)
assert(
  !validateBudgetThresholdInput({
    metricName: "opex",
    metricValue: 10,
    threshold: 0,
  }).ok,
  "rejects non-positive threshold"
)
assert(
  !validateBudgetThresholdInput({
    metricName: "opex",
    metricValue: -1,
    threshold: 100,
  }).ok,
  "rejects negative metricValue"
)
assert(
  !validateBudgetThresholdInput({
    metricName: "opex",
    metricValue: 10,
    threshold: 100,
    source: "m2_ledger",
  }).ok,
  "rejects pretending M2 source before monitoring exists"
)
{
  const ok = validateBudgetThresholdInput({
    metricName: "  monthly_opex_lkr  ",
    metricValue: 85,
    threshold: 100,
  })
  assert(ok.ok === true, "accepts valid payload")
  if (ok.ok) {
    assert(ok.value.metricName === "monthly_opex_lkr", "trims metricName")
    assert(ok.value.source === A2_BUDGET_SOURCE_V1, "defaults source to manual_api_v1")
    assert(ok.value.periodKey === "unspecified", "defaults periodKey")
  }
}

section("evaluateBudgetThreshold")
{
  const base = {
    metricName: "monthly_opex_lkr",
    periodKey: "2026-10",
    source: A2_BUDGET_SOURCE_V1,
    branchId: null as string | null,
  }
  assert(
    evaluateBudgetThreshold({ ...base, metricValue: 99, threshold: 100 }).breached ===
      false,
    "99 < 100 is non-breach"
  )
  assert(
    evaluateBudgetThreshold({ ...base, metricValue: 100, threshold: 100 }).breached ===
      true,
    "100 >= 100 equality is breach"
  )
  assert(
    evaluateBudgetThreshold({ ...base, metricValue: 150, threshold: 100 }).breached ===
      true,
    "150 >= 100 is breach"
  )
  const ev = evaluateBudgetThreshold({ ...base, metricValue: 150, threshold: 100 })
  assert(ev.rule === "metricValue >= threshold", "records comparison rule")
  assert(
    ev.dedupeKey ===
      buildBudgetDedupeKey({
        metricName: base.metricName,
        threshold: 100,
        periodKey: base.periodKey,
        source: base.source,
        branchId: null,
      }),
    "dedupeKey is stable"
  )
}

section("payload builders")
{
  const evaluation = evaluateBudgetThreshold({
    metricName: "monthly_opex_lkr",
    metricValue: 120,
    threshold: 100,
    periodKey: "2026-10",
    source: A2_BUDGET_SOURCE_V1,
    branchId: null,
  })
  const payload = buildBudgetBreachInputPayload(evaluation)
  assert(payload.dedupeKey === evaluation.dedupeKey, "inputPayload includes dedupeKey")
  assert(
    (payload.notificationIntent as { channel: string }).channel === "agent_log",
    "notificationIntent is agent_log only"
  )
  assert(
    buildBudgetBreachActionText(evaluation).includes("120 >= 100"),
    "action text includes values"
  )
  assert(A2_BUDGET_ACTION_TYPE === "budget_threshold_alert", "action type constant")
  assert(
    A2_BUDGET_MODEL_VERSION === "a2-budget-threshold-rules-v1",
    "model version constant"
  )
}

section("soft dedupe helper")
{
  const key = "a2-budget-v1|manual_api_v1|2026-10|opex|100|none"
  const now = Date.now()
  const rows = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: new Date(now - 1000),
      inputPayload: { dedupeKey: key },
    },
  ]
  assert(
    findRecentBudgetDedupeMatch(rows, key, now)?.id === rows[0].id,
    "finds matching recent dedupeKey"
  )
  assert(
    findRecentBudgetDedupeMatch(rows, key, now, 10) === null,
    "ignores rows outside window"
  )
  assert(
    findRecentBudgetDedupeMatch(rows, "other-key", now) === null,
    "ignores different dedupeKey"
  )
}

async function runAsyncSections() {
  section("handler registration (not stub)")
  clearActionHandlers()
  assert(
    !hasRegisteredActionHandler(A2_BUDGET_ACTION_TYPE),
    "cleared registry has no A2 handler"
  )
  assert(
    getActionHandler(A2_BUDGET_ACTION_TYPE) !== budgetThresholdAlertHandler,
    "fallback is stub before register"
  )
  registerDefaultAgentHandlers()
  assert(
    hasRegisteredActionHandler(A2_BUDGET_ACTION_TYPE),
    "registerDefaultAgentHandlers registers A2"
  )
  assert(
    getActionHandler(A2_BUDGET_ACTION_TYPE) === budgetThresholdAlertHandler,
    "getActionHandler returns real A2 handler"
  )

  const evaluation = evaluateBudgetThreshold({
    metricName: "monthly_opex_lkr",
    metricValue: 120,
    threshold: 100,
    periodKey: "2026-10",
    source: A2_BUDGET_SOURCE_V1,
    branchId: null,
  })
  const exec = await executeActionHandler({
    actionId: "22222222-2222-4222-8222-222222222222",
    actionType: A2_BUDGET_ACTION_TYPE,
    agentId: "A2",
    agentName: "Workflow",
    tier: 2,
    inputPayload: buildBudgetBreachInputPayload(evaluation),
  })
  assert(exec.success === true, "handler succeeds")
  const out = exec.outputPayload as Record<string, unknown>
  assert(out.stubExecuted === false, "output is not stubExecuted:true")
  assert(out.notificationChannel === "agent_log", "channel agent_log")
  assert(
    out.emailSent === false && out.smsSent === false && out.pushSent === false,
    "no email/sms/push"
  )
  assert(out.metricValue === 120 && out.threshold === 100, "echoes metric evidence")
  assert(out.modelVersion === A2_BUDGET_MODEL_VERSION, "records model version")

  section("RBAC role gate (not view_actions alone)")
  const roles = new Set(BUDGET_THRESHOLD_EVAL_ROLES)
  assert(roles.has("admin"), "admin may evaluate")
  assert(roles.has("executive"), "executive may evaluate")
  assert(roles.has("branch_manager"), "branch_manager may evaluate")
  assert(roles.has("finance_officer"), "finance_officer may evaluate (ledger)")
  assert(!roles.has("loan_officer"), "loan_officer cannot evaluate")
  assert(!roles.has("hr_officer"), "hr_officer cannot evaluate")

  assert(
    hasCapability("loan_officer", "agents:view_actions") && !roles.has("loan_officer"),
    "view_actions alone does not grant evaluate"
  )

  for (const role of BUDGET_THRESHOLD_EVAL_ROLES) {
    const ok =
      hasCapability(role as RoleName, "agents:decide_tier3") ||
      hasCapability(role as RoleName, "finance:manage_ledger")
    assert(ok, `${role} has decide_tier3 or finance:manage_ledger`)
  }

  section("tenant isolation contract (design)")
  const sneaky = validateBudgetThresholdInput({
    metricName: "opex",
    metricValue: 1,
    threshold: 1,
    institutionId: "00000000-0000-4000-8000-000000000099",
  })
  assert(sneaky.ok === true, "extra institutionId in body is ignored by validator")
  if (sneaky.ok) {
    assert(
      !("institutionId" in sneaky.value),
      "normalized value does not carry institutionId"
    )
  }
}

await runAsyncSections()

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
