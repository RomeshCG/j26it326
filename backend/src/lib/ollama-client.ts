/**
 * Thin Ollama HTTP client for A4 NLQ intent classification and knowledge JSON.
 *
 * Fail-closed: missing base URL, timeouts, and non-OK responses throw.
 * Does not invent structured content — callers must validate JSON schema.
 */

export type OllamaErrorCode =
  | "timeout"
  | "empty"
  | "http"
  | "network"
  | "config"

export class OllamaUnavailableError extends Error {
  readonly code: OllamaErrorCode
  /** Upstream HTTP status when code === "http"; otherwise null. */
  readonly httpStatus: number | null

  constructor(
    message: string,
    code: OllamaErrorCode = "network",
    httpStatus: number | null = null
  ) {
    super(message)
    this.name = "OllamaUnavailableError"
    this.code = code
    this.httpStatus = httpStatus
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

/** Bounds for optional `num_predict` (Ollama generation token ceiling). */
export const OLLAMA_NUM_PREDICT_MIN = 64
export const OLLAMA_NUM_PREDICT_MAX = 4096

/** Max chars of sanitized upstream body kept for server-side diagnostics. */
export const OLLAMA_ERROR_BODY_LOG_MAX = 240

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
  /**
   * Sampling temperature. Default 0 (NLQ intent classification).
   * Knowledge answers may use a small positive value.
   */
  temperature?: number
  /**
   * Optional Ollama `options.num_predict` (max new tokens).
   * Omit for NLQ intent. Knowledge callers pass an explicit ceiling.
   * Precedence: explicit option → `OLLAMA_NUM_PREDICT` env (if valid) → omit.
   */
  numPredict?: number
  /** Injected for offline tests */
  fetchImpl?: typeof fetch
  /** Injected for offline tests (default console.warn) */
  warnImpl?: (message: string) => void
}

function resolveBaseUrl(override?: string): string {
  const raw = (override ?? process.env.OLLAMA_BASE_URL ?? "").trim()
  if (!raw) {
    throw new OllamaUnavailableError(
      "OLLAMA_BASE_URL is not configured (NLQ model unavailable)",
      "config"
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
 * Resolve optional `num_predict`. Returns null when the caller should omit it
 * (NLQ intent default). Explicit option wins over env.
 */
export function resolveOllamaNumPredict(override?: number): number | null {
  if (
    typeof override === "number" &&
    Number.isFinite(override) &&
    Number.isInteger(override) &&
    override >= OLLAMA_NUM_PREDICT_MIN &&
    override <= OLLAMA_NUM_PREDICT_MAX
  ) {
    return override
  }

  const raw = (process.env.OLLAMA_NUM_PREDICT ?? "").trim()
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (
      Number.isFinite(parsed) &&
      parsed >= OLLAMA_NUM_PREDICT_MIN &&
      parsed <= OLLAMA_NUM_PREDICT_MAX
    ) {
      return parsed
    }
  }

  return null
}

/**
 * Sanitize an upstream error body for server logs only.
 * Strips URLs, emails, long tokens; caps length. Never return this to clients.
 */
export function sanitizeOllamaErrorBodyForLog(
  raw: string,
  maxLen: number = OLLAMA_ERROR_BODY_LOG_MAX
): string {
  let s = raw.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim()
  s = s.replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
  s = s.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
  // Long hex / bearer-like tokens
  s = s.replace(/\b[A-Fa-f0-9]{32,}\b/g, "[redacted-hex]")
  s = s.replace(
    /\b(Bearer\s+)[A-Za-z0-9._\-]+\b/gi,
    "$1[redacted-token]"
  )
  s = s.replace(
    /\b(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi,
    "$1=[redacted]"
  )
  if (s.length > maxLen) {
    s = s.slice(0, maxLen) + "…"
  }
  return s
}

async function readErrorBodyExcerpt(res: Response): Promise<string | null> {
  try {
    const text = await res.text()
    if (!text || !text.trim()) return null
    return sanitizeOllamaErrorBodyForLog(text)
  } catch {
    return null
  }
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
  const numPredict = resolveOllamaNumPredict(options.numPredict)
  const fetchImpl = options.fetchImpl ?? fetch
  const warnImpl = options.warnImpl ?? ((msg: string) => console.warn(msg))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const ollamaOptions: Record<string, number> = {
    temperature:
      typeof options.temperature === "number" &&
      Number.isFinite(options.temperature)
        ? Math.min(1, Math.max(0, options.temperature))
        : 0,
  }
  if (numPredict != null) {
    ollamaOptions.num_predict = numPredict
  }

  try {
    const res = await fetchImpl(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: options.messages,
        stream: false,
        format: "json",
        options: ollamaOptions,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const excerpt = await readErrorBodyExcerpt(res)
      if (excerpt) {
        warnImpl(
          `[ollama-client] upstream HTTP ${res.status} body_excerpt=${excerpt}`
        )
      } else {
        warnImpl(
          `[ollama-client] upstream HTTP ${res.status} body_excerpt=(empty)`
        )
      }
      throw new OllamaUnavailableError(
        `Ollama HTTP ${res.status} (NLQ model unavailable)`,
        "http",
        res.status
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
        "Ollama returned empty content (NLQ model unavailable)",
        "empty"
      )
    }
    return { content: content.trim(), model }
  } catch (err: unknown) {
    if (err instanceof OllamaUnavailableError) throw err
    if (err instanceof Error && err.name === "AbortError") {
      throw new OllamaUnavailableError(
        "Ollama request timed out (NLQ model unavailable)",
        "timeout"
      )
    }
    const msg = err instanceof Error ? err.message : String(err)
    // Do not echo hostnames/URLs from fetch errors into the message beyond a short slice.
    const safe = msg.replace(/https?:\/\/[^\s]+/gi, "[redacted]").slice(0, 200)
    throw new OllamaUnavailableError(
      `Ollama request failed: ${safe}`,
      "network"
    )
  } finally {
    clearTimeout(timer)
  }
}
