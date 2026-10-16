/**
 * Offline regression for run-offline-eval pass/fail + count parsing.
 * Run: npm run verify:offline-eval-runner
 */
import {
  isSuitePassed,
  parseAssertionCounts,
} from "./run-offline-eval.js"

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

console.log("\n=== parseAssertionCounts ===")
{
  const a = parseAssertionCounts("noise\n62 passed, 0 failed\n")
  assert(a.passed === 62 && a.failed === 0 && a.note === null, "simple summary")
}
{
  const a = parseAssertionCounts(
    "Verification Complete: 205 Passed, 0 Failed\n"
  )
  assert(a.passed === 205 && a.failed === 0 && a.note === null, "GT summary")
}
{
  const a = parseAssertionCounts("46 passed, 3 failed")
  assert(a.passed === 46 && a.failed === 3, "nonzero assertion failures")
}
{
  const a = parseAssertionCounts("no summary here")
  assert(
    a.passed === null && a.failed === null && a.note != null,
    "unparsed stays null (not zero)"
  )
}

console.log("\n=== isSuitePassed ===")
assert(
  isSuitePassed({ exitCode: 0, spawnFailed: false, assertionsFailed: 0 }),
  "exit 0 + 0 fails => PASS"
)
assert(
  isSuitePassed({ exitCode: 0, spawnFailed: false, assertionsFailed: null }),
  "exit 0 + unknown counts => PASS"
)
assert(
  !isSuitePassed({ exitCode: 1, spawnFailed: false, assertionsFailed: 0 }),
  "nonzero exit => FAIL"
)
assert(
  !isSuitePassed({ exitCode: null, spawnFailed: true, assertionsFailed: null }),
  "spawn failure => FAIL"
)
assert(
  !isSuitePassed({ exitCode: 0, spawnFailed: false, assertionsFailed: 2 }),
  "exit 0 but parsed fails > 0 => FAIL"
)
assert(
  !isSuitePassed({ exitCode: null, spawnFailed: false, assertionsFailed: 0 }),
  "null exit without spawnFailed still FAIL (not exit 0)"
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
