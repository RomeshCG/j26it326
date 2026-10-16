/**
 * A4 Slice 4B — gold corpus structure / SPEC consistency validator.
 *
 * Run: npm run verify:a4-intent-corpus
 *
 * Does NOT call Ollama. Does NOT score intent accuracy.
 * May call questionSupportsIntent only to verify gate-probe annotations.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  A4_KNOWN_AGENT_IDS,
  A4_NLQ_DAYS_DEFAULT,
  A4_NLQ_DAYS_MAX,
  A4_NLQ_DAYS_MIN,
  A4_NLQ_PROMPT_VERSION,
  questionSupportsIntent,
  type NlqSupportedIntent,
} from "../src/lib/agent-a4-nlq.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packPath = path.join(
  __dirname,
  "../eval-fixtures/a4/a4-intent-gold.v1.json"
)

export const ALLOWED_CATEGORIES = [
  "pending_clear",
  "pending_paraphrase",
  "window_clear",
  "window_default_days",
  "window_paraphrase",
  "unsupported_chitchat",
  "unsupported_topic",
  "ambiguous",
  "invalid_params",
  "adversarial",
  "gate_limitation",
] as const

export const ALLOWED_INTENTS = [
  "count_pending_tier3",
  "count_actions_window",
  "unsupported",
] as const

/** Exact few-shots from buildNlqIntentSystemPrompt — must not appear verbatim. */
export const FORBIDDEN_PROMPT_EXAMPLE_QUESTIONS = [
  "Hello",
  "Hi there",
  "What is PAR30?",
  "How many Tier 3 actions are awaiting approval?",
  "How many A3 actions were recorded in the last 7 days?",
] as const

type Expect = {
  intent: string
  days?: number | null
  agentId?: string | null
  paramsValid: boolean
}

type Fixture = {
  id: string
  category: string
  question: string
  expect: Expect
  oracleRef: string
  justification: string
  probesLexicalGateLimitation: boolean
}

