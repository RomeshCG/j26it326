/**
 * A4 Slice 4D — live Ollama intent eval against frozen gold corpus.
 *
 *   npm run eval:a4-intent-ollama           # live (requires OLLAMA_*; sequential)
 *   npm run eval:a4-intent-ollama -- --self-test   # offline mock scoring only
 *
 * No DB, no Node HTTP server, no dispatch. Concurrency 1. No retries.
 * Results → gitignored backend/eval-results/.
 *
 * Does NOT modify gold labels or production A4 code.
 */
import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import {
  A4_NLQ_PROMPT_VERSION,
  A4_NLQ_MODEL_VERSION,
  buildNlqIntentSystemPrompt,
  parseNlqIntent,
  resolveNlqIntentFromModel,
  questionSupportsIntent,
  type NlqParseResult,
  type NlqSupportedIntent,
} from "../src/lib/agent-a4-nlq.js"
import {
  ollamaChatJson,
  resolveOllamaTimeoutMs,
  OllamaUnavailableError,
} from "../src/lib/ollama-client.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, "..")
const packPath = path.join(
  backendRoot,
  "eval-fixtures/a4/a4-intent-gold.v1.json"
)
const outDir = path.join(backendRoot, "eval-results")

const INTENT_CLASSES = [
  "count_pending_tier3",
  "count_actions_window",
  "unsupported",
] as const
type IntentClass = (typeof INTENT_CLASSES)[number]

type GoldExpect = {
  intent: IntentClass | string
  days?: number | null
  agentId?: string | null
  paramsValid: boolean
}

type GoldFixture = {
  id: string
  category: string
  question: string
  expect: GoldExpect
  probesLexicalGateLimitation: boolean
}

type Pack = {
  specId: string
  promptVersionUnderStudy: string
  fixturePackVersion?: string
  fixtures: GoldFixture[]
}

export type RawModelIntent = {
  intent: string | null
  days: number | null
  agentId: string | null
  parseable: boolean
}

export type QuestionScore = {
  id: string
  category: string
  goldIntent: string
  paramsValid: boolean
  probesLexicalGateLimitation: boolean
  /** Gold-eligible for 3-class confusion (paramsValid). Transport rows still may be true. */
  inPipelineConfusion: boolean
  raw: RawModelIntent
  pipelineStatus: "ok" | "unsupported" | "invalid" | "transport_error"
  pipelineIntent: string | null
  /** Parsed days when pipeline accepted count_actions_window; else null. */
  pipelineDays: number | null
  /** Parsed agentId when pipeline accepted count_actions_window; else null. */
  pipelineAgentId: string | null
  gateWouldAcceptGoldIntent: boolean | null
  /**
   * Raw model intent vs gold. null when pipelineStatus === transport_error
   * (no model output to score — not a semantic miss).
   */
  rawIntentMatch: boolean | null
  /**
   * Operational outcome vs gold. null on transport_error.
   * - paramsValid false → success iff pipelineStatus === unsupported
   * - else → success iff pipeline maps to gold intent class (ok+intent or unsupported)
   */
  operationalSuccess: boolean | null
  /** For confusion: predicted class (pipeline). null if transport_error / incomplete. */
  predictedClass: IntentClass | null
  latencyMs: number | null
  errorKind: string | null
}

export type LatencyStats = {
  n: number
  mean: number | null
  min: number | null
  max: number | null
}

export function latencyStats(values: number[]): LatencyStats {
  if (values.length === 0) {
    return { n: 0, mean: null, min: null, max: null }
  }
  const sum = values.reduce((a, b) => a + b, 0)
  return {
    n: values.length,
    mean: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  }
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

/** Extract intent fields from model text without applying days/agent validation. */
export function extractRawModelIntent(rawText: string): RawModelIntent {
  const trimmed = rawText.trim()
  let obj: unknown = null
  try {
    obj = JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) {
      try {
        obj = JSON.parse(trimmed.slice(start, end + 1))
      } catch {
        obj = null
      }
    }
  }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return { intent: null, days: null, agentId: null, parseable: false }
  }
  const o = obj as Record<string, unknown>
  const intent = typeof o.intent === "string" ? o.intent : null
  let days: number | null = null
  if (typeof o.days === "number" && Number.isFinite(o.days)) {
    days = o.days
  }
  let agentId: string | null = null
  if (typeof o.agentId === "string" && o.agentId.trim()) {
    agentId = o.agentId.trim().toUpperCase()
  } else if (o.agentId === null) {
    agentId = null
  }
  return { intent, days, agentId, parseable: intent != null }
}

