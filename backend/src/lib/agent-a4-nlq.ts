/**
 * A4 NLQ — natural-language intent + grounded M4 tools (v1).
 *
 * Ollama classifies intent only. Node runs tenant-scoped Prisma counts and
 * builds answers from templates. Numbers are never taken from the model.
 *
 * Tool RBAC mirrors existing Agent Log / pending APIs:
 * - count_pending_tier3 → agents:decide_tier3
 * - count_actions_window → agents:view_actions
 */

import type { Capability, RoleName } from "./permissions.js"
import { hasCapability } from "./permissions.js"

export const A4_NLQ_ACTION_TYPE = "nlq_query" as const
export const A4_NLQ_MODEL_VERSION = "a4-nlq-ollama-v1" as const
/** Prompt + post-parse evidence gate (v2). */
export const A4_NLQ_PROMPT_VERSION = "a4-intent-v2" as const

export const A4_NLQ_DAYS_MIN = 1
export const A4_NLQ_DAYS_MAX = 30
export const A4_NLQ_DAYS_DEFAULT = 7

export const A4_NLQ_QUESTION_MIN = 3
export const A4_NLQ_QUESTION_MAX = 500

export const A4_KNOWN_AGENT_IDS = new Set(["A1", "A2", "A3", "A4"])

export type NlqSupportedIntent =
  | {
      intent: "count_pending_tier3"
    }
  | {
      intent: "count_actions_window"
      days: number
      agentId: string | null
    }

export type NlqParseResult =
  | { status: "ok"; value: NlqSupportedIntent }
  | { status: "unsupported"; reason: string }
  | { status: "invalid"; reason: string }

export type NlqQuestionValidation =
  | { ok: true; question: string }
  | { ok: false; error: string }

export type NlqFacts =
  | {
      intent: "count_pending_tier3"
      count: number
    }
  | {
      intent: "count_actions_window"
      count: number
      days: number
      agentId: string | null
      sinceIso: string
    }

/** Minimal Prisma surface for A4 v1 tools (aggregate count only). */
export type NlqTenantPrisma = {
  agentAction: {
    count: (args: {
      where: Record<string, unknown>
    }) => Promise<number>
  }
}

/**
 * System prompt for intent classification. Instructs JSON-only output with
 * no numeric answers. Small models must default to unsupported when unsure.
 */
export function buildNlqIntentSystemPrompt(): string {
  return [
    "You classify IMFS M4 agent-governance questions into a fixed intent schema.",
    "Respond with a single JSON object only. Do not invent counts or financial values.",
    "Default to unsupported whenever the user is not clearly asking for one of the two count questions.",
    "Allowed intents:",
    '- {"intent":"count_pending_tier3"} — ONLY if they ask how many Tier 3 / approval / pending-approval agent actions are waiting',
    '- {"intent":"count_actions_window","days":<1-30 optional>,"agentId":"A1"|"A2"|"A3"|"A4"|null optional} — ONLY if they ask how many agent actions (optionally for A1–A4) in a recent day window',
    '- {"intent":"unsupported"} — greetings, chit-chat, thanks, unclear text, PAR, payroll, loans, EPF, budgets, staff, branches, or anything else',
    "Examples:",
    'User: Hello → {"intent":"unsupported"}',
    'User: Hi there → {"intent":"unsupported"}',
    'User: What is PAR30? → {"intent":"unsupported"}',
    'User: How many Tier 3 actions are awaiting approval? → {"intent":"count_pending_tier3"}',
    'User: How many A3 actions were recorded in the last 7 days? → {"intent":"count_actions_window","days":7,"agentId":"A3"}',
    "If the user asks for a window longer than 30 days, still return count_actions_window with their requested days; the server will reject out-of-range days.",
    "Omit days to mean the default window. Never include a count field. When uncertain, choose unsupported.",
  ].join("\n")
}

export function validateNlqQuestion(raw: unknown): NlqQuestionValidation {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Body must be a JSON object" }
  }
  const body = raw as Record<string, unknown>
  if (typeof body.question !== "string") {
    return { ok: false, error: "question must be a string" }
  }
  const question = body.question.trim()
  if (question.length < A4_NLQ_QUESTION_MIN) {
    return {
      ok: false,
      error: `question must be at least ${A4_NLQ_QUESTION_MIN} characters after trim`,
    }
  }
  if (question.length > A4_NLQ_QUESTION_MAX) {
    return {
      ok: false,
      error: `question must be at most ${A4_NLQ_QUESTION_MAX} characters`,
    }
  }
  return { ok: true, question }
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

