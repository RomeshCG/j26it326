/**
 * Thin Ollama HTTP client for A4 NLQ intent classification.
 *
 * Fail-closed: missing base URL, timeouts, and non-OK responses throw.
 * Does not invent structured content — callers must validate JSON schema.
 */

export class OllamaUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OllamaUnavailableError"
  }
}

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

/** A4 v1 default: allows cold model load over Tailscale; warm calls are ~4s. */
export const OLLAMA_TIMEOUT_MS_DEFAULT = 30_000
export const OLLAMA_TIMEOUT_MS_MIN = 1_000
export const OLLAMA_TIMEOUT_MS_MAX = 120_000

export type OllamaChatJsonOptions = {
  messages: OllamaChatMessage[]
  /** Override process.env.OLLAMA_MODEL */
  model?: string
  /** Override process.env.OLLAMA_BASE_URL */
  baseUrl?: string
  /**
   * Override timeout. Precedence: explicit option → `OLLAMA_TIMEOUT_MS` →
   * {@link OLLAMA_TIMEOUT_MS_DEFAULT} (30s).
   */
  timeoutMs?: number
  /** Injected for offline tests */
  fetchImpl?: typeof fetch
}

function resolveBaseUrl(override?: string): string {
  const raw = (override ?? process.env.OLLAMA_BASE_URL ?? "").trim()
  if (!raw) {
    throw new OllamaUnavailableError(
      "OLLAMA_BASE_URL is not configured (NLQ model unavailable)"
    )
  }
  return raw.replace(/\/+$/, "")
}

function resolveModel(override?: string): string {
  const raw = (override ?? process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b").trim()
  return raw || "qwen2.5:1.5b"
}

/**
 * Resolve chat timeout in ms.
 * - Explicit `timeoutMs`: positive integer, capped at MAX (short values OK for tests).
 * - `OLLAMA_TIMEOUT_MS` env: must be in [MIN, MAX]; invalid → default.
 * - Else: {@link OLLAMA_TIMEOUT_MS_DEFAULT} (30s).
 */
export function resolveOllamaTimeoutMs(override?: number): number {
  if (
    typeof override === "number" &&
    Number.isFinite(override) &&
    Number.isInteger(override) &&
    override > 0
  ) {
    return Math.min(override, OLLAMA_TIMEOUT_MS_MAX)
  }

  const raw = (process.env.OLLAMA_TIMEOUT_MS ?? "").trim()
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (
      Number.isFinite(parsed) &&
      parsed >= OLLAMA_TIMEOUT_MS_MIN &&
      parsed <= OLLAMA_TIMEOUT_MS_MAX
    ) {
      return parsed
    }
  }

  return OLLAMA_TIMEOUT_MS_DEFAULT
}

/**
 * POST /api/chat with format=json. Returns the assistant message content string.
 */
export async function ollamaChatJson(
  options: OllamaChatJsonOptions
): Promise<{ content: string; model: string }> {
  const baseUrl = resolveBaseUrl(options.baseUrl)
  const model = resolveModel(options.model)
  const timeoutMs = resolveOllamaTimeoutMs(options.timeoutMs)
  const fetchImpl = options.fetchImpl ?? fetch

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetchImpl(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: options.messages,
        stream: false,
        format: "json",
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new OllamaUnavailableError(
        `Ollama HTTP ${res.status} (NLQ model unavailable)`
      )
    }

    const body = (await res.json()) as {
      message?: { content?: unknown }
    }
    const content =
      body?.message && typeof body.message.content === "string"
        ? body.message.content
        : null
    if (!content || !content.trim()) {
      throw new OllamaUnavailableError(
        "Ollama returned empty content (NLQ model unavailable)"
      )
    }
    return { content: content.trim(), model }
  } catch (err: unknown) {
    if (err instanceof OllamaUnavailableError) throw err
    if (err instanceof Error && err.name === "AbortError") {
      throw new OllamaUnavailableError(
        "Ollama request timed out (NLQ model unavailable)"
      )
    }
    const msg = err instanceof Error ? err.message : String(err)
    throw new OllamaUnavailableError(
      `Ollama request failed: ${msg.slice(0, 200)}`
    )
  } finally {
    clearTimeout(timer)
  }
}
