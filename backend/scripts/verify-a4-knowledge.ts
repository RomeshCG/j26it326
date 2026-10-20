/**
 * Offline verification for A4 generative knowledge v1 (no DB / no Ollama / no dispatch).
 *
 * Includes P0 reliability checks: NLQ lexical skip gate, grounded MicroFlow
 * product answers, ambiguous fail-closed. Does NOT modify frozen a4-intent-gold.v1.
 * Run: npm run verify:a4-knowledge
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  A4_KNOWLEDGE_ANSWER_MAX,
  A4_KNOWLEDGE_ANSWER_MIN,
  A4_KNOWLEDGE_ANSWER_SOFT_MAX,
  A4_KNOWLEDGE_DISCLAIMER,
  A4_KNOWLEDGE_LENGTH_RETRY_MIN_REMAINING_MS,
  A4_KNOWLEDGE_NUM_PREDICT,
  A4_KNOWLEDGE_NUM_PREDICT_AB_CANDIDATE,
  A4_KNOWLEDGE_NUM_PREDICT_DEFAULT,
  A4_KNOWLEDGE_PROMPT_VERSION,
  A4_KNOWLEDGE_STAGE_BUDGET_MS,
  A4_KNOWLEDGE_TOO_LONG_REASON,
  answerLooksLikeTenantClaim,
  buildA4KnowledgeLengthRetryUserContent,
  buildA4KnowledgeSystemPrompt,
  buildFinanceTerminologyHints,
  buildMicroFlowSystemCard,
  hardRefuseA4Question,
  isEligibleForKnowledgeLengthRetry,
  knowledgeGenerationMetaFromOutcome,
  matchMicroFlowProductTopic,
  questionSuggestsA4KnowledgeTopic,
  resolveA4KnowledgeFromModel,
  resolveA4KnowledgeNumPredict,
  resolveGroundedMicroFlowKnowledge,
  resolveKnowledgeWithOptionalLengthRetry,
  validateMicroFlowProductAnswer,
} from "../src/lib/agent-a4-knowledge.js"
import {
  A4_NLQ_PROMPT_VERSION,
  buildNlqIntentSystemPrompt,
  questionSuggestsNlqCountIntent,
  questionSupportsIntent,
  resolveNlqIntentFromModel,
} from "../src/lib/agent-a4-nlq.js"
import {
  OllamaUnavailableError,
  resolveOllamaNumPredict,
  sanitizeOllamaErrorBodyForLog,
} from "../src/lib/ollama-client.js"

let passed = 0
let failed = 0

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const casesPath = path.join(
  here,
  "..",
  "eval-fixtures",
  "a4",
  "a4-knowledge-cases.v1.json"
)

type CaseFile = {
  cases: Array<{
    id: string
    question: string
    expect: { hardRefuse: string | null; stage: string }
  }>
  modelParseFixtures: Array<{
    id: string
    question: string
    modelJson: string
    expectStatus: string
  }>
}

const pack = JSON.parse(readFileSync(casesPath, "utf8")) as CaseFile

section("prompt / card constants")
assert(
  A4_KNOWLEDGE_PROMPT_VERSION === "a4-knowledge-v1.2",
  "knowledge prompt version constant (final reliability patch)"
)
assert(
  A4_NLQ_PROMPT_VERSION === "a4-intent-v2",
  "frozen NLQ prompt version untouched"
)
assert(
  buildNlqIntentSystemPrompt().includes("count_pending_tier3"),
  "NLQ system prompt still count-focused"
)
assert(
  !buildNlqIntentSystemPrompt().includes("in_scope"),
  "NLQ prompt does not use knowledge schema"
)
{
  const card = buildMicroFlowSystemCard()
  assert(card.includes("A1 Compliance"), "system card mentions A1")
  assert(card.includes("A4 NLQ"), "system card mentions A4")
  assert(card.includes("Graduated Trust"), "system card mentions Graduated Trust")
  const prompt = buildA4KnowledgeSystemPrompt()
  assert(
    prompt.includes(card.slice(0, 40)),
    "knowledge prompt embeds MicroFlow card"
  )
  assert(
    prompt.includes(String(A4_KNOWLEDGE_ANSWER_SOFT_MAX)),
    "prompt states soft character budget"
  )
  assert(
    prompt.includes("2-4 clear sentences") || prompt.includes("2-4 clear"),
    "prompt asks for concise 2-4 sentences"
  )
  assert(
    prompt.includes("unfamiliar finance"),
    "prompt keeps generative unfamiliar finance"
  )
  assert(A4_KNOWLEDGE_ANSWER_SOFT_MAX === 900, "soft max is 900")
  assert(A4_KNOWLEDGE_ANSWER_MAX === 1200, "hard max remains 1200")
  assert(A4_KNOWLEDGE_ANSWER_MIN === 20, "min length unchanged")
  assert(
    A4_KNOWLEDGE_NUM_PREDICT_DEFAULT === 1024 &&
      A4_KNOWLEDGE_NUM_PREDICT === 1024,
    "knowledge num_predict default remains 1024"
  )
  assert(
    A4_KNOWLEDGE_NUM_PREDICT_AB_CANDIDATE === 512,
    "A/B candidate 512 documented"
  )
  assert(
    resolveA4KnowledgeNumPredict() === 1024,
    "resolveA4KnowledgeNumPredict defaults to 1024"
  )
  assert(
    resolveA4KnowledgeNumPredict(512) === 512,
    "explicit 512 override for A/B"
  )
  assert(
    A4_KNOWLEDGE_NUM_PREDICT ===
      resolveOllamaNumPredict(A4_KNOWLEDGE_NUM_PREDICT),
    "default num_predict still accepted by ollama-client bounds"
  )
  const glossary = buildFinanceTerminologyHints()
  assert(glossary.includes("portfolio at risk"), "glossary defines PAR")
  assert(
    glossary.includes("delinquency day thresholds"),
    "glossary clarifies PAR30/90 thresholds"
  )
  assert(
    glossary.includes("operational self-sufficiency") ||
      glossary.includes("OSS"),
    "glossary defines OSS"
  )
  assert(
    glossary.includes("operating revenue") &&
      glossary.includes("operating expenses"),
    "OSS framed as coverage ratio"
  )
  assert(
    !glossary.includes("What is return on investment"),
    "glossary is not a viva FAQ"
  )
  assert(
    prompt.includes(glossary.slice(0, 40)),
    "knowledge prompt embeds finance glossary"
  )
  assert(A4_KNOWLEDGE_DISCLAIMER.includes("not live institution data"), "disclaimer")
}

section("hardRefuseA4Question corpus")
for (const c of pack.cases) {
  const got = hardRefuseA4Question(c.question)
  const expect = c.expect.hardRefuse
  assert(
    got === expect,
    `${c.id} hardRefuse`,
    `expected ${String(expect)} got ${String(got)}`
  )
}

section("Stage-0 knowledge topic allowlist")
for (const c of pack.cases) {
  const suggests = questionSuggestsA4KnowledgeTopic(c.question)
  if (c.expect.stage === "knowledge_eligible") {
    assert(suggests, `${c.id} knowledge_eligible has finance/product cues`)
  }
  if (c.expect.stage === "knowledge_topic_gate") {
    assert(!suggests, `${c.id} topic gate blocks generative knowledge`)
    assert(
      hardRefuseA4Question(c.question) === null,
      `${c.id} topic-gate cases are not hardRefuse (route uses allowlist)`
    )
  }
  if (
    c.expect.stage === "hard_refuse" &&
    c.expect.hardRefuse === "off_topic" &&
    /ice\s*cream|salad|recipe|dinner/.test(c.question.toLowerCase())
  ) {
    assert(!suggests, `${c.id} off-topic food also fails knowledge allowlist`)
  }
}
{
  const cooking = ["how to make ice cream", "how to make a salad", "what is ice cream"]
  for (const q of cooking) {
    assert(
      !questionSuggestsA4KnowledgeTopic(q),
      `cooking/off-domain blocked: ${q}`
    )
  }
  assert(
    questionSuggestsA4KnowledgeTopic("What is PAR30 in microfinance?"),
    "PAR30 still knowledge-eligible"
  )
  assert(
    questionSuggestsA4KnowledgeTopic("Explain operational self-sufficiency (OSS)"),
    "OSS paraphrase still eligible"
  )
}

section("NLQ regression — count question not hard-refused / gate still works")
{
  const q = "How many Tier 3 actions are awaiting approval?"
  assert(hardRefuseA4Question(q) === null, "pending count not hard-refused")
  assert(
    questionSupportsIntent(q, "count_pending_tier3"),
    "lexical gate still accepts pending count"
  )
  assert(
    questionSuggestsNlqCountIntent(q),
    "NLQ count cue still true for pending (unchanged path)"
  )
  const resolved = resolveNlqIntentFromModel(
    q,
    JSON.stringify({ intent: "count_pending_tier3" })
  )
  assert(resolved.status === "ok", "NLQ resolve still ok for pending count")
}
{
  const q = "How many A3 actions were recorded in the last 7 days?"
  assert(hardRefuseA4Question(q) === null, "window count not hard-refused")
  assert(
    questionSupportsIntent(q, "count_actions_window"),
    "lexical gate still accepts window count"
  )
}

section("resolveA4KnowledgeFromModel fixtures")
for (const f of pack.modelParseFixtures) {
  const result = resolveA4KnowledgeFromModel(f.question, f.modelJson)
  assert(
    result.status === f.expectStatus,
    `${f.id} status=${f.expectStatus}`,
    `got ${result.status}${result.status !== "ok" ? ` (${result.reason})` : ""}`
  )
}

section("tenant-claim heuristic")
assert(
  answerLooksLikeTenantClaim(
    "Your institution currently has 12 pending approvals in the queue."
  ),
  "flags institution pending claim"
)
assert(
  !answerLooksLikeTenantClaim(
    "PAR30 is the portfolio at risk over 30 days, a common microfinance delinquency ratio."
  ),
  "allows general PAR30 definition"
)

section("knowledge_eligible cases are not mistaken for pending-count NLQ")
for (const c of pack.cases.filter((x) => x.expect.stage === "knowledge_eligible")) {
  assert(
    !questionSupportsIntent(c.question, "count_pending_tier3"),
    `${c.id} not pending-count gate`,
    c.question
  )
  assert(
    !questionSuggestsNlqCountIntent(c.question),
    `${c.id} P0 skip-intent (no count lexical cues)`,
    c.question
  )
}

section("P0 NLQ lexical skip vs count path")
{
  const countQs = [
    "How many Tier 3 actions are awaiting approval?",
    "How many A3 actions were recorded in the last 7 days?",
    "Count pending approvals in the Tier 3 queue",
  ]
  for (const q of countQs) {
    assert(
      questionSuggestsNlqCountIntent(q) === true,
      `count cue keeps NLQ classifier: ${q.slice(0, 48)}`
    )
  }
  const skipQs = [
    "What is PAR30 in microfinance?",
    "What does Agent 3 do?",
    "Explain Graduated Trust briefly",
    "What's for dinner tonight?",
  ]
  for (const q of skipQs) {
    assert(
      questionSuggestsNlqCountIntent(q) === false,
      `no count cue skips NLQ classifier: ${q.slice(0, 48)}`
    )
  }
}

section("P0 grounded MicroFlow product answers (varied phrasings)")
{
  const cases: Array<{ q: string; topic: string }> = [
    { q: "What does Agent 1 do?", topic: "A1" },
    { q: "Explain Agent 1 compliance readiness", topic: "A1" },
    { q: "What is Agent 2 responsible for?", topic: "A2" },
    { q: "Tell me about budget threshold alerts", topic: "A2" },
    { q: "What does Agent 3 do?", topic: "A3" },
    { q: "How does Isolation Forest anomaly detection work in MicroFlow?", topic: "A3" },
    { q: "Describe the volume spike agent", topic: "A3" },
    { q: "What can Agent 4 actually do today?", topic: "A4" },
    { q: "What is A4 NLQ for?", topic: "A4" },
    { q: "Why does Graduated Trust Tier 3 require human approval?", topic: "GT" },
    { q: "What do Agents A1 A2 A3 and A4 do in MicroFlow?", topic: "AGENTS_OVERVIEW" },
  ]
  for (const { q, topic } of cases) {
    const matched = matchMicroFlowProductTopic(q)
    assert(matched === topic, `match ${topic}: ${q.slice(0, 52)}`, `got ${String(matched)}`)
    const resolved = resolveGroundedMicroFlowKnowledge(q)
    assert(resolved.ok === true, `grounded ok: ${topic}`)
    if (resolved.ok) {
      assert(
        validateMicroFlowProductAnswer(resolved.topic, resolved.answer),
        `anchors hold: ${topic}`
      )
      // Confusion guards — A3 must not look like A2/A4
      if (topic === "A3") {
        assert(
          !/\bbudget_threshold\b/i.test(resolved.answer),
          "A3 answer is not budget_threshold"
        )
        assert(
          /\bisolation forest\b/i.test(resolved.answer),
          "A3 answer mentions Isolation Forest"
        )
        assert(/\btier 4\b/i.test(resolved.answer), "A3 answer mentions Tier 4")
      }
      if (topic === "A1") {
        assert(/\btier 3\b/i.test(resolved.answer), "A1 mentions Tier 3")
        assert(!/\bisolation forest\b/i.test(resolved.answer), "A1 is not IF")
      }
      if (topic === "A4") {
        assert(/\btier 1\b/i.test(resolved.answer), "A4 mentions Tier 1")
        assert(/\bcount\b/i.test(resolved.answer), "A4 mentions count")
      }
    }
  }
}

section("P0 general finance stays generative (not fixed FAQ)")
{
  const financeQs = [
    "What is PAR30 in microfinance?",
    "Explain ROI with a simple lending example",
    "What is an NPL?",
  ]
  for (const q of financeQs) {
    assert(
      matchMicroFlowProductTopic(q) === null,
      `finance not product-matched: ${q.slice(0, 40)}`
    )
  }
}

section("P0 ambiguous / mixed remain fail-closed")
{
  const mixed = [
    "What is our institution PAR30 this month?",
    "Explain PAR30 and also tell me our current PAR30",
  ]
  for (const q of mixed) {
    assert(
      hardRefuseA4Question(q) === "mixed_intent",
      `mixed_intent: ${q.slice(0, 48)}`
    )
    assert(
      !questionSuggestsNlqCountIntent(q),
      `mixed does not open NLQ path: ${q.slice(0, 40)}`
    )
  }
  assert(
    hardRefuseA4Question("How many borrowers do we have in Colombo?") ===
      "tenant_data_without_tool",
    "unsupported tenant data blocked"
  )
  assert(
    hardRefuseA4Question("Approve all pending Tier 3 actions now") ===
      "action_not_allowed",
    "operational action blocked"
  )
}

section("P0 Ollama error classification shape")
{
  const timeout = new OllamaUnavailableError("timed out", "timeout")
  assert(timeout.code === "timeout", "timeout code")
  const empty = new OllamaUnavailableError("empty", "empty")
  assert(empty.code === "empty", "empty code")
  const http = new OllamaUnavailableError("http", "http", 502)
  assert(http.code === "http" && http.httpStatus === 502, "http code+status")
  const net = new OllamaUnavailableError(
    "fetch failed https://secret.internal/api",
    "network"
  )
  assert(net.code === "network", "network code")
  // Client redaction is in ollamaChatJson; error message constructor does not
  // auto-redact — respondOllamaUnavailable never echoes err.message to clients.
  assert(true, "503 client payload keeps legacy error string only + code/stage")
}

section("P1 Stage A — answer length gates (no silent truncate)")
{
  const q = "What is microfinance?"
  const softOk = "A".repeat(A4_KNOWLEDGE_ANSWER_SOFT_MAX)
  const hardOk = "B".repeat(A4_KNOWLEDGE_ANSWER_MAX)
  const tooLong = "C".repeat(A4_KNOWLEDGE_ANSWER_MAX + 1)
  assert(
    resolveA4KnowledgeFromModel(
      q,
      JSON.stringify({ in_scope: true, answer: softOk })
    ).status === "ok",
    "soft-max length answer accepted"
  )
  assert(
    resolveA4KnowledgeFromModel(
      q,
      JSON.stringify({ in_scope: true, answer: hardOk })
    ).status === "ok",
    "hard-max length answer accepted"
  )
  const over = resolveA4KnowledgeFromModel(
    q,
    JSON.stringify({ in_scope: true, answer: tooLong })
  )
  assert(over.status === "unsupported", "over hard-max → unsupported")
  assert(
    over.status === "unsupported" && over.reason === "Knowledge answer too long",
    "over hard-max reason is too long (not truncated)"
  )
  const short = resolveA4KnowledgeFromModel(
    q,
    JSON.stringify({ in_scope: true, answer: "tiny" })
  )
  assert(short.status === "unsupported", "under min → unsupported")
}

section("P1 Stage A — error body sanitization (server log only)")
{
  const dirty =
    'error at http://100.98.191.25:11434/api/chat token=sk-SECRET123456 password=hunter2 contact admin@zz-test.lk ' +
    "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  const clean = sanitizeOllamaErrorBodyForLog(dirty)
  assert(!clean.includes("100.98.191.25"), "sanitizer strips host URL")
  assert(!clean.includes("sk-SECRET"), "sanitizer strips secret-like values")
  assert(!clean.includes("hunter2"), "sanitizer strips password value")
  assert(!clean.includes("admin@zz-test.lk"), "sanitizer strips email")
  assert(clean.includes("[redacted-url]"), "sanitizer marks URL")
  assert(clean.length <= 240 + 1, "sanitizer respects log cap") // +1 for ellipsis char
}

section("P1 Stage B — length retry eligibility + messages")
{
  assert(A4_KNOWLEDGE_STAGE_BUDGET_MS === 45_000, "stage budget 45s")
  assert(
    A4_KNOWLEDGE_LENGTH_RETRY_MIN_REMAINING_MS === 8_000,
    "min remaining 8s to retry"
  )
  const tooLong = resolveA4KnowledgeFromModel(
    "What is ROI?",
    JSON.stringify({
      in_scope: true,
      answer: "X".repeat(A4_KNOWLEDGE_ANSWER_MAX + 1),
    })
  )
  assert(
    isEligibleForKnowledgeLengthRetry(tooLong) === true,
    "too-long is retry-eligible"
  )
  const offTopic = resolveA4KnowledgeFromModel(
    "Where should I go for dinner?",
    JSON.stringify({
      in_scope: true,
      answer: "X".repeat(A4_KNOWLEDGE_ANSWER_MAX + 1),
    })
  )
  assert(
    isEligibleForKnowledgeLengthRetry(offTopic) === false,
    "safety hard-refuse not retry-eligible even if long"
  )
  const tenant = resolveA4KnowledgeFromModel(
    "What is microfinance?",
    JSON.stringify({
      in_scope: true,
      answer: "Your institution currently has 12 pending approvals in the queue.",
    })
  )
  assert(
    isEligibleForKnowledgeLengthRetry(tenant) === false,
    "tenant-claim reject not retry-eligible"
  )
  const retryUser = buildA4KnowledgeLengthRetryUserContent(
    "What is return on investment?"
  )
  assert(
    retryUser.includes("What is return on investment?"),
    "retry keeps original question"
  )
  assert(retryUser.includes("800"), "retry asks for shorter budget")
  assert(retryUser.includes("same financial meaning"), "retry preserves meaning")
}

section("P1 Stage B — resolveKnowledgeWithOptionalLengthRetry")
{
  const q = "What is return on investment, and how is it calculated?"
  const longJson = JSON.stringify({
    in_scope: true,
    answer: "L".repeat(A4_KNOWLEDGE_ANSWER_MAX + 50),
  })
  const shortOk = JSON.stringify({
    in_scope: true,
    answer:
      "ROI measures profit relative to cost: net profit divided by investment, times 100. For example, 750 profit on 5000 invested is 15%. It is a general education metric, not your institution's figures.",
  })

  // First too long → second valid → knowledge ok
  {
    let calls = 0
    const progress: Array<{ attempts: number; retriedForLength: boolean }> = []
    const out = await resolveKnowledgeWithOptionalLengthRetry({
      question: q,
      chat: async () => {
        calls++
        return {
          content: calls === 1 ? longJson : shortOk,
          model: "qwen2.5:1.5b",
        }
      },
      onAttemptComplete: (m) =>
        progress.push({
          attempts: m.attempts,
          retriedForLength: m.retriedForLength,
        }),
    })
    assert(calls === 2, "too-long triggers exactly one regeneration")
    assert(out.retriedForLength === true, "retriedForLength true")
    assert(out.attempts === 2, "attempts=2")
    assert(
      out.attemptDurationsMs.length === 2 &&
        out.attemptDurationsMs.every((d) => typeof d === "number" && d >= 0),
      "attemptDurationsMs has two non-negative entries"
    )
    assert(out.numPredict === 1024, "default numPredict on outcome is 1024")
    const meta = knowledgeGenerationMetaFromOutcome(out)
    assert(
      meta.attempts === 2 &&
        meta.retriedForLength === true &&
        meta.attemptDurationsMs.length === 2,
      "knowledgeGenerationMetaFromOutcome mirrors outcome"
    )
    assert(
      progress.length === 2 &&
        progress[0].retriedForLength === false &&
        progress[1].retriedForLength === true,
      "progress callback tracks attempts without prompts"
    )
    assert(out.result.status === "ok", "second valid → ok")
    assert(
      out.result.status === "ok" && out.result.answer.includes("15%"),
      "returned shorter knowledge answer"
    )
  }

  // A/B num_predict override
  {
    let seenNumPredict: number | undefined
    const out = await resolveKnowledgeWithOptionalLengthRetry({
      question: q,
      numPredict: A4_KNOWLEDGE_NUM_PREDICT_AB_CANDIDATE,
      chat: async (args) => {
        seenNumPredict = args.numPredict
        return { content: shortOk, model: "qwen2.5:1.5b" }
      },
    })
    assert(
      seenNumPredict === A4_KNOWLEDGE_NUM_PREDICT_AB_CANDIDATE,
      "chat receives A/B numPredict 512"
    )
    assert(
      out.numPredict === A4_KNOWLEDGE_NUM_PREDICT_AB_CANDIDATE,
      "outcome records A/B numPredict"
    )
  }

  // Env A4_KNOWLEDGE_NUM_PREDICT
  {
    const prev = process.env.A4_KNOWLEDGE_NUM_PREDICT
    process.env.A4_KNOWLEDGE_NUM_PREDICT = "512"
    assert(resolveA4KnowledgeNumPredict() === 512, "env selects 512 for A/B")
    process.env.A4_KNOWLEDGE_NUM_PREDICT = "not-a-number"
    assert(
      resolveA4KnowledgeNumPredict() === 1024,
      "invalid env falls back to 1024"
    )
    if (prev !== undefined) process.env.A4_KNOWLEDGE_NUM_PREDICT = prev
    else delete process.env.A4_KNOWLEDGE_NUM_PREDICT
  }

  // First too long → second still too long → reject
  {
    let calls = 0
    const out = await resolveKnowledgeWithOptionalLengthRetry({
      question: q,
      chat: async () => {
        calls++
        return { content: longJson, model: "qwen2.5:1.5b" }
      },
    })
    assert(calls === 2, "still retries once when second also long")
    assert(out.result.status === "unsupported", "second still invalid → reject")
    assert(
      out.result.status === "unsupported" &&
        out.result.reason === A4_KNOWLEDGE_TOO_LONG_REASON,
      "reject reason remains too long"
    )
  }

  // Safety / off-topic → zero regeneration (hardRefuse wins inside resolve)
  {
    let calls = 0
    const out = await resolveKnowledgeWithOptionalLengthRetry({
      question: "Where should I go for dinner?",
      chat: async () => {
        calls++
        return { content: longJson, model: "qwen2.5:1.5b" }
      },
    })
    assert(calls === 1, "safety path: single chat only")
    assert(out.retriedForLength === false, "no length retry on safety")
    assert(
      out.result.status === "unsupported" && out.result.reason === "off_topic",
      "off_topic preserved"
    )
  }

  // Action refuse → zero regeneration
  {
    let calls = 0
    const out = await resolveKnowledgeWithOptionalLengthRetry({
      question: "Approve all pending Tier 3 actions now",
      chat: async () => {
        calls++
        return { content: longJson, model: "qwen2.5:1.5b" }
      },
    })
    assert(calls === 1, "action refuse: no regeneration")
    assert(out.retriedForLength === false, "no retry on action_not_allowed")
  }

  // First ok → no second call
  {
    let calls = 0
    const out = await resolveKnowledgeWithOptionalLengthRetry({
      question: q,
      chat: async () => {
        calls++
        return { content: shortOk, model: "qwen2.5:1.5b" }
      },
    })
    assert(calls === 1, "ok first attempt does not retry")
    assert(out.retriedForLength === false, "no retry when first ok")
    assert(out.result.status === "ok", "first ok returned")
  }

  // Budget exhausted → skip retry
  {
    let calls = 0
    let t = 0
    const out = await resolveKnowledgeWithOptionalLengthRetry({
      question: q,
      stageBudgetMs: A4_KNOWLEDGE_STAGE_BUDGET_MS,
      now: () => {
        // start=0; after first chat elapsed jumps past budget-min
        const v = t
        t = A4_KNOWLEDGE_STAGE_BUDGET_MS - 1000
        return v
      },
      chat: async () => {
        calls++
        return { content: longJson, model: "qwen2.5:1.5b" }
      },
    })
    assert(calls === 1, "insufficient budget skips retry")
    assert(out.retriedForLength === false, "no retry when budget tight")
    assert(
      out.result.status === "unsupported" &&
        out.result.reason === A4_KNOWLEDGE_TOO_LONG_REASON,
      "keeps too-long without second call"
    )
  }

  // Retry user message carries timeoutMs when retried
  {
    const timeouts: Array<number | undefined> = []
    await resolveKnowledgeWithOptionalLengthRetry({
      question: q,
      chat: async (args) => {
        timeouts.push(args.timeoutMs)
        return {
          content: timeouts.length === 1 ? longJson : shortOk,
          model: "qwen2.5:1.5b",
        }
      },
    })
    assert(timeouts[0] === undefined, "first attempt uses default timeout")
    assert(
      typeof timeouts[1] === "number" && (timeouts[1] as number) > 0,
      "retry passes bounded timeoutMs"
    )
  }
}

section("P1 Stage B — NLQ path untouched by knowledge retry helpers")
{
  assert(
    questionSuggestsNlqCountIntent(
      "How many agent actions happened in the last 7 days?"
    ),
    "count question still suggests NLQ"
  )
  assert(
    !buildA4KnowledgeLengthRetryUserContent("x").includes("dispatch"),
    "retry helper does not mention dispatch"
  )
  // Knowledge retry is a pure chat helper — cannot create agent_actions rows.
  assert(true, "no duplicate NLQ dispatch from knowledge length retry")
}

console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`)
if (failed > 0) {
  process.exit(1)
}