/**
 * Parse and validate model output. Ignores any `count` / numeric answer fields.
 * Does not silently clamp out-of-range days.
 */
export function parseNlqIntent(rawText: string): NlqParseResult {
  const parsed = extractJsonObject(rawText)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { status: "invalid", reason: "Model output was not a JSON object" }
  }

  const obj = parsed as Record<string, unknown>
  const intent = obj.intent

  if (intent === "unsupported") {
    return {
      status: "unsupported",
      reason: "Question is outside supported A4 v1 intents",
    }
  }

  if (intent === "count_pending_tier3") {
    return { status: "ok", value: { intent: "count_pending_tier3" } }
  }

  if (intent === "count_actions_window") {
    let days = A4_NLQ_DAYS_DEFAULT
    if (obj.days !== undefined && obj.days !== null) {
      if (typeof obj.days !== "number" || !Number.isInteger(obj.days)) {
        return {
          status: "unsupported",
          reason: "days must be an integer when provided",
        }
      }
      if (obj.days < A4_NLQ_DAYS_MIN || obj.days > A4_NLQ_DAYS_MAX) {
        return {
          status: "unsupported",
          reason: `Supported window is ${A4_NLQ_DAYS_MIN}–${A4_NLQ_DAYS_MAX} days`,
        }
      }
      days = obj.days
    }

    let agentId: string | null = null
    if (obj.agentId !== undefined && obj.agentId !== null && obj.agentId !== "") {
      if (typeof obj.agentId !== "string") {
        return {
          status: "unsupported",
          reason: "agentId must be a string when provided",
        }
      }
      const id = obj.agentId.trim().toUpperCase()
      if (!A4_KNOWN_AGENT_IDS.has(id)) {
        return {
          status: "unsupported",
          reason: "agentId must be one of A1, A2, A3, A4",
        }
      }
      agentId = id
    }

    return {
      status: "ok",
      value: { intent: "count_actions_window", days, agentId },
    }
  }

  return {
    status: "unsupported",
    reason: "Unrecognized or missing intent",
  }
}

/**
 * Lexical evidence that the user question actually asks for a supported count.
 * Not a greeting blacklist and not a substitute for the LLM — a fail-closed
 * check after the model returns a supported intent (1.5B models over-fire).
 */
export function questionSupportsIntent(
  question: string,
  intent: NlqSupportedIntent["intent"]
): boolean {
  const q = question.toLowerCase()

  if (intent === "count_pending_tier3") {
    const pendingCue =
      /\bpending\b/.test(q) ||
      /\bawaiting\b/.test(q) ||
      /\bwaiting\b/.test(q)
    const approvalCue =
      /\bapproval\b/.test(q) ||
      /\bapprovals\b/.test(q) ||
      /\bapprove\b/.test(q) ||
      /\btier\s*3\b/.test(q) ||
      /\btier3\b/.test(q)
    return pendingCue && approvalCue
  }

  // count_actions_window
  const actionCue =
    /\bactions?\b/.test(q) ||
    /\bagents?\b/.test(q) ||
    /\ba[1-4]\b/.test(q)
  const countCue =
    /\bhow many\b/.test(q) ||
    /\bcount\b/.test(q) ||
    /\bnumber of\b/.test(q) ||
    /\brecorded\b/.test(q) ||
    /\bin the last\b/.test(q) ||
    /\bpast\s+\d+\b/.test(q) ||
    /\blast\s+\d+\s*days?\b/.test(q) ||
    /\bthis week\b/.test(q)
  return actionCue && countCue
}

/**
 * Parse model JSON, then downgrade supported intents that lack question evidence.
 */
export function resolveNlqIntentFromModel(
  question: string,
  rawModelText: string
): NlqParseResult {
  const parsed = parseNlqIntent(rawModelText)
  if (parsed.status !== "ok") return parsed

  if (!questionSupportsIntent(question, parsed.value.intent)) {
    return {
      status: "unsupported",
      reason:
        "Question does not match a supported A4 v1 count request (model intent rejected)",
    }
  }
  return parsed
}

/** Capability required to run a supported tool (beyond agents:query_nlq). */
export function capabilityForNlqIntent(
  intent: NlqSupportedIntent["intent"]
): Capability {
  if (intent === "count_pending_tier3") return "agents:decide_tier3"
  return "agents:view_actions"
}

export function roleMayRunNlqIntent(
  role: RoleName,
  intent: NlqSupportedIntent["intent"]
): boolean {
  return hasCapability(role, capabilityForNlqIntent(intent))
}

