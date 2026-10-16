/**
 * Negative tests for A2 fixture fail-closed guards (overrides + category).
 * Run: npm run verify:a2-fixture-guards
 */
import {
  applyRuntimeOverrides,
  parseFixtureCategory,
} from "./verify-a2-fixtures.js"

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
assert(parseFixtureCategory("threshold_decision").ok, "allows threshold_decision")
assert(parseFixtureCategory("input_rejection").ok, "allows input_rejection")
assert(!parseFixtureCategory("threshold").ok, "rejects unknown category")
assert(!parseFixtureCategory("").ok, "rejects empty category")
assert(!parseFixtureCategory(null).ok, "rejects non-string category")

console.log("\n=== applyRuntimeOverrides ===")
{
  const r = applyRuntimeOverrides({ metricValue: 1 }, undefined)
  assert(r.ok && r.value.metricValue === 1, "undefined overrides ok")
}
{
  const r = applyRuntimeOverrides({ a: 1 }, { metricValue: "NaN" })
  assert(r.ok && Number.isNaN(r.value.metricValue as number), "whitelist NaN")
}
{
  const r = applyRuntimeOverrides({ a: 1 }, { metricValue: "Infinity" })
  assert(
    r.ok && r.value.metricValue === Number.POSITIVE_INFINITY,
    "whitelist Infinity"
  )
}
{
  const r = applyRuntimeOverrides({ a: 1 }, { metricValue: "-Infinity" })
  assert(
    r.ok && r.value.metricValue === Number.NEGATIVE_INFINITY,
    "whitelist -Infinity"
  )
}
{
  const r = applyRuntimeOverrides({ a: 1 }, { metricValue: "nan" })
  assert(!r.ok, "rejects unknown override value")
}
{
  const r = applyRuntimeOverrides({ a: 1 }, { otherKey: "NaN" })
  assert(!r.ok, "rejects unknown override key")
}
{
  const r = applyRuntimeOverrides({ a: 1 }, { metricValue: "NaN", extra: 1 })
  assert(!r.ok, "rejects extra override keys")
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
