/**
 * Negative tests for GT fixture category / scenario fail-closed + SPEC oracles.
 * Run: npm run verify:gt-fixture-guards
 */
import {
  parseFixtureCategory,
  parseGateScenario,
  oracleResolveTier,
  oracleValidTransition,
  oracleNextStatusAfterHandler,
  oracleGateExpect,
} from "./verify-gt-fixtures.js"

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

console.log("\n=== parseFixtureCategory ===")
assert(parseFixtureCategory("tier_routing").ok, "allows tier_routing")
assert(parseFixtureCategory("a1_approve_gate").ok, "allows a1_approve_gate")
assert(!parseFixtureCategory("threshold_decision").ok, "rejects foreign category")
assert(!parseFixtureCategory("").ok, "rejects empty")
assert(!parseFixtureCategory(null).ok, "rejects non-string")

console.log("\n=== parseGateScenario ===")
assert(parseGateScenario("self_approval").ok, "allows self_approval")
assert(!parseGateScenario("legacy_missing_preparer").ok, "rejects unknown scenario")
assert(!parseGateScenario(null).ok, "rejects non-string scenario")

console.log("\n=== oracle helpers (SPEC G2–G5 smoke) ===")
assert(
  oracleResolveTier(null).tier === 4 && oracleResolveTier(null).isFallback,
  "null → T4 fallback"
)
assert(
  oracleResolveTier({ tier: 1, isActive: true }).tier === 1 &&
    !oracleResolveTier({ tier: 1, isActive: true }).isFallback,
  "active T1"
)
assert(
  oracleValidTransition("pending_approval", "approved") &&
    !oracleValidTransition("pending_approval", "executed"),
  "transition sample"
)
assert(
  oracleNextStatusAfterHandler(2, true) === "notified" &&
    oracleNextStatusAfterHandler(3, true) === "executed",
  "post-handler sample"
)
assert(
  oracleGateExpect("self_approval").ok === false &&
    oracleGateExpect("self_approval").httpStatus === 403,
  "gate self_approval oracle"
)
assert(oracleGateExpect("valid_separate_users").ok === true, "gate valid oracle")

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
