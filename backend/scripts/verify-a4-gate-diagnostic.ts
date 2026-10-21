/**
 * A4 Slice 4C — offline lexical-gate diagnostic on frozen gold corpus.
 *
 * Run: npm run verify:a4-gate-diagnostic
 *
 * Uses questionSupportsIntent only. No Ollama. No gold relabeling.
 * Writes gitignored JSON under backend/eval-results/.
 *
 * Gate eligibility ≠ live LLM classification accuracy.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import {
  A4_NLQ_PROMPT_VERSION,
  questionSupportsIntent,
  type NlqSupportedIntent,
} from "../src/lib/agent-a4-nlq.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, "..")
const packPath = path.join(
  backendRoot,
  "eval-fixtures/a4/a4-intent-gold.v1.json"
)
const outDir = path.join(backendRoot, "eval-results")

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
  probesLexicalGateLimitation: boolean
}

type Pack = {
  specId: string
  promptVersionUnderStudy: string
  fixturePackVersion?: string
  fixtures: Fixture[]
}

type Row = {
  id: string
  category: string
  semanticIntent: string
  paramsValid: boolean
  probesLexicalGateLimitation: boolean
  gatePending: boolean
  gateWindow: boolean
  gateForSemanticIntent: boolean | null
}

function gitSha(): string | null {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: backendRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return null
  }
}

function rate(num: number, den: number): {
  numerator: number
  denominator: number
  rate: number | null
} {
  return {
    numerator: num,
    denominator: den,
    rate: den === 0 ? null : num / den,
  }
}

function main(): void {
  const pack = JSON.parse(fs.readFileSync(packPath, "utf8")) as Pack
  const fixtures = pack.fixtures

  console.log("\n=== A4 lexical-gate diagnostic (offline; not LLM accuracy) ===")
  console.log(`Gold pack: ${pack.specId} v${pack.fixturePackVersion ?? "?"}`)
  console.log(`Prompt under study: ${pack.promptVersionUnderStudy}`)
  console.log(`Code A4_NLQ_PROMPT_VERSION: ${A4_NLQ_PROMPT_VERSION}`)
  console.log(`Questions: ${fixtures.length}`)
  console.log(
    "Disclaimer: questionSupportsIntent eligibility only — not Ollama intent accuracy.\n"
  )

  if (pack.promptVersionUnderStudy !== A4_NLQ_PROMPT_VERSION) {
    console.error("FAIL: prompt version mismatch")
    process.exit(1)
  }

  const rows: Row[] = []
  for (const f of fixtures) {
    const gatePending = questionSupportsIntent(f.question, "count_pending_tier3")
    const gateWindow = questionSupportsIntent(f.question, "count_actions_window")
    let gateForSemanticIntent: boolean | null = null
    if (
      f.expect.intent === "count_pending_tier3" ||
      f.expect.intent === "count_actions_window"
    ) {
      gateForSemanticIntent = questionSupportsIntent(
        f.question,
        f.expect.intent as NlqSupportedIntent["intent"]
      )
    }
    rows.push({
      id: f.id,
      category: f.category,
      semanticIntent: f.expect.intent,
      paramsValid: f.expect.paramsValid,
      probesLexicalGateLimitation: f.probesLexicalGateLimitation,
      gatePending,
      gateWindow,
      gateForSemanticIntent,
    })
  }

  // --- Supported with valid params (ordinary + probes) ---
  const supportedValid = rows.filter(
    (r) =>
      (r.semanticIntent === "count_pending_tier3" ||
        r.semanticIntent === "count_actions_window") &&
      r.paramsValid
  )
  const ordinarySupported = supportedValid.filter(
    (r) => !r.probesLexicalGateLimitation
  )
  const probes = supportedValid.filter((r) => r.probesLexicalGateLimitation)

  const ordinaryAccepted = ordinarySupported.filter(
    (r) => r.gateForSemanticIntent === true
  )
  const ordinaryRejected = ordinarySupported.filter(
    (r) => r.gateForSemanticIntent === false
  )
  const probesRejected = probes.filter((r) => r.gateForSemanticIntent === false)
  const probesAccepted = probes.filter((r) => r.gateForSemanticIntent === true)

  // All supported+valid (including known FN probes) — do not silently drop probes
  const allSupportedAccepted = supportedValid.filter(
    (r) => r.gateForSemanticIntent === true
  )
  const allSupportedRejected = supportedValid.filter(
    (r) => r.gateForSemanticIntent === false
  )

  // --- Invalid params (semantic window, paramsValid false) — separate ---
  const invalidParams = rows.filter(
    (r) =>
      r.semanticIntent === "count_actions_window" && r.paramsValid === false
  )
  const invalidParamsGatePass = invalidParams.filter(
    (r) => r.gateForSemanticIntent === true
  )

  // --- Unsupported: overfire eligibility if model returned each intent ---
  // Challenge: OR("either") is a conservative worst-case bound, not observed FP.
  // Operational path only checks the intent the model actually emitted.
  const unsupported = rows.filter((r) => r.semanticIntent === "unsupported")
  const unsupPendingPass = unsupported.filter((r) => r.gatePending)
  const unsupWindowPass = unsupported.filter((r) => r.gateWindow)
  const unsupEitherPass = unsupported.filter(
    (r) => r.gatePending || r.gateWindow
  )

  const byCategory: Record<
    string,
    { n: number; semanticSupportedValid: number; gateAcceptForSemantic: number }
  > = {}
  for (const r of rows) {
    if (!byCategory[r.category]) {
      byCategory[r.category] = {
        n: 0,
        semanticSupportedValid: 0,
        gateAcceptForSemantic: 0,
      }
    }
    byCategory[r.category].n++
    if (
      (r.semanticIntent === "count_pending_tier3" ||
        r.semanticIntent === "count_actions_window") &&
      r.paramsValid
    ) {
      byCategory[r.category].semanticSupportedValid++
      if (r.gateForSemanticIntent) {
        byCategory[r.category].gateAcceptForSemantic++
      }
    }
  }

  const report = {
    schemaVersion: 1,
    reportKind: "a4_lexical_gate_diagnostic_v1",
    disclaimer:
      "Offline questionSupportsIntent eligibility on frozen gold questions. " +
      "NOT live Ollama / resolveNlqIntentFromModel classification accuracy. " +
      "A gate pass does not imply the model would emit that intent.",
    generatedAtUtc: new Date().toISOString(),
    gitSha: gitSha(),
    promptVersion: A4_NLQ_PROMPT_VERSION,
    gold: {
      specId: pack.specId,
      fixturePackVersion: pack.fixturePackVersion ?? null,
      nQuestions: fixtures.length,
    },
    cohorts: {
      supportedParamsValid: {
        n: supportedValid.length,
        acceptedBySemanticGate: rate(
          allSupportedAccepted.length,
          supportedValid.length
        ),
        rejectedBySemanticGate: rate(
          allSupportedRejected.length,
          supportedValid.length
        ),
        note: "Includes known gate-limitation probes (not dropped).",
      },
      ordinarySupportedParamsValid: {
        n: ordinarySupported.length,
        accepted: rate(ordinaryAccepted.length, ordinarySupported.length),
        rejectedFalseNegatives: rate(
          ordinaryRejected.length,
          ordinarySupported.length
        ),
        rejectedIds: ordinaryRejected.map((r) => r.id),
      },
      gateLimitationProbes: {
        n: probes.length,
        expectedReject: true,
        rejectedAsExpected: rate(probesRejected.length, probes.length),
        unexpectedlyAccepted: rate(probesAccepted.length, probes.length),
        ids: probes.map((r) => ({
          id: r.id,
          category: r.category,
          semanticIntent: r.semanticIntent,
          gateForSemanticIntent: r.gateForSemanticIntent,
        })),
      },
      invalidParams: {
        n: invalidParams.length,
        note: "Semantic count_actions_window with paramsValid=false; reported separately from ordinary supported acceptance.",
        gateAcceptForSemanticWindow: rate(
          invalidParamsGatePass.length,
          invalidParams.length
        ),
        ids: invalidParams.map((r) => ({
          id: r.id,
          gateWindow: r.gateWindow,
        })),
      },
      unsupported: {
        n: unsupported.length,
        note:
          "Per-intent rates = fraction that would pass that intent's gate if the model over-fired with it. " +
          "'either' is a worst-case bound (max eligibility), not live false-accept rate.",
        wouldPassPendingGate: rate(unsupPendingPass.length, unsupported.length),
        wouldPassWindowGate: rate(unsupWindowPass.length, unsupported.length),
        wouldPassEitherGateWorstCase: rate(
          unsupEitherPass.length,
          unsupported.length
        ),
        pendingPassIds: unsupPendingPass.map((r) => r.id),
        windowPassIds: unsupWindowPass.map((r) => r.id),
        eitherPassIds: unsupEitherPass.map((r) => r.id),
      },
    },
    byCategory,
    rows,
  }

  fs.mkdirSync(outDir, { recursive: true })
  const stamp = report.generatedAtUtc.replace(/[:.]/g, "-")
  const latest = path.join(outDir, "a4-gate-diagnostic-latest.json")
  const stamped = path.join(outDir, `a4-gate-diagnostic-${stamp}.json`)
  const body = JSON.stringify(report, null, 2)
  fs.writeFileSync(latest, body, "utf8")
  fs.writeFileSync(stamped, body, "utf8")

  const fmt = (r: { numerator: number; denominator: number; rate: number | null }) =>
    r.denominator === 0
      ? "n/a"
      : `${r.numerator}/${r.denominator}` +
        (r.rate == null ? "" : ` (${(r.rate * 100).toFixed(1)}%)`)

  console.log("=== Supported (paramsValid=true), including probes ===")
  console.log(
    `  Accept semantic gate: ${fmt(report.cohorts.supportedParamsValid.acceptedBySemanticGate)}`
  )
  console.log(
    `  Reject (FN incl. probes): ${fmt(report.cohorts.supportedParamsValid.rejectedBySemanticGate)}`
  )
  console.log("\n=== Ordinary supported (excludes probe flag) ===")
  console.log(
    `  Accept: ${fmt(report.cohorts.ordinarySupportedParamsValid.accepted)}`
  )
  console.log(
    `  Unexpected FN: ${fmt(report.cohorts.ordinarySupportedParamsValid.rejectedFalseNegatives)}`
  )
  console.log("\n=== Gate-limitation probes (expected reject) ===")
  console.log(
    `  Rejected as expected: ${fmt(report.cohorts.gateLimitationProbes.rejectedAsExpected)}`
  )
  for (const p of report.cohorts.gateLimitationProbes.ids) {
    console.log(
      `    ${p.id} intent=${p.semanticIntent} gate=${p.gateForSemanticIntent}`
    )
  }
  console.log("\n=== Invalid params (separate) ===")
  console.log(
    `  Window gate accept: ${fmt(report.cohorts.invalidParams.gateAcceptForSemanticWindow)}`
  )
  console.log("\n=== Unsupported overfire eligibility (not live FP) ===")
  console.log(
    `  Pending gate true: ${fmt(report.cohorts.unsupported.wouldPassPendingGate)}`
  )
  console.log(
    `  Window gate true:  ${fmt(report.cohorts.unsupported.wouldPassWindowGate)}`
  )
  console.log(
    `  Either (worst-case): ${fmt(report.cohorts.unsupported.wouldPassEitherGateWorstCase)}`
  )

  console.log(`\nWrote ${latest}`)
  console.log(`Wrote ${stamped}`)
  console.log("\n0 failed (diagnostic complete; FN probes are expected findings)")
  process.exit(0)
}

main()