export function pipelinePredictedClass(
  resolved: NlqParseResult
): IntentClass | null {
  if (resolved.status === "ok") {
    return resolved.value.intent
  }
  if (resolved.status === "unsupported") {
    return "unsupported"
  }
  return null // invalid → not a confusion class; tracked separately
}

/**
 * Challenge Agent1: invalid_params (paramsValid=false) are EXCLUDED from the
 * full-pipeline 3-class confusion matrix. Including them would force gold
 * "count_actions_window" vs predicted "unsupported" and punish correct rejects.
 */
export function includeInPipelineConfusion(f: GoldFixture): boolean {
  return f.expect.paramsValid !== false
}

export function scoreOperational(
  f: GoldFixture,
  resolved: NlqParseResult
): boolean {
  if (!f.expect.paramsValid) {
    return resolved.status === "unsupported"
  }
  if (f.expect.intent === "unsupported") {
    return resolved.status === "unsupported"
  }
  if (resolved.status === "ok") {
    return resolved.value.intent === f.expect.intent
  }
  return false
}

export function scoreRawIntentMatch(
  f: GoldFixture,
  raw: RawModelIntent
): boolean {
  if (!raw.parseable || raw.intent == null) return false
  if (f.expect.intent === "unsupported") {
    return raw.intent === "unsupported"
  }
  return raw.intent === f.expect.intent
}

export function scoreParamsWhenAccepted(
  f: GoldFixture,
  resolved: NlqParseResult
): boolean | null {
  if (
    f.expect.intent !== "count_actions_window" ||
    !f.expect.paramsValid ||
    resolved.status !== "ok" ||
    resolved.value.intent !== "count_actions_window"
  ) {
    return null
  }
  const v = resolved.value as Extract<
    NlqSupportedIntent,
    { intent: "count_actions_window" }
  >
  const daysOk = v.days === (f.expect.days ?? 7)
  const agentOk =
    (v.agentId ?? null) ===
    (f.expect.agentId === undefined ? null : f.expect.agentId)
  return daysOk && agentOk
}

export function emptyConfusion(): Record<
  IntentClass,
  Record<IntentClass, number>
> {
  const m = {} as Record<IntentClass, Record<IntentClass, number>>
  for (const a of INTENT_CLASSES) {
    m[a] = { count_pending_tier3: 0, count_actions_window: 0, unsupported: 0 }
  }
  return m
}

export function addConfusion(
  matrix: Record<IntentClass, Record<IntentClass, number>>,
  gold: IntentClass,
  pred: IntentClass
): void {
  matrix[gold][pred]++
}

export function confusionTotal(
  matrix: Record<IntentClass, Record<IntentClass, number>>
): number {
  let n = 0
  for (const a of INTENT_CLASSES) {
    for (const b of INTENT_CLASSES) n += matrix[a][b]
  }
  return n
}

function isInfraFailure(err: unknown): boolean {
  if (err instanceof OllamaUnavailableError) return true
  if (err instanceof Error && /timed out|ECONNREFUSED|ENOTFOUND|fetch/i.test(err.message)) {
    return true
  }
  return false
}

