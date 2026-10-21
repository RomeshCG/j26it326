/**
 * Safe local shadow-mode verification (no enforce, no DB, no Ollama required).
 * Exercises the same resolveA4KnowledgeDomainGate used by handleNlqQuery.
 *
 *   npm run verify:a4-domain-shadow
 */
import { existsSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { performance } from "node:perf_hooks"

import {
  clearA4DomainClfCache,
  loadA4DomainClfArtifact,
  tryPredictA4Domain,
} from "../src/lib/a4-domain-clf.js"
import {
  mlTauAllows,
  resolveA4KnowledgeDomainGate,
  domainGateTelemetry,
} from "../src/lib/a4-domain-gate.js"
import {
  hardRefuseA4Question,
  questionSuggestsA4KnowledgeTopic,
} from "../src/lib/agent-a4-knowledge.js"

const __dir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dir, "..", "..")
const jsonPath = join(
  repoRoot,
  "agents",
  "artifacts",
  "a4_domain",
  "a4-domain-clf-improve-v1-lr_mindf1.json"
)
const outPath = join(
  repoRoot,
  "agents",
  "ml",
  "data",
  "a4_domain",
  "SHADOW_MODE_VERIFY.md"
)

type Expect = "finance" | "off_topic" | "mixed"

type Case = {
  id: string
  text: string
  expect: Expect
  slice: string
}

const CASES: Case[] = [
  // Basic financial education
  { id: "S01", text: "What is money?", expect: "finance", slice: "basic_finance" },
  { id: "S02", text: "What is a loan?", expect: "finance", slice: "basic_finance" },
  { id: "S03", text: "What is interest when someone borrows money from a lender?", expect: "finance", slice: "basic_finance" },
  { id: "S04", text: "What is the basic idea of insurance for unexpected losses?", expect: "finance", slice: "basic_finance" },
  // Natural paraphrases (often Stage-0 miss)
  {
    id: "S05",
    text: "How can a small lender tell whether it's collecting money back successfully?",
    expect: "finance",
    slice: "paraphrase",
  },
  {
    id: "S06",
    text: "What signs suggest that bringing in missed payments is improving versus getting worse?",
    expect: "finance",
    slice: "paraphrase",
  },
  {
    id: "S07",
    text: "Why does a small shop need money readily available to cover everyday expenses?",
    expect: "finance",
    slice: "paraphrase",
  },
  // Banking / microfinance cue-hit
  { id: "S08", text: "What is PAR30 in microfinance?", expect: "finance", slice: "mfi" },
  { id: "S09", text: "Explain operational self-sufficiency (OSS)", expect: "finance", slice: "mfi" },
  { id: "S10", text: "How does joint liability work in village group lending programs?", expect: "finance", slice: "mfi" },
  { id: "S11", text: "What do commercial banks mainly do with deposits from the public?", expect: "finance", slice: "banking" },
  // Unrelated
  { id: "S12", text: "What is the capital city of Portugal?", expect: "off_topic", slice: "geography" },
  { id: "S13", text: "How do airplanes stay in the air?", expect: "off_topic", slice: "aviation" },
  { id: "S14", text: "What is photosynthesis?", expect: "off_topic", slice: "science" },
  { id: "S15", text: "How do you write a for-loop over a list in Python?", expect: "off_topic", slice: "coding" },
  { id: "S16", text: "Who directed the film Titanic?", expect: "off_topic", slice: "unrelated" },
  { id: "S17", text: "Tell me yesterday's temperature in Trincomalee", expect: "off_topic", slice: "unrelated" },
  // Mixed
  {
    id: "S18",
    text: "Explain PAR30 and also tell me our current PAR30",
    expect: "mixed",
    slice: "mixed",
  },
  {
    id: "S19",
    text: "Explain progressive lending, then tell me who won the last Cricket World Cup",
    expect: "mixed",
    slice: "mixed",
  },
  // Stuffing
  {
    id: "S20",
    text: "PAR30 NPL portfolio — which mountain is the tallest on Earth?",
    expect: "off_topic",
    slice: "stuffing",
  },
  {
    id: "S21",
    text: "finance PAR NPL — best pizza recipe?",
    expect: "off_topic",
    slice: "stuffing",
  },
  {
    id: "S22",
    text: "borrower collateral guarantor — share a chicken curry recipe",
    expect: "off_topic",
    slice: "stuffing",
  },
]

function mlDecision(pred: string | null, pFin: number | null, tau: number): boolean {
  return pred === "finance" && (pFin ?? 0) >= tau
}

let failed = 0
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    failed++
    console.error("FAIL:", msg)
  }
}

console.log("=== Shadow mode verification (no enforce / no DB / no Ollama) ===\n")

