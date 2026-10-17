/**
 * A2 Slice 2B — labelled threshold / validation fixtures (rule agreement).
 *
 * Oracle: backend/eval-fixtures/a2/SPEC.md (a2-budget-threshold-oracle-v1)
 * Run: npm run verify:a2-fixtures
 *
 * Not ML accuracy. Not live M2 monitoring effectiveness.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  evaluateBudgetThreshold,
  validateBudgetThresholdInput,
} from "../src/lib/agent-a2-budget.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packPath = path.join(
  __dirname,
  "../eval-fixtures/a2/a2-threshold-fixtures.v1.json"
)

export const ALLOWED_CATEGORIES = [
  "threshold_decision",
  "input_rejection",
] as const

export type FixtureCategory = (typeof ALLOWED_CATEGORIES)[number]

export const ALLOWED_METRIC_VALUE_OVERRIDES = [
  "NaN",
  "Infinity",
  "-Infinity",
] as const

export type MetricValueOverride = (typeof ALLOWED_METRIC_VALUE_OVERRIDES)[number]

type Expect = {
  validateOk: boolean
  breached?: boolean
}

type Fixture = {
  id: string
  category: string
  description: string
  oracleRef: string
  duplicateOfVerify?: boolean
  input: Record<string, unknown>
  expect: Expect
  runtimeOverrides?: Record<string, unknown>
}

type Pack = {
  specId: string
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

/** Fail closed: only known category strings. */
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

/**
 * Fail closed: only key `metricValue` with whitelist NaN/Infinity/-Infinity.
 * No dynamic code execution.
 */
export function applyRuntimeOverrides(
  input: Record<string, unknown>,
  overrides: unknown
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (overrides === undefined || overrides === null) {
    return { ok: true, value: { ...input } }
  }
  if (typeof overrides !== "object" || Array.isArray(overrides)) {
    return { ok: false, error: "runtimeOverrides must be a plain object when present" }
  }
  const o = overrides as Record<string, unknown>
  const keys = Object.keys(o)
  for (const key of keys) {
    if (key !== "metricValue") {
      return {
        ok: false,
        error: `unknown runtimeOverrides key "${key}" (only metricValue is allowed)`,
      }
    }
  }
  const out = { ...input }
  if (!("metricValue" in o)) {
    return { ok: true, value: out }
  }
  const ov = o.metricValue
  if (ov === "NaN") {
    out.metricValue = Number.NaN
  } else if (ov === "Infinity") {
    out.metricValue = Number.POSITIVE_INFINITY
  } else if (ov === "-Infinity") {
    out.metricValue = Number.NEGATIVE_INFINITY
  } else {
    return {
      ok: false,
      error: `unknown runtimeOverrides.metricValue ${JSON.stringify(ov)} (allowed: NaN, Infinity, -Infinity)`,
    }
  }
  return { ok: true, value: out }
}

/** Independent oracle for valid bodies (SPEC R1) — not copied from evaluateBudgetThreshold. */
export function oracleBreached(metricValue: number, threshold: number): boolean {
  return metricValue >= threshold
}

function materializeInput(
  f: Fixture
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const input = { ...f.input }
  delete input._note
  return applyRuntimeOverrides(input, f.runtimeOverrides)
}

function main(): void {
  const raw = fs.readFileSync(packPath, "utf8")
  const pack = JSON.parse(raw) as Pack

  console.log("\n=== A2 fixture pack (rule agreement) ===")
  console.log(`Spec: ${pack.specId}`)
  console.log(`Fixtures: ${pack.fixtures.length}`)
  console.log(
    "Disclaimer: agreement rates measure deterministic rule match, not ML accuracy.\n"
  )

  let decisionTotal = 0
  let decisionOk = 0
  let rejectTotal = 0
  let rejectOk = 0
  const mismatches: string[] = []

  for (const f of pack.fixtures) {
    const cat = parseFixtureCategory(f.category)
    if (!cat.ok) {
      mismatches.push(`${f.id}: ${cat.error}`)
      assert(false, `${f.id} category`, cat.error)
      continue
    }

    const materialized = materializeInput(f)
    if (!materialized.ok) {
      mismatches.push(`${f.id}: ${materialized.error}`)
      assert(false, `${f.id} runtimeOverrides`, materialized.error)
      continue
    }

    const body = materialized.value
    const validated = validateBudgetThresholdInput(body)

    if (cat.value === "input_rejection") {
      rejectTotal++
      const ok = validated.ok === false && f.expect.validateOk === false
      if (ok) {
        rejectOk++
        assert(true, `${f.id} reject (${f.description})`)
      } else {
        mismatches.push(
          `${f.id}: expected validateOk=false, got ok=${validated.ok}`
        )
        assert(
          false,
          `${f.id} reject (${f.description})`,
          `got ok=${validated.ok}`
        )
      }
      continue
    }

    // threshold_decision
    decisionTotal++
    if (!validated.ok) {
      mismatches.push(`${f.id}: expected validate ok, got error`)
      assert(false, `${f.id} decision (${f.description})`, "validate failed")
      continue
    }

    const value = validated.value
    const expectedBreach =
      f.expect.breached ?? oracleBreached(value.metricValue, value.threshold)
    const r1 = oracleBreached(value.metricValue, value.threshold)
    if (f.expect.breached !== undefined && f.expect.breached !== r1) {
      mismatches.push(
        `${f.id}: fixture expect.breached=${f.expect.breached} disagrees with SPEC R1 (${r1})`
      )
      assert(
        false,
        `${f.id} oracle consistency`,
        "fixture label ≠ SPEC R1 — do not silently retarget"
      )
      continue
    }

    const evaluation = evaluateBudgetThreshold(value)
    const agree =
      validated.ok === true &&
      f.expect.validateOk === true &&
      evaluation.breached === expectedBreach &&
      evaluation.rule === "metricValue >= threshold"

    if (agree) {
      decisionOk++
      assert(
        true,
        `${f.id} decision breached=${evaluation.breached} (${f.description})`
      )
    } else {
      mismatches.push(
        `${f.id}: expected breached=${expectedBreach}, got ${evaluation.breached}`
      )
      assert(
        false,
        `${f.id} decision (${f.description})`,
        `expected breached=${expectedBreach}, got ${evaluation.breached}`
      )
    }
  }

  const decisionRate =
    decisionTotal === 0 ? null : decisionOk / decisionTotal
  const rejectRate = rejectTotal === 0 ? null : rejectOk / rejectTotal

  console.log("\n=== Agreement (not ML accuracy) ===")
  console.log(
    `  Valid threshold decisions: ${decisionOk}/${decisionTotal}` +
      (decisionRate != null ? ` (${(decisionRate * 100).toFixed(1)}%)` : "")
  )
  console.log(
    `  Invalid-input rejections:  ${rejectOk}/${rejectTotal}` +
      (rejectRate != null ? ` (${(rejectRate * 100).toFixed(1)}%)` : "")
  )

  if (mismatches.length > 0) {
    console.log("\n=== Mismatches vs oracle / implementation ===")
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
