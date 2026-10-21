/**
 * Offline safety checks for prepare-zz-viva-demo.ps1 (no network, no DB writes).
 *
 * Run: npx tsx scripts/verify-zz-viva-prep-offline.ts
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  A2_BUDGET_SOURCE_V1,
  buildBudgetDedupeKey,
  evaluateBudgetThreshold,
  validateBudgetThresholdInput,
} from "../src/lib/agent-a2-budget.js"
import { BUDGET_THRESHOLD_EVAL_ROLES } from "../src/routes/agent-governance.js"
import { hasCapability } from "../src/lib/permissions.js"

const ZZ_INSTITUTION_ID = "33b6545d-7c78-4354-a017-d0717efba3b8"
const PROTECTED_A1 = "c68649d1-eed9-4724-a187-d57c0617ab2c"
const SEED_TAG = "zz-viva-prep-2026-10"

/** Must stay in sync with prepare-zz-viva-demo.ps1 scenario table. */
const SCENARIOS = [
  {
    scenarioId: "N-A2-1",
    kind: "breach" as const,
    metricName: "zz_viva_a2_opex_utilization_breach_v1",
    metricValue: 125,
    threshold: 100,
    periodKey: SEED_TAG,
  },
  {
    scenarioId: "N-A2-2",
    kind: "breach" as const,
    metricName: "zz_viva_a2_branch_disbursement_cap_breach_v1",
    metricValue: 612000,
    threshold: 500000,
    periodKey: SEED_TAG,
  },
  {
    scenarioId: "N-A2-NB",
    kind: "no_breach" as const,
    metricName: "zz_viva_a2_opex_utilization_ok_v1",
    metricValue: 72,
    threshold: 100,
    periodKey: SEED_TAG,
  },
]

let passed = 0
let failed = 0

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const ps1Path = path.join(scriptDir, "prepare-zz-viva-demo.ps1")
const ps1 = readFileSync(ps1Path, "utf8")

console.log("\n=== prepare-zz-viva-demo.ps1 static gates ===")
assert(ps1.includes("ALLOW_ZZ_VIVA_PREP_WRITE"), "env write gate present")
assert(ps1.includes("[switch]$Write"), "-Write switch present")
assert(ps1.includes(ZZ_INSTITUTION_ID), "ZZ institution id embedded")
assert(ps1.includes("ZZ Test Org 1"), "ZZ institution name embedded")
assert(ps1.includes(PROTECTED_A1), "protected A1 id embedded")
assert(ps1.includes("manual_api_v1"), "honest manual_api_v1 source")
assert(
  ps1.toLowerCase().includes("not") && ps1.includes("M2"),
  "script warns against M2 monitoring claim"
)
assert(
  !ps1.includes('"/approve"') &&
    !ps1.includes("'/approve'") &&
    !ps1.includes('"/reject"') &&
    !ps1.includes("'/reject'"),
  "no approve/reject endpoint path literals"
)
assert(
  !ps1.includes("/test-dispatch"),
  "no /test-dispatch path"
)
assert(
  !ps1.includes("cbsl-report/prepare"),
  "no A1 prepare path"
)
assert(!ps1.includes("/nlq/query"), "no A4 NLQ write path")
assert(
  ps1.includes("/budget-threshold/evaluate"),
  "uses genuine A2 evaluate path"
)
assert(
  ps1.includes("/metrics/override-rates"),
  "verifies genuine override-rates dashboard query"
)
assert(ps1.includes("DRY-RUN") || ps1.includes("Dry-run"), "dry-run messaging")
assert(ps1.includes(".zz-test-credentials.local"), "uses gitignored credentials file")
assert(ps1.includes(".zz-viva-prep-manifest.local.json"), "manifest path")
assert(
  ps1.includes("finance_officer") && ps1.includes("executive"),
  "dual-role finance write + executive pending verify"
)

for (const sc of SCENARIOS) {
  assert(ps1.includes(sc.scenarioId), `PS1 contains ${sc.scenarioId}`)
  assert(ps1.includes(sc.metricName), `PS1 contains metric ${sc.metricName}`)
}

console.log("\n=== A2 payload validation (oracle-aligned) ===")
const dedupeKeys = new Set<string>()
for (const sc of SCENARIOS) {
  const validated = validateBudgetThresholdInput({
    metricName: sc.metricName,
    metricValue: sc.metricValue,
    threshold: sc.threshold,
    periodKey: sc.periodKey,
    source: A2_BUDGET_SOURCE_V1,
  })
  assert(validated.ok === true, `${sc.scenarioId} validates`)
  if (!validated.ok) continue

  const evaluation = evaluateBudgetThreshold(validated.value)
  const expectBreach = sc.kind === "breach"
  assert(
    evaluation.breached === expectBreach,
    `${sc.scenarioId} breached=${expectBreach}`
  )
  assert(evaluation.source === A2_BUDGET_SOURCE_V1, `${sc.scenarioId} source manual`)
  assert(
    !validateBudgetThresholdInput({
      ...validated.value,
      source: "m2_ledger",
    }).ok,
    `${sc.scenarioId} rejects m2_ledger pretend source`
  )

  const key = buildBudgetDedupeKey(validated.value)
  assert(!dedupeKeys.has(key), `${sc.scenarioId} unique dedupeKey`)
  dedupeKeys.add(key)
}

console.log("\n=== Role capability sanity ===")
assert(
  BUDGET_THRESHOLD_EVAL_ROLES.includes("finance_officer"),
  "finance may evaluate A2"
)
assert(
  hasCapability("finance_officer", "finance:manage_ledger"),
  "finance has ledger cap"
)
assert(
  !hasCapability("finance_officer", "agents:decide_tier3"),
  "finance cannot decide Tier3 (needs executive for /pending)"
)
assert(
  hasCapability("executive", "agents:decide_tier3"),
  "executive can list pending / metrics"
)

console.log(`\nOffline ZZ viva prep checks: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