assert(existsSync(jsonPath), `JSON missing: ${jsonPath}`)
console.log("JSON exists:", jsonPath)

clearA4DomainClfCache()
process.env.A4_DOMAIN_CLF_JSON = jsonPath
process.env.A4_DOMAIN_ML_MODE = "shadow"
process.env.A4_DOMAIN_ML_POLICY = "ml_tau"
process.env.A4_DOMAIN_ML_TAU = "0.45"
// Ensure enforce is not set elsewhere
delete process.env.A4_DOMAIN_ML_ENFORCE

const loadT0 = performance.now()
const art = loadA4DomainClfArtifact(jsonPath)
const loadMs = performance.now() - loadT0
console.log(`Artifact load: ${loadMs.toFixed(2)} ms, spec=${art.spec_id}`)

const warm = tryPredictA4Domain("What is PAR30 in microfinance?", jsonPath)
assert(warm.ok, `predict failed: ${!warm.ok ? warm.error : ""}`)

const envShadow = {
  ...process.env,
  A4_DOMAIN_ML_MODE: "shadow",
  A4_DOMAIN_CLF_JSON: jsonPath,
  A4_DOMAIN_ML_POLICY: "ml_tau",
  A4_DOMAIN_ML_TAU: "0.45",
}
const envOff = {
  ...process.env,
  A4_DOMAIN_ML_MODE: "off",
  A4_DOMAIN_CLF_JSON: jsonPath,
}

type Row = {
  id: string
  slice: string
  text: string
  expect: Expect
  hardRefuse: string | null
  stage0: boolean
  shadowAllow: boolean
  offAllow: boolean
  mlPred: string | null
  pFinance: number | null
  enforceWould: boolean | null
  mlAllowTau: boolean | null
  agreeShadowOff: boolean
  latencyMs: number
  mlError: string | null
}

const rows: Row[] = []
const latencies: number[] = []

for (const c of CASES) {
  const t0 = performance.now()
  const shadow = resolveA4KnowledgeDomainGate(c.text, { env: envShadow as NodeJS.ProcessEnv })
  const elapsed = performance.now() - t0
  latencies.push(elapsed)

  const off = resolveA4KnowledgeDomainGate(c.text, { env: envOff as NodeJS.ProcessEnv })
  const hr = hardRefuseA4Question(c.text)
  const s0 = questionSuggestsA4KnowledgeTopic(c.text)
  const pFin = shadow.ml?.pFinance ?? null
  const pred = shadow.ml?.pred ?? null

  const row: Row = {
    id: c.id,
    slice: c.slice,
    text: c.text,
    expect: c.expect,
    hardRefuse: hr,
    stage0: s0,
    shadowAllow: shadow.allowKnowledge,
    offAllow: off.allowKnowledge,
    mlPred: pred,
    pFinance: pFin,
    enforceWould: shadow.enforceWouldAllow,
    mlAllowTau: pred != null && pFin != null ? mlDecision(pred, pFin, 0.45) : null,
    agreeShadowOff: shadow.allowKnowledge === off.allowKnowledge,
    latencyMs: elapsed,
    mlError: shadow.mlError,
  }
  rows.push(row)

  assert(shadow.mode === "shadow", `${c.id} mode=shadow`)
  assert(shadow.reason === "shadow_stage0", `${c.id} reason=shadow_stage0`)
  assert(shadow.allowKnowledge === s0, `${c.id} allowKnowledge === stage0`)
  assert(shadow.allowKnowledge === off.allowKnowledge, `${c.id} shadow===off allow`)
  assert(shadow.mlError === null, `${c.id} mlError null: ${shadow.mlError}`)
  assert(shadow.ml !== null, `${c.id} ml prediction present`)
  // Telemetry must not include raw question
  const tel = JSON.stringify(domainGateTelemetry(shadow))
  assert(!tel.includes(c.text.slice(0, 20)), `${c.id} telemetry must not echo question`)
}

const sorted = [...latencies].sort((a, b) => a - b)
const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length
const p50 = sorted[Math.floor(sorted.length * 0.5)]
const p95 = sorted[Math.floor(sorted.length * 0.95)]

// Agreement tables (knowledge-eligible path only; hardRefuse would short-circuit earlier in route)
const knowledgePath = rows.filter((r) => r.hardRefuse === null)
let s0Correct = 0
let mlTauCorrect = 0
for (const r of knowledgePath) {
  const goldAllow = r.expect === "finance"
  if (r.stage0 === goldAllow) s0Correct++
  if (r.mlAllowTau === goldAllow) mlTauCorrect++
}

