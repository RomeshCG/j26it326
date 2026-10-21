/**
 * A1 Slice 2C — labelled readiness fixtures (rule agreement).
 *
 * Oracle: backend/eval-fixtures/a1/SPEC.md (a1-readiness-oracle-v1)
 * Run: npm run verify:a1-fixtures
 *
 * Not official CBSL compliance accuracy. Synthetic facts only (no Prisma).
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  A1_RULESET_VERSION,
  analyzeA1Readiness,
  type A1GapSeverity,
  type A1OverallStatus,
  type A1ReadinessFacts,
} from "../src/lib/agent-a1-compliance.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packPath = path.join(
  __dirname,
  "../eval-fixtures/a1/a1-readiness-fixtures.v1.json"
)

export const ALLOWED_CATEGORIES = ["readiness_analysis"] as const
export type FixtureCategory = (typeof ALLOWED_CATEGORIES)[number]

type GapExpect = { code: string; severity: A1GapSeverity }

type Fixture = {
  id: string
  category: string
  description: string
  oracleRef: string
  duplicateOfVerify?: boolean
  facts: A1ReadinessFacts
  expect: {
    overallStatus: A1OverallStatus
    dataGaps: GapExpect[]
  }
}

type Pack = {
  specId: string
  rulesetVersion: string
  fixtures: Fixture[]
}

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

export function parseFixtureCategory(
  category: unknown
): { ok: true; value: FixtureCategory } | { ok: false; error: string } {
  if (typeof category !== "string") {
    return { ok: false, error: "category must be a string" }
  }
  if ((ALLOWED_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: true, value: category as FixtureCategory }
  }
  return {
    ok: false,
    error: `unknown category "${category}" (allowed: ${ALLOWED_CATEGORIES.join(", ")})`,
  }
}

/** SPEC S0 — derive status from expected gap severities (independent of analyzeA1Readiness). */
export function statusFromExpectedGaps(
  dataGaps: GapExpect[],
  inferredWarningCount = 0
): A1OverallStatus {
  const blocking = dataGaps.filter((g) => g.severity === "blocking").length
  const warnings =
    dataGaps.filter((g) => g.severity === "warning").length + inferredWarningCount
  if (blocking > 0) return "not_ready"
  if (warnings > 0) return "ready_with_warnings"
  return "evidence_complete_for_scoped_checks"
}

function gapKey(g: GapExpect): string {
  return `${g.code}|${g.severity}`
}

function sameGapSet(actual: GapExpect[], expected: GapExpect[]): boolean {
  if (actual.length !== expected.length) return false
  const a = actual.map(gapKey).sort()
  const e = expected.map(gapKey).sort()
  return a.every((v, i) => v === e[i])
}

function main(): void {
  const raw = fs.readFileSync(packPath, "utf8")
  const pack = JSON.parse(raw) as Pack

  console.log("\n=== A1 fixture pack (rule agreement) ===")
  console.log(`Spec: ${pack.specId}`)
  console.log(`Pack rulesetVersion: ${pack.rulesetVersion}`)
  console.log(`Code A1_RULESET_VERSION: ${A1_RULESET_VERSION}`)
  console.log(`Fixtures: ${pack.fixtures.length}`)
  console.log(
    "Disclaimer: not CBSL regulatory accuracy; synthetic facts only.\n"
  )

  assert(
    pack.rulesetVersion === A1_RULESET_VERSION,
    "fixture pack rulesetVersion matches A1_RULESET_VERSION"
  )

  let statusTotal = 0
  let statusOk = 0
  let gapTotal = 0
  let gapOk = 0
  const mismatches: string[] = []

  for (const f of pack.fixtures) {
    const cat = parseFixtureCategory(f.category)
    if (!cat.ok) {
      mismatches.push(`${f.id}: ${cat.error}`)
      assert(false, `${f.id} category`, cat.error)
      continue
    }

    const s0 = statusFromExpectedGaps(f.expect.dataGaps)
    if (s0 !== f.expect.overallStatus) {
      mismatches.push(
        `${f.id}: expect.overallStatus=${f.expect.overallStatus} disagrees with SPEC S0 (${s0})`
      )
      assert(
        false,
        `${f.id} S0 consistency`,
        "fixture status ≠ status implied by gap severities"
      )
      continue
    }

    const analysis = analyzeA1Readiness(f.facts)
    const actualGaps: GapExpect[] = analysis.dataGaps.map((g) => ({
      code: g.code,
      severity: g.severity,
    }))

    statusTotal++
    const statusAgree = analysis.overallStatus === f.expect.overallStatus
    if (statusAgree) {
      statusOk++
      assert(true, `${f.id} status=${analysis.overallStatus}`)
    } else {
      mismatches.push(
        `${f.id}: status expected ${f.expect.overallStatus}, got ${analysis.overallStatus}`
      )
      assert(
        false,
        `${f.id} status`,
        `expected ${f.expect.overallStatus}, got ${analysis.overallStatus}`
      )
    }

    gapTotal++
    const gapsAgree = sameGapSet(actualGaps, f.expect.dataGaps)
    if (gapsAgree) {
      gapOk++
      assert(
        true,
        `${f.id} gap-set (${f.expect.dataGaps.length} codes) — ${f.description}`
      )
    } else {
      mismatches.push(
        `${f.id}: gaps expected [${f.expect.dataGaps.map(gapKey).sort().join(", ")}], got [${actualGaps.map(gapKey).sort().join(", ")}]`
      )
      assert(false, `${f.id} gap-set`, "set mismatch")
    }
  }

  const statusRate = statusTotal === 0 ? null : statusOk / statusTotal
  const gapRate = gapTotal === 0 ? null : gapOk / gapTotal

  console.log("\n=== Agreement (not CBSL / not ML accuracy) ===")
  console.log(
    `  Status agreement:  ${statusOk}/${statusTotal}` +
      (statusRate != null ? ` (${(statusRate * 100).toFixed(1)}%)` : "")
  )
  console.log(
    `  Gap-set agreement: ${gapOk}/${gapTotal}` +
      (gapRate != null ? ` (${(gapRate * 100).toFixed(1)}%)` : "")
  )

  if (mismatches.length > 0) {
    console.log("\n=== Mismatches ===")
    for (const m of mismatches) console.log(`  - ${m}`)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

const isDirectRun =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main()
}