export async function runNlqTool(
  tenantPrisma: NlqTenantPrisma,
  resolved: NlqSupportedIntent,
  now: Date = new Date()
): Promise<NlqFacts> {
  if (resolved.intent === "count_pending_tier3") {
    const count = await tenantPrisma.agentAction.count({
      where: {
        tier: 3,
        status: "pending_approval",
      },
    })
    return { intent: "count_pending_tier3", count }
  }

  const since = new Date(now.getTime() - resolved.days * 24 * 60 * 60 * 1000)
  const where: Record<string, unknown> = {
    createdAt: { gte: since },
  }
  if (resolved.agentId) {
    where.agentId = resolved.agentId
  }
  const count = await tenantPrisma.agentAction.count({ where })
  return {
    intent: "count_actions_window",
    count,
    days: resolved.days,
    agentId: resolved.agentId,
    sinceIso: since.toISOString(),
  }
}

/**
 * Deterministic answer from grounded facts only — never invents counts.
 */
export function buildNlqAnswer(facts: NlqFacts): string {
  if (facts.intent === "count_pending_tier3") {
    const n = facts.count
    return `There ${n === 1 ? "is" : "are"} ${n} Tier 3 action${n === 1 ? "" : "s"} pending approval.`
  }

  const n = facts.count
  const agentLabel = facts.agentId ? ` for agent ${facts.agentId}` : ""
  const noun = n === 1 ? "action" : "actions"
  return `There ${n === 1 ? "is" : "are"} ${n} agent ${noun}${agentLabel} in the last ${facts.days} day${facts.days === 1 ? "" : "s"}.`
}

export function buildNlqActionText(question: string, facts: NlqFacts): string {
  const shortQ =
    question.length > 80 ? `${question.slice(0, 77)}...` : question
  return `A4 NLQ (${facts.intent}): ${shortQ}`
}

export function buildNlqInputPayload(input: {
  question: string
  facts: NlqFacts
  answer: string
  ollamaModel: string
}): Record<string, unknown> {
  return {
    agentId: "A4",
    actionType: A4_NLQ_ACTION_TYPE,
    question: input.question,
    intent: input.facts.intent,
    facts: input.facts,
    answer: input.answer,
    ollamaModel: input.ollamaModel,
    modelVersion: A4_NLQ_MODEL_VERSION,
    promptVersion: A4_NLQ_PROMPT_VERSION,
  }
}

export function buildNlqToolsUsed(facts: NlqFacts): unknown[] {
  if (facts.intent === "count_pending_tier3") {
    return [
      {
        name: "count_pending_tier3",
        args: { tier: 3, status: "pending_approval" },
        resultSummary: { count: facts.count },
      },
    ]
  }
  return [
    {
      name: "count_actions_window",
      args: { days: facts.days, agentId: facts.agentId },
      resultSummary: { count: facts.count, sinceIso: facts.sinceIso },
    },
  ]
}

/**
 * Extract grounded answer/facts for the Tier 1 handler. Fails closed if missing.
 */
export function extractNlqHandlerGrounding(inputPayload: unknown): {
  ok: true
  answer: string
  facts: NlqFacts
  intent: string
  question: string | null
  ollamaModel: string | null
} | {
  ok: false
  error: string
} {
  if (
    inputPayload === null ||
    typeof inputPayload !== "object" ||
    Array.isArray(inputPayload)
  ) {
    return { ok: false, error: "NLQ handler missing grounded inputPayload" }
  }
  const input = inputPayload as Record<string, unknown>
  if (typeof input.answer !== "string" || !input.answer.trim()) {
    return { ok: false, error: "NLQ handler missing grounded answer" }
  }
  const facts = input.facts
  if (facts === null || typeof facts !== "object" || Array.isArray(facts)) {
    return { ok: false, error: "NLQ handler missing grounded facts" }
  }
  const f = facts as Record<string, unknown>
  if (typeof f.count !== "number" || !Number.isFinite(f.count)) {
    return { ok: false, error: "NLQ handler facts.count missing or invalid" }
  }
  if (typeof f.intent !== "string") {
    return { ok: false, error: "NLQ handler facts.intent missing" }
  }
  return {
    ok: true,
    answer: input.answer.trim(),
    facts: facts as NlqFacts,
    intent: f.intent,
    question: typeof input.question === "string" ? input.question : null,
    ollamaModel:
      typeof input.ollamaModel === "string" ? input.ollamaModel : null,
  }
}