const rescue = knowledgePath.filter(
  (r) => r.expect === "finance" && !r.stage0 && r.mlAllowTau === true
)
const stuffingS0FalseAllow = knowledgePath.filter(
  (r) =>
    (r.expect === "off_topic" || r.expect === "mixed") &&
    r.stage0 &&
    r.mlAllowTau === false
)

console.log("\n--- Results ---")
for (const r of rows) {
  console.log(
    `${r.id} [${r.slice}] s0=${r.stage0} ml=${r.mlPred} pFin=${r.pFinance?.toFixed(3)} ` +
      `shadowAllow=${r.shadowAllow} offAllow=${r.offAllow} enforceWould=${r.enforceWould} ` +
      `expect=${r.expect} hr=${r.hardRefuse} ${r.latencyMs.toFixed(2)}ms`
  )
}

console.log("\n--- Latency (shadow gate incl. predict) ---")
console.log(
  `n=${latencies.length} mean=${mean.toFixed(3)}ms p50=${p50.toFixed(3)}ms p95=${p95.toFixed(3)}ms load=${loadMs.toFixed(2)}ms`
)

console.log("\n--- Shadow noninterference ---")
console.log(
  `shadow===off allow on all ${rows.length} cases: ${rows.every((r) => r.agreeShadowOff)}`
)
console.log(
  `knowledge-path Stage-0 vs gold allow: ${s0Correct}/${knowledgePath.length}`
)
console.log(
  `knowledge-path ml_tau@0.45 vs gold allow: ${mlTauCorrect}/${knowledgePath.length}`
)
console.log(`would-rescue (finance, s0 miss, ml allow): ${rescue.map((r) => r.id).join(", ") || "(none)"}`)
console.log(
  `stuffing/mixed where s0 allows but ml_tau would refuse: ${stuffingS0FalseAllow.map((r) => r.id).join(", ") || "(none)"}`
)

assert(rows.every((r) => r.agreeShadowOff), "all shadow allows match off")
assert(failed === 0, "zero assertion failures required")

const md = [
  "# A4 domain — shadow mode verification",
  "",
  `**Date:** ${new Date().toISOString().slice(0, 10)}`,
  "**Mode tested:** `A4_DOMAIN_ML_MODE=shadow` (enforce not used)",
  "**Scope:** Same `resolveA4KnowledgeDomainGate` as `handleNlqQuery`; no HTTP server, DB, or Ollama.",
  "",
  "## Artifact",
  "",
  `- Path: \`agents/artifacts/a4_domain/a4-domain-clf-improve-v1-lr_mindf1.json\``,
  `- Load: **${loadMs.toFixed(2)} ms**`,
  `- Spec: \`${art.spec_id}\``,
  "",
  "## Noninterference",
  "",
  `- Shadow \`allowKnowledge\` === Stage-0 / mode=off on **${rows.length}/${rows.length}** cases`,
  `- Reason always \`shadow_stage0\``,
  `- Telemetry excludes raw question text`,
  "",
  "## Latency (per question, shadow gate + predict)",
  "",
  `| mean | p50 | p95 |`,
  `|------|-----|-----|`,
  `| ${mean.toFixed(3)} ms | ${p50.toFixed(3)} ms | ${p95.toFixed(3)} ms |`,
  "",
  "## Stage-0 vs ML vs expected (knowledge path; hardRefuse excluded from gold compare)",
  "",
  `| ID | Slice | Expect | Stage-0 | ML pred | pFin | ml_tau@0.45 | Shadow allow (=S0) | Enforce would |`,
  `|----|-------|--------|---------|---------|------|-------------|-------------------|---------------|`,
  ...rows.map(
    (r) =>
      `| ${r.id} | ${r.slice} | ${r.expect} | ${r.stage0} | ${r.mlPred} | ${r.pFinance?.toFixed(3) ?? "—"} | ${r.mlAllowTau} | ${r.shadowAllow} | ${r.enforceWould} |`
  ),
  "",
  `Rescues if enforce: ${rescue.map((r) => r.id).join(", ") || "none"}`,
  `S0 false-allows ML would block: ${stuffingS0FalseAllow.map((r) => r.id).join(", ") || "none"}`,
  "",
  "## Verdict",
  "",
  failed === 0
    ? "**GO** for continued shadow observation / next-phase planning. **NO-GO** for enablement of `enforce` without separate approval."
    : "**NO-GO** — shadow verification failures (see console).",
  "",
].join("\n")

writeFileSync(outPath, md, "utf8")
console.log(`\nWrote ${outPath}`)
console.log(failed === 0 ? "\nSHADOW VERIFY PASS" : "\nSHADOW VERIFY FAIL")
process.exit(failed > 0 ? 1 : 0)
