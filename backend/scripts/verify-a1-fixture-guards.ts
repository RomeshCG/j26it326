/**
 * Negative tests for A1 fixture category fail-closed + S0 helper.
 * Run: npm run verify:a1-fixture-guards
 */
import {
  parseFixtureCategory,
  statusFromExpectedGaps,
} from "./verify-a1-fixtures.js"

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
assert(parseFixtureCategory("readiness_analysis").ok, "allows readiness_analysis")
assert(!parseFixtureCategory("threshold_decision").ok, "rejects foreign category")
assert(!parseFixtureCategory("").ok, "rejects empty")
assert(!parseFixtureCategory(null).ok, "rejects non-string")

console.log("\n=== statusFromExpectedGaps (SPEC S0) ===")
assert(
  statusFromExpectedGaps([]) === "evidence_complete_for_scoped_checks",
  "empty => complete"
)
assert(
  statusFromExpectedGaps([{ code: "X", severity: "info" }]) ===
    "evidence_complete_for_scoped_checks",
  "info alone => complete"
)
assert(
  statusFromExpectedGaps([{ code: "X", severity: "warning" }]) ===
    "ready_with_warnings",
  "warning => ready_with_warnings"
)
assert(
  statusFromExpectedGaps([{ code: "X", severity: "blocking" }]) === "not_ready",
  "blocking => not_ready"
)
assert(
  statusFromExpectedGaps(
    [
      { code: "A", severity: "blocking" },
      { code: "B", severity: "warning" },
    ]
  ) === "not_ready",
  "blocking wins over warning"
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