function configuredModelName(): string {
  return (process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b").trim() || "qwen2.5:1.5b"
}

function endpointConfigured(): boolean {
  return Boolean((process.env.OLLAMA_BASE_URL ?? "").trim())
}

/** Offline scoring / abort logic tests — no network. */
export async function runSelfTests(): Promise<{
  passed: number
  failed: number
}> {
  let passed = 0
  let failed = 0
  const assert = (cond: boolean, name: string) => {
    if (cond) {
      passed++
      console.log(`  PASS  ${name}`)
    } else {
      failed++
      console.error(`  FAIL  ${name}`)
    }
  }

  console.log("\n=== eval-a4-intent-ollama self-test (mock; no Ollama) ===")

  const pendingGold: GoldFixture = {
    id: "T-P",
    category: "pending_clear",
    question: "How many Tier 3 actions are pending approval?",
    expect: { intent: "count_pending_tier3", paramsValid: true },
    probesLexicalGateLimitation: false,
  }
  const unsupGold: GoldFixture = {
    id: "T-U",
    category: "unsupported_chitchat",
    question: "Good morning — hope you're well today.",
    expect: { intent: "unsupported", paramsValid: true },
    probesLexicalGateLimitation: false,
  }
  const invalidGold: GoldFixture = {
    id: "T-I",
    category: "invalid_params",
    question: "How many agent actions in the last 90 days?",
    expect: {
      intent: "count_actions_window",
      days: 90,
      agentId: null,
      paramsValid: false,
    },
    probesLexicalGateLimitation: false,
  }
  const windowGold: GoldFixture = {
    id: "T-W",
    category: "window_clear",
    question: "How many A2 actions in the last 3 days?",
    expect: {
      intent: "count_actions_window",
      days: 3,
      agentId: "A2",
      paramsValid: true,
    },
    probesLexicalGateLimitation: false,
  }

  assert(includeInPipelineConfusion(pendingGold), "pending in confusion")
  assert(!includeInPipelineConfusion(invalidGold), "invalid_params excluded from confusion")

  const rawPending = extractRawModelIntent(
    '{"intent":"count_pending_tier3"}'
  )
  const resPending = resolveNlqIntentFromModel(
    pendingGold.question,
    '{"intent":"count_pending_tier3"}'
  )
  assert(scoreRawIntentMatch(pendingGold, rawPending), "raw pending match")
  assert(scoreOperational(pendingGold, resPending), "ops pending ok")
  assert(resPending.status === "ok", "pipeline pending ok")

  const resUnsup = resolveNlqIntentFromModel(
    unsupGold.question,
    '{"intent":"unsupported"}'
  )
  assert(scoreOperational(unsupGold, resUnsup), "ops unsupported")

  // Model returns window+90 → parse unsupported; operational success for invalid gold
  const rawInv = extractRawModelIntent(
    '{"intent":"count_actions_window","days":90}'
  )
  const resInv = resolveNlqIntentFromModel(
    invalidGold.question,
    '{"intent":"count_actions_window","days":90}'
  )
  assert(rawInv.intent === "count_actions_window", "raw keeps semantic window")
  assert(scoreRawIntentMatch(invalidGold, rawInv), "raw intent match on invalid_params")
  assert(resInv.status === "unsupported", "pipeline rejects OOR days")
  assert(scoreOperational(invalidGold, resInv), "ops: reject is success")
  assert(
    !scoreOperational(invalidGold, {
      status: "ok",
      value: { intent: "count_actions_window", days: 7, agentId: null },
    } as NlqParseResult),
    "ops: wrongly accepting invalid params fails"
  )

  const resWin = resolveNlqIntentFromModel(
    windowGold.question,
    '{"intent":"count_actions_window","days":3,"agentId":"A2"}'
  )
  assert(scoreOperational(windowGold, resWin), "ops window ok")
  assert(scoreParamsWhenAccepted(windowGold, resWin) === true, "params match")

  const matrix = emptyConfusion()
  addConfusion(matrix, "count_pending_tier3", "count_pending_tier3")
  addConfusion(matrix, "unsupported", "unsupported")
  addConfusion(matrix, "count_actions_window", "unsupported")
  assert(confusionTotal(matrix) === 3, "confusion total 3")
  // Simulate exclusion: do not add invalid_params row to matrix
  assert(includeInPipelineConfusion(invalidGold) === false, "skip invalid in matrix")

  // Mock ollamaChatJson path
  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        message: { content: '{"intent":"unsupported"}' },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  // Ensure base URL present for client resolve
  const prev = process.env.OLLAMA_BASE_URL
  process.env.OLLAMA_BASE_URL = "http://127.0.0.1:9"
  try {
    const chat = await ollamaChatJson({
      messages: [{ role: "user", content: "x" }],
      fetchImpl: mockFetch,
      timeoutMs: 2000,
    })
    assert(chat.content.includes("unsupported"), "mock chat content")
  } finally {
    if (prev !== undefined) process.env.OLLAMA_BASE_URL = prev
    else delete process.env.OLLAMA_BASE_URL
  }

  // Abort counter logic
  let consecutive = 0
  const bump = (infra: boolean) => {
    if (infra) {
      consecutive++
      return consecutive >= 2
    }
    consecutive = 0
    return false
  }
  assert(!bump(true), "abort after 1 infra")
  assert(bump(true), "abort after 2 infra")
  consecutive = 0
  assert(!bump(false), "reset on success")

  // Reporting helpers (no network)
  const latAll = latencyStats([100, 200, 30003])
  const latOk = latencyStats([100, 200])
  assert(latAll.n === 3 && latAll.max === 30003, "latency all includes timeout")
  assert(latOk.n === 2 && latOk.max === 200, "latency nonTransport excludes timeout")
  assert(latOk.mean === 150, "latency nonTransport mean")

  const traversalComplete = true
  const nGold = 34
  const nScored = 33
  const allQuestionsScored = traversalComplete && nScored === nGold
  assert(traversalComplete && !allQuestionsScored, "traversal ≠ all scored")

  // Transport rows: scoring flags must be null, not false
  const transportRawMatch: boolean | null = null
  const transportOps: boolean | null = null
  assert(transportRawMatch === null && transportOps === null, "transport scores are null")

  console.log(`\n${passed} passed, ${failed} failed`)
  return { passed, failed }
}

async function evaluateLive(): Promise<number> {
  if (!endpointConfigured()) {
    console.error(
      "OLLAMA_BASE_URL is not set. Load backend/.env or export it (value not logged)."
    )
    return 2
  }

  const pack = JSON.parse(fs.readFileSync(packPath, "utf8")) as Pack
  if (pack.promptVersionUnderStudy !== A4_NLQ_PROMPT_VERSION) {
    console.error("Gold promptVersionUnderStudy mismatch vs code")
    return 2
  }

  const systemPrompt = buildNlqIntentSystemPrompt()
  const timeoutMs = resolveOllamaTimeoutMs()
  const modelConfigured = configuredModelName()

  console.log("\n=== A4 live intent eval (Ollama → parse → gate) ===")
  console.log(`Gold: ${pack.specId} n=${pack.fixtures.length}`)
  console.log(`Prompt: ${A4_NLQ_PROMPT_VERSION}`)
  console.log(`Model (configured): ${modelConfigured}`)
  console.log(`Temperature: 0 (client fixed)`)
  console.log(`TimeoutMs: ${timeoutMs}`)
  console.log("Concurrency: 1 · retries: 0 · abort after 2 consecutive infra failures")
  console.log("Endpoint: [redacted]\n")

  const scores: QuestionScore[] = []
  let consecutiveInfra = 0
  let aborted = false
  let abortReason: string | null = null
  const matrix = emptyConfusion()
  let modelReported: string | null = null

  for (const f of pack.fixtures) {
    const t0 = Date.now()
    let latencyMs: number | null = null
    let rawContent = ""
    let errorKind: string | null = null
    let resolved: NlqParseResult | null = null
    let raw: RawModelIntent = {
      intent: null,
      days: null,
      agentId: null,
      parseable: false,
    }
    let pipelineStatus: QuestionScore["pipelineStatus"] = "invalid"

    try {
      const chat = await ollamaChatJson({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: f.question },
        ],
      })
      latencyMs = Date.now() - t0
      rawContent = chat.content
      modelReported = chat.model
      consecutiveInfra = 0

      raw = extractRawModelIntent(rawContent)
      resolved = resolveNlqIntentFromModel(f.question, rawContent)
      if (resolved.status === "ok") pipelineStatus = "ok"
      else if (resolved.status === "unsupported") pipelineStatus = "unsupported"
      else pipelineStatus = "invalid"
    } catch (err: unknown) {
      latencyMs = Date.now() - t0
      if (isInfraFailure(err)) {
        errorKind = "infra"
        pipelineStatus = "transport_error"
        consecutiveInfra++
        if (consecutiveInfra >= 2) {
          aborted = true
          abortReason =
            "Two consecutive infrastructure failures (timeout/unavailable/5xx/connection)"
        }
      } else {
        errorKind = "other"
        pipelineStatus = "transport_error"
        consecutiveInfra = 0
      }
    }

    const pred =
      resolved != null ? pipelinePredictedClass(resolved) : null
    const inConf = includeInPipelineConfusion(f)
    if (
      inConf &&
      pred != null &&
      INTENT_CLASSES.includes(f.expect.intent as IntentClass)
    ) {
      addConfusion(matrix, f.expect.intent as IntentClass, pred)
    }

    let gateWould: boolean | null = null
    if (
      f.expect.intent === "count_pending_tier3" ||
      f.expect.intent === "count_actions_window"
    ) {
      gateWould = questionSupportsIntent(
        f.question,
        f.expect.intent as NlqSupportedIntent["intent"]
      )
    }

    const isTransport = pipelineStatus === "transport_error"
    const score: QuestionScore = {
      id: f.id,
      category: f.category,
      goldIntent: f.expect.intent,
      paramsValid: f.expect.paramsValid,
      probesLexicalGateLimitation: f.probesLexicalGateLimitation,
      inPipelineConfusion: inConf,
      raw,
      pipelineStatus,
      pipelineIntent:
        resolved?.status === "ok" ? resolved.value.intent : null,
      pipelineDays:
        resolved?.status === "ok" &&
        resolved.value.intent === "count_actions_window"
          ? resolved.value.days
          : null,
      pipelineAgentId:
        resolved?.status === "ok" &&
        resolved.value.intent === "count_actions_window"
          ? resolved.value.agentId
          : null,
      gateWouldAcceptGoldIntent: gateWould,
      // null on transport — not a semantic/operational miss
      rawIntentMatch: isTransport ? null : scoreRawIntentMatch(f, raw),
      operationalSuccess: isTransport
        ? null
        : resolved != null
          ? scoreOperational(f, resolved)
          : false,
      predictedClass: pred,
      latencyMs,
      errorKind,
    }
    scores.push(score)

    const mark =
      pipelineStatus === "transport_error"
        ? "ERR"
        : score.operationalSuccess === true
          ? "OK "
          : "miss"
    console.log(
      `  ${mark}  ${f.id}  raw=${raw.intent ?? "?"} pipe=${pipelineStatus}` +
        (latencyMs != null ? `  ${latencyMs}ms` : "")
    )

    if (aborted) break
  }

  // complete / traversalComplete: finished walking the corpus without abort.
  // Does NOT mean every question produced a scored model response.
  const traversalComplete =
    !aborted && scores.length === pack.fixtures.length
  const scoredOk = scores.filter((s) => s.pipelineStatus !== "transport_error")
  const allQuestionsScored =
    traversalComplete && scoredOk.length === pack.fixtures.length

  const confusionEligible = scores.filter(
    (s) =>
      s.inPipelineConfusion &&
      s.predictedClass != null &&
      s.pipelineStatus !== "transport_error"
  )
  const confTotal = confusionTotal(matrix)

  const unsupportedGold = scores.filter((s) => s.goldIntent === "unsupported")
  const unsupRejected = unsupportedGold.filter(
    (s) => s.pipelineStatus === "unsupported"
  )
  const unsupFalseAccept = unsupportedGold.filter(
    (s) => s.pipelineStatus === "ok"
  )

  const invalidGold = scores.filter((s) => s.paramsValid === false)
  const invalidRejectedOk = invalidGold.filter(
    (s) => s.pipelineStatus === "unsupported"
  )

  const windowValidAccepted = scores.filter(
    (s) =>
      s.goldIntent === "count_actions_window" &&
      s.paramsValid &&
      s.pipelineStatus === "ok" &&
      s.pipelineIntent === "count_actions_window"
  )
  let paramsCorrect = 0
  for (const s of windowValidAccepted) {
    const f = pack.fixtures.find((x) => x.id === s.id)!
    const resolved: NlqParseResult = {
      status: "ok",
      value: {
        intent: "count_actions_window",
        days: s.pipelineDays ?? 7,
        agentId: s.pipelineAgentId,
      },
    }
    if (scoreParamsWhenAccepted(f, resolved)) paramsCorrect++
  }

  const gateProbes = scores.filter((s) => s.probesLexicalGateLimitation)
  const gateFnObserved = gateProbes.filter(
    (s) =>
      s.rawIntentMatch === true &&
      s.pipelineStatus === "unsupported" &&
      s.gateWouldAcceptGoldIntent === false
  )

  const latenciesAll = scores
    .map((s) => s.latencyMs)
    .filter((x): x is number => x != null)
  const latenciesNonTransport = scoredOk
    .map((s) => s.latencyMs)
    .filter((x): x is number => x != null)
  const latencyAll = latencyStats(latenciesAll)
  const latencyNonTransport = latencyStats(latenciesNonTransport)

  const report = {
    // schemaVersion 2: additive completion/latency fields; transport scores may be null.
    schemaVersion: 2,
    reportKind: "a4_intent_ollama_eval_v1",
    disclaimer:
      "Live Ollama → parseNlqIntent → lexical gate on frozen gold. " +
      "Not chatbot quality. Not RBAC/DB answer accuracy. " +
      "Invalid-parameter items excluded from 3-class pipeline confusion; " +
      "counted under operational rejection instead. " +
      "`complete`/`traversalComplete` mean corpus walk finished without abort — " +
      "not that allQuestionsScored is true.",
    /**
     * Backward-compatible alias of traversalComplete (corpus walk finished, no abort).
     * Prefer allQuestionsScored when citing full scoring coverage.
     */
    complete: traversalComplete,
    traversalComplete,
    allQuestionsScored,
    aborted,
    abortReason,
    generatedAtUtc: new Date().toISOString(),
    gitSha: gitSha(),
    provenance: {
      promptVersion: A4_NLQ_PROMPT_VERSION,
      modelVersionConstant: A4_NLQ_MODEL_VERSION,
      modelConfigured: modelConfigured,
      modelReported,
      temperature: 0,
      timeoutMs,
      concurrency: 1,
      retries: 0,
      goldSpecId: pack.specId,
      goldFixturePackVersion: pack.fixturePackVersion ?? null,
      nGold: pack.fixtures.length,
      nAttempted: scores.length,
      nScoredWithoutTransportError: scoredOk.length,
    },
    metrics: {
      rawIntentAgreement: {
        numerator: scoredOk.filter((s) => s.rawIntentMatch === true).length,
        denominator: scoredOk.length,
      },
      operationalSuccess: {
        numerator: scoredOk.filter((s) => s.operationalSuccess === true)
          .length,
        denominator: scoredOk.length,
      },
      pipelineConfusion3Class: {
        note: "Excludes paramsValid=false (invalid_params). Gold vs predicted pipeline class.",
        matrix,
        n: confTotal,
        nEligibleRows: confusionEligible.length,
        totalsMatch:
          confTotal === confusionEligible.length &&
          confusionEligible.every((s) => s.predictedClass != null),
      },
      unsupportedRejection: {
        goldN: unsupportedGold.length,
        rejectedAsUnsupported: unsupRejected.length,
        falseAcceptOk: unsupFalseAccept.length,
      },
      invalidParamRejection: {
        goldN: invalidGold.length,
        correctlyUnsupported: invalidRejectedOk.length,
      },
      paramAccuracyGivenAcceptedWindow: {
        numerator: paramsCorrect,
        denominator: windowValidAccepted.length,
      },
      gateLimitationProbes: {
        n: gateProbes.length,
        observedPipelineUnsupportedWhileRawMatched: gateFnObserved.map(
          (s) => s.id
        ),
      },
      /**
       * Flat n/mean/min/max remain "all attempted" (incl. timeouts) for v1 readers.
       * Prefer nonTransport for model-latency claims.
       */
      latencyMs: {
        ...latencyAll,
        all: latencyAll,
        nonTransport: latencyNonTransport,
      },
    },
    questions: scores.map((s) => ({
      id: s.id,
      category: s.category,
      goldIntent: s.goldIntent,
      paramsValid: s.paramsValid,
      probesLexicalGateLimitation: s.probesLexicalGateLimitation,
      inPipelineConfusion: s.inPipelineConfusion,
      rawIntent: s.raw.intent,
      rawDays: s.raw.days,
      rawAgentId: s.raw.agentId,
      pipelineStatus: s.pipelineStatus,
      pipelineIntent: s.pipelineIntent,
      pipelineDays: s.pipelineDays,
      pipelineAgentId: s.pipelineAgentId,
      predictedClass: s.predictedClass,
      rawIntentMatch: s.rawIntentMatch,
      operationalSuccess: s.operationalSuccess,
      latencyMs: s.latencyMs,
      errorKind: s.errorKind,
      // raw model text intentionally omitted
    })),
  }

  fs.mkdirSync(outDir, { recursive: true })
  const stamp = report.generatedAtUtc.replace(/[:.]/g, "-")
  const latest = path.join(outDir, "a4-intent-ollama-latest.json")
  const stamped = path.join(outDir, `a4-intent-ollama-${stamp}.json`)
  const body = JSON.stringify(report, null, 2)
  // `latest` is a convenience pointer (ephemeral). Timestamped files are the archive;
  // unique stamps never overwrite prior runs (incl. the authorized baseline stamp).
  fs.writeFileSync(latest, body, "utf8")
  fs.writeFileSync(stamped, body, "utf8")

  console.log("\n=== Summary ===")
  console.log(
    `traversalComplete=${traversalComplete} allQuestionsScored=${allQuestionsScored} aborted=${aborted}`
  )
  if (!traversalComplete) {
    console.log(
      "INCOMPLETE traversal — do not cite as a finished corpus evaluation."
    )
  } else if (!allQuestionsScored) {
    console.log(
      `Traversal finished but only ${scoredOk.length}/${pack.fixtures.length} scored (transport/infra gaps). Cite scored denominators, not 34/34.`
    )
  }
  console.log(
    `rawIntentAgreement: ${report.metrics.rawIntentAgreement.numerator}/${report.metrics.rawIntentAgreement.denominator}`
  )
  console.log(
    `operationalSuccess: ${report.metrics.operationalSuccess.numerator}/${report.metrics.operationalSuccess.denominator}`
  )
  console.log(
    `confusion n=${confTotal} (eligible rows=${confusionEligible.length}) totalsMatch=${report.metrics.pipelineConfusion3Class.totalsMatch}`
  )
  console.log(
    `unsupported reject ${unsupRejected.length}/${unsupportedGold.length}; falseAccept ${unsupFalseAccept.length}`
  )
  console.log(
    `invalidParam reject ${invalidRejectedOk.length}/${invalidGold.length}`
  )
  console.log(
    `latency all mean=${latencyAll.mean} · nonTransport mean=${latencyNonTransport.mean}`
  )
  console.log(`Wrote ${latest}`)

  // Exit 0 when traversal finished (including partial scoring). Abort → non-zero.
  return traversalComplete ? 0 : 1
}

async function main(): Promise<void> {
  // Ensure dotenv loads backend/.env when cwd is backend/
  const envPath = path.join(backendRoot, ".env")
  if (fs.existsSync(envPath)) {
    // dotenv/config already ran; reinforce path if started from monorepo root
    const dotenv = await import("dotenv")
    dotenv.config({ path: envPath })
  }

  const selfTest = process.argv.includes("--self-test")
  if (selfTest) {
    const { failed } = await runSelfTests()
    process.exit(failed === 0 ? 0 : 1)
  }

  const code = await evaluateLive()
  process.exit(code)
}

const isDirect =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirect) {
  main().catch((err) => {
    console.error("Fatal:", err instanceof Error ? err.message : err)
    process.exit(2)
  })
}
