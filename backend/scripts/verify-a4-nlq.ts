/**
 * Offline verification for A4 NLQ v1 (no DB / no live Ollama / no dispatch).
 *
 * Run: npm run verify:a4-nlq
 */
import {
  A4_NLQ_ACTION_TYPE,
  A4_NLQ_DAYS_DEFAULT,
  A4_NLQ_MODEL_VERSION,
  A4_NLQ_PROMPT_VERSION,
  buildNlqAnswer,
  buildNlqInputPayload,
  capabilityForNlqIntent,
  parseNlqIntent,
  roleMayRunNlqIntent,
  runNlqTool,
  validateNlqQuestion,
  type NlqTenantPrisma,
} from "../src/lib/agent-a4-nlq.js"
import {
  clearActionHandlers,
  executeActionHandler,
  getActionHandler,
  hasRegisteredActionHandler,
  nlqQueryHandler,
  registerDefaultAgentHandlers,
} from "../src/lib/agent-handlers.js"
import { NLQ_QUERY_ROLES } from "../src/routes/agent-governance.js"
import { hasCapability, type RoleName } from "../src/lib/permissions.js"
import {
  OLLAMA_TIMEOUT_MS_DEFAULT,
  OllamaUnavailableError,
  ollamaChatJson,
  resolveOllamaTimeoutMs,
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

section("validateNlqQuestion")
assert(!validateNlqQuestion(null).ok, "rejects null body")
assert(!validateNlqQuestion({}).ok, "rejects missing question")
assert(!validateNlqQuestion({ question: "hi" }).ok, "rejects too short")
assert(
  !validateNlqQuestion({ question: "x".repeat(501) }).ok,
  "rejects too long"
)
{
  const ok = validateNlqQuestion({ question: "  How many pending?  " })
  assert(ok.ok === true, "accepts trimmed question")
  if (ok.ok) {
    assert(ok.question === "How many pending?", "trims question")
  }
}

section("parseNlqIntent")
assert(
  parseNlqIntent("not json").status === "invalid",
  "rejects non-JSON"
)
assert(
  parseNlqIntent('{"intent":"unsupported"}').status === "unsupported",
  "unsupported intent"
)
assert(
  parseNlqIntent('{"intent":"count_pending_tier3","count":99}').status ===
    "ok",
  "accepts pending intent and ignores model count"
)
{
  const p = parseNlqIntent('{"intent":"count_actions_window"}')
  assert(p.status === "ok", "window intent without days")
  if (p.status === "ok" && p.value.intent === "count_actions_window") {
    assert(p.value.days === A4_NLQ_DAYS_DEFAULT, "defaults days to 7")
    assert(p.value.agentId === null, "defaults agentId null")
  }
}
{
  const p = parseNlqIntent(
    '{"intent":"count_actions_window","days":14,"agentId":"a3"}'
  )
  assert(p.status === "ok", "window with days and agentId")
  if (p.status === "ok" && p.value.intent === "count_actions_window") {
    assert(p.value.days === 14 && p.value.agentId === "A3", "normalizes agentId")
  }
}
assert(
  parseNlqIntent('{"intent":"count_actions_window","days":90}').status ===
    "unsupported",
  "rejects days=90 without clamping"
)
{
  const p = parseNlqIntent('{"intent":"count_actions_window","days":90}')
  const reasonOk =
    p.status === "unsupported" &&
    (p.reason.includes("1–30") || p.reason.includes("1-30"))
  assert(
    reasonOk,
    "out-of-range reason discloses 1–30 window",
    p.status === "unsupported" ? p.reason : undefined
  )
}
assert(
  parseNlqIntent('{"intent":"count_actions_window","days":0}').status ===
    "unsupported",
  "rejects days=0"
)
assert(
  parseNlqIntent('{"intent":"count_actions_window","days":31}').status ===
    "unsupported",
  "rejects days=31"
)
assert(
  parseNlqIntent(
    '{"intent":"count_actions_window","agentId":"A9"}'
  ).status === "unsupported",
  "rejects invalid agentId"
)
assert(
  parseNlqIntent('{"intent":"invent_money"}').status === "unsupported",
  "rejects unknown intent"
)

section("answer templates (facts only)")
assert(
  buildNlqAnswer({ intent: "count_pending_tier3", count: 0 }) ===
    "There are 0 Tier 3 actions pending approval.",
  "pending zero"
)
assert(
  buildNlqAnswer({ intent: "count_pending_tier3", count: 1 }) ===
    "There is 1 Tier 3 action pending approval.",
  "pending singular"
)
assert(
  buildNlqAnswer({
    intent: "count_actions_window",
    count: 3,
    days: 7,
    agentId: "A3",
    sinceIso: "2026-01-01T00:00:00.000Z",
  }).includes("3") &&
    buildNlqAnswer({
      intent: "count_actions_window",
      count: 3,
      days: 7,
      agentId: "A3",
      sinceIso: "2026-01-01T00:00:00.000Z",
    }).includes("A3"),
  "window answer uses facts"
)

section("tool RBAC")
assert(
  capabilityForNlqIntent("count_pending_tier3") === "agents:decide_tier3",
  "pending requires decide_tier3"
)
assert(
  capabilityForNlqIntent("count_actions_window") === "agents:view_actions",
  "window requires view_actions"
)
assert(roleMayRunNlqIntent("admin", "count_pending_tier3"), "admin pending")
assert(
  roleMayRunNlqIntent("executive", "count_pending_tier3"),
  "executive pending"
)
assert(
  roleMayRunNlqIntent("branch_manager", "count_pending_tier3"),
  "BM pending"
)
assert(
  !roleMayRunNlqIntent("finance_officer", "count_pending_tier3"),
  "finance cannot pending"
)
assert(
  !roleMayRunNlqIntent("hr_officer", "count_pending_tier3"),
  "hr cannot pending"
)
assert(
  !roleMayRunNlqIntent("loan_officer", "count_pending_tier3"),
  "loan cannot pending"
)
assert(
  roleMayRunNlqIntent("finance_officer", "count_actions_window"),
  "finance may window"
)
assert(
  roleMayRunNlqIntent("loan_officer", "count_actions_window"),
  "loan may window"
)

section("endpoint NLQ_QUERY_ROLES")
{
  const roles = new Set(NLQ_QUERY_ROLES)
  for (const r of [
    "admin",
    "executive",
    "finance_officer",
    "hr_officer",
    "branch_manager",
    "loan_officer",
  ] as RoleName[]) {
    assert(
      roles.has(r) && hasCapability(r, "agents:query_nlq"),
      `${r} has query_nlq and is in NLQ_QUERY_ROLES`
    )
  }
}

section("runNlqTool (fake prisma)")
{
  const calls: unknown[] = []
  const fake: NlqTenantPrisma = {
    agentAction: {
      count: async (args) => {
        calls.push(args)
        return 5
      },
    },
  }
  const pending = await runNlqTool(fake, { intent: "count_pending_tier3" })
  assert(pending.count === 5 && pending.intent === "count_pending_tier3", "pending tool")
  assert(
    JSON.stringify(calls[0]).includes("pending_approval"),
    "pending where clause"
  )

  calls.length = 0
  const window = await runNlqTool(
    fake,
    { intent: "count_actions_window", days: 7, agentId: "A3" },
    new Date("2026-10-16T00:00:00.000Z")
  )
  assert(
    window.intent === "count_actions_window" &&
      window.count === 5 &&
      window.days === 7 &&
      window.agentId === "A3",
    "window tool facts"
  )
  assert(
    JSON.stringify(calls[0]).includes("A3"),
    "window filters agentId"
  )
}

section("handler registration (not stub)")
clearActionHandlers()
assert(
  !hasRegisteredActionHandler(A4_NLQ_ACTION_TYPE),
  "cleared registry has no A4 handler"
)
registerDefaultAgentHandlers()
assert(
  hasRegisteredActionHandler(A4_NLQ_ACTION_TYPE),
  "registerDefaultAgentHandlers registers A4"
)
assert(
  getActionHandler(A4_NLQ_ACTION_TYPE) === nlqQueryHandler,
  "getActionHandler returns real A4 handler"
)

{
  const facts = { intent: "count_pending_tier3" as const, count: 2 }
  const answer = buildNlqAnswer(facts)
  const exec = await executeActionHandler({
    actionId: "33333333-3333-4333-8333-333333333333",
    actionType: A4_NLQ_ACTION_TYPE,
    agentId: "A4",
    agentName: "NLQ",
    tier: 1,
    inputPayload: buildNlqInputPayload({
      question: "How many pending approvals?",
      facts,
      answer,
      ollamaModel: "qwen2.5:1.5b",
    }),
  })
  assert(exec.success === true, "handler succeeds")
  const out = exec.outputPayload as Record<string, unknown>
  assert(out.stubExecuted === false, "not stub")
  assert(out.handler === "nlqQueryHandler", "handler id")
  assert(out.answer === answer, "echoes answer")
  assert(out.modelVersion === A4_NLQ_MODEL_VERSION, "model version")
  assert(out.promptVersion === A4_NLQ_PROMPT_VERSION, "prompt version")
}

{
  const exec = await executeActionHandler({
    actionId: "33333333-3333-4333-8333-333333333334",
    actionType: A4_NLQ_ACTION_TYPE,
    agentId: "A4",
    agentName: "NLQ",
    tier: 1,
    inputPayload: { question: "x" },
  })
  assert(exec.success === false, "handler fails closed without facts")
}

section("ollama timeout resolution")
{
  const prev = process.env.OLLAMA_TIMEOUT_MS
  delete process.env.OLLAMA_TIMEOUT_MS
  assert(
    resolveOllamaTimeoutMs() === OLLAMA_TIMEOUT_MS_DEFAULT,
    "default timeout is 30000"
  )
  assert(resolveOllamaTimeoutMs(12_000) === 12_000, "explicit override wins")
  assert(
    resolveOllamaTimeoutMs(50) === 50,
    "explicit short timeout allowed for tests"
  )
  process.env.OLLAMA_TIMEOUT_MS = "45000"
  assert(resolveOllamaTimeoutMs() === 45_000, "reads OLLAMA_TIMEOUT_MS")
  assert(
    resolveOllamaTimeoutMs(12_000) === 12_000,
    "option still overrides env"
  )
  process.env.OLLAMA_TIMEOUT_MS = "not-a-number"
  assert(
    resolveOllamaTimeoutMs() === OLLAMA_TIMEOUT_MS_DEFAULT,
    "invalid env falls back to default"
  )
  process.env.OLLAMA_TIMEOUT_MS = "500"
  assert(
    resolveOllamaTimeoutMs() === OLLAMA_TIMEOUT_MS_DEFAULT,
    "env below min falls back to default"
  )
  process.env.OLLAMA_TIMEOUT_MS = "999999"
  assert(
    resolveOllamaTimeoutMs() === OLLAMA_TIMEOUT_MS_DEFAULT,
    "env above max falls back to default"
  )
  if (prev !== undefined) process.env.OLLAMA_TIMEOUT_MS = prev
  else delete process.env.OLLAMA_TIMEOUT_MS
}

section("ollama client fail-closed")
{
  const prev = process.env.OLLAMA_BASE_URL
  delete process.env.OLLAMA_BASE_URL
  try {
    await ollamaChatJson({
      messages: [{ role: "user", content: "hi" }],
    })
    assert(false, "missing base URL should throw")
  } catch (err) {
    assert(
      err instanceof OllamaUnavailableError,
      "throws OllamaUnavailableError when unset"
    )
  } finally {
    if (prev !== undefined) process.env.OLLAMA_BASE_URL = prev
  }
}
{
  try {
    await ollamaChatJson({
      baseUrl: "http://127.0.0.1:9",
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 50,
      fetchImpl: async () => {
        throw new Error("connect refused")
      },
    })
    assert(false, "fetch failure should throw")
  } catch (err) {
    assert(
      err instanceof OllamaUnavailableError,
      "maps fetch failure to unavailable"
    )
  }
}
{
  const chat = await ollamaChatJson({
    baseUrl: "http://ollama.test",
    model: "qwen2.5:1.5b",
    messages: [{ role: "user", content: "hi" }],
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          message: { content: '{"intent":"unsupported"}' },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      ),
  })
  assert(
    chat.content.includes("unsupported") && chat.model === "qwen2.5:1.5b",
    "mock fetch returns content"
  )
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