type Pack = {
  specId: string
  promptVersionUnderStudy: string
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

export function parseIntentLabel(
  intent: unknown
): { ok: true; value: (typeof ALLOWED_INTENTS)[number] } | { ok: false; error: string } {
  if (typeof intent !== "string") {
    return { ok: false, error: "intent must be a string" }
  }
  if ((ALLOWED_INTENTS as readonly string[]).includes(intent)) {
    return { ok: true, value: intent as (typeof ALLOWED_INTENTS)[number] }
  }
  return { ok: false, error: `unknown intent "${intent}"` }
}

/** SPEC C1.2 — days in range when provided for a valid window. */
export function daysInAllowedRange(days: number): boolean {
  return (
    Number.isInteger(days) &&
    days >= A4_NLQ_DAYS_MIN &&
    days <= A4_NLQ_DAYS_MAX
  )
}

function validateExpectShape(f: Fixture): string | null {
  const intent = parseIntentLabel(f.expect.intent)
  if (!intent.ok) return intent.error

  if (typeof f.expect.paramsValid !== "boolean") {
    return "paramsValid must be boolean"
  }

  if (intent.value === "count_pending_tier3") {
    if (f.expect.days !== undefined && f.expect.days !== null) {
      return "count_pending_tier3 must not set days"
    }
    if (f.expect.agentId !== undefined && f.expect.agentId !== null) {
      return "count_pending_tier3 must not set agentId"
    }
    if (!f.expect.paramsValid) {
      return "count_pending_tier3 should have paramsValid true"
    }
    return null
  }

  if (intent.value === "unsupported") {
    if (f.probesLexicalGateLimitation) {
      return "unsupported items must not set probesLexicalGateLimitation"
    }
    return null
  }

  // count_actions_window
  if (!("days" in f.expect)) {
    return "count_actions_window requires days (use 7 for default)"
  }
  if (f.expect.days === null || f.expect.days === undefined) {
    return "count_actions_window days must be a number (default 7 when omitted in question)"
  }
  if (typeof f.expect.days !== "number" || !Number.isInteger(f.expect.days)) {
    return "days must be an integer"
  }
  if (f.expect.agentId !== null && f.expect.agentId !== undefined) {
    if (typeof f.expect.agentId !== "string") {
      return "agentId must be string or null"
    }
    if (!A4_KNOWN_AGENT_IDS.has(f.expect.agentId) && f.expect.paramsValid) {
      return "paramsValid true requires agentId in A1–A4 or null"
    }
  }

  const daysOk = daysInAllowedRange(f.expect.days)
  const agentOk =
    f.expect.agentId === null ||
    f.expect.agentId === undefined ||
    A4_KNOWN_AGENT_IDS.has(String(f.expect.agentId))

  if (f.expect.paramsValid) {
    if (!daysOk) return "paramsValid true but days out of 1–30"
    if (!agentOk) return "paramsValid true but agentId invalid"
  } else {
    if (daysOk && agentOk) {
      return "paramsValid false but days and agentId both legal — mark paramsValid true or fix params"
    }
  }
  return null
}

function main(): void {
  const raw = fs.readFileSync(packPath, "utf8")
  const pack = JSON.parse(raw) as Pack

  console.log("\n=== A4 intent gold corpus (structure / SPEC consistency) ===")
  console.log(`Spec: ${pack.specId}`)
  console.log(`Prompt under study: ${pack.promptVersionUnderStudy}`)
  console.log(`Code A4_NLQ_PROMPT_VERSION: ${A4_NLQ_PROMPT_VERSION}`)
  console.log(`Fixtures: ${pack.fixtures.length}`)
  console.log(
    "Disclaimer: validator pass ≠ Ollama intent accuracy.\n"
  )

  assert(
    pack.promptVersionUnderStudy === A4_NLQ_PROMPT_VERSION,
    "pack promptVersionUnderStudy matches A4_NLQ_PROMPT_VERSION"
  )
  assert(
    pack.fixtures.length >= 32 && pack.fixtures.length <= 40,
    `fixture count in 32–40 (got ${pack.fixtures.length})`
  )

  const ids = new Set<string>()
  const byCategory: Record<string, number> = {}
  const byIntent: Record<string, number> = {}
  let gateProbes = 0
  let supportedGateOk = 0
  let supportedGateExpectedPass = 0

  for (const f of pack.fixtures) {
    if (ids.has(f.id)) {
      assert(false, `${f.id} unique`, "duplicate id")
      continue
    }
    ids.add(f.id)
    assert(/^A4-G\d{2}$/.test(f.id), `${f.id} id format`)

    if (!(ALLOWED_CATEGORIES as readonly string[]).includes(f.category)) {
      assert(false, `${f.id} category`, f.category)
      continue
    }
    assert(true, `${f.id} category=${f.category}`)
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1

    if (typeof f.question !== "string" || f.question.trim().length < 3) {
      assert(false, `${f.id} question`, "missing/short")
      continue
    }
    assert(
      !FORBIDDEN_PROMPT_EXAMPLE_QUESTIONS.includes(
        f.question as (typeof FORBIDDEN_PROMPT_EXAMPLE_QUESTIONS)[number]
      ),
      `${f.id} not exact prompt few-shot`
    )

    if (typeof f.justification !== "string" || f.justification.length < 8) {
      assert(false, `${f.id} justification`)
      continue
    }
    if (typeof f.oracleRef !== "string" || !f.oracleRef.includes("SPEC")) {
      assert(false, `${f.id} oracleRef`)
      continue
    }
    if (typeof f.probesLexicalGateLimitation !== "boolean") {
      assert(false, `${f.id} probesLexicalGateLimitation type`)
      continue
    }

    const shapeErr = validateExpectShape(f)
    if (shapeErr) {
      assert(false, `${f.id} expect shape`, shapeErr)
      continue
    }
    assert(true, `${f.id} expect shape`)

    const intent = f.expect.intent
    byIntent[intent] = (byIntent[intent] ?? 0) + 1

    if (f.category === "gate_limitation") {
      assert(
        f.probesLexicalGateLimitation === true,
        `${f.id} gate_limitation category requires probe flag`
      )
    }
    if (f.category === "invalid_params") {
      assert(
        f.expect.paramsValid === false,
        `${f.id} invalid_params requires paramsValid false`
      )
      assert(
        f.expect.intent === "count_actions_window",
        `${f.id} invalid_params keep semantic window intent`
      )
    }

    // Gate annotation checks (not accuracy)
    if (
      f.expect.intent === "count_pending_tier3" ||
      f.expect.intent === "count_actions_window"
    ) {
      if (f.expect.paramsValid) {
        const gateOk = questionSupportsIntent(
          f.question,
          f.expect.intent as NlqSupportedIntent["intent"]
        )
        if (f.probesLexicalGateLimitation) {
          gateProbes++
          assert(
            !gateOk,
            `${f.id} probe expects gate reject`,
            gateOk ? "gate unexpectedly passed" : undefined
          )
        } else {
          supportedGateExpectedPass++
          if (gateOk) supportedGateOk++
          assert(
            gateOk,
            `${f.id} non-probe supported expects gate pass`,
            !gateOk
              ? "gate rejected — mark probesLexicalGateLimitation or reword"
              : undefined
          )
        }
      }
    }
  }

  assert(ids.size === pack.fixtures.length, "all ids unique")

  // Balance: avoid unsupported-heavy pack (challenge Agent1)
  const unsupportedN = byIntent["unsupported"] ?? 0
  const supportedN =
    (byIntent["count_pending_tier3"] ?? 0) +
    (byIntent["count_actions_window"] ?? 0)
  assert(
    unsupportedN <= supportedN,
    `unsupported (${unsupportedN}) ≤ supported (${supportedN}) — avoid rejection inflation`
  )
  assert(gateProbes >= 2, `at least 2 gate probes (got ${gateProbes})`)
  assert(
    (byIntent["count_pending_tier3"] ?? 0) >= 5,
    "enough pending gold items"
  )
  assert(
    (byIntent["count_actions_window"] ?? 0) >= 8,
    "enough window gold items"
  )

  console.log("\n=== Counts by category ===")
  for (const c of Object.keys(byCategory).sort()) {
    console.log(`  ${c}: ${byCategory[c]}`)
  }
  console.log("\n=== Counts by expect.intent ===")
  for (const i of Object.keys(byIntent).sort()) {
    console.log(`  ${i}: ${byIntent[i]}`)
  }
  console.log(
    `\nGate annotation checks: probes=${gateProbes}; non-probe supported gate-pass ${supportedGateOk}/${supportedGateExpectedPass}`
  )
  console.log(`Default days constant: ${A4_NLQ_DAYS_DEFAULT}`)

  console.log(`\n${passed} passed, ${failed} failed`)
  console.log(
    "(Corpus validation only — not live intent classification accuracy.)"
  )
  process.exit(failed === 0 ? 0 : 1)
}

const isDirectRun =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main()
}
