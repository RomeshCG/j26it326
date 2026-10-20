/**
 * A4 domain classifier — Node inference for TF-IDF + Logistic Regression JSON.
 * Parity target: agents/artifacts/a4_domain/a4-domain-clf-improve-v1-lr_mindf1.json
 * No Ollama; no Python sidecar at runtime.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export const A4_DOMAIN_CLF_SPEC_ID =
  "a4-domain-clf-improve-v1-lr_mindf1" as const

export type A4DomainLabel = "finance" | "off_topic" | "mixed"

export type A4DomainClfArtifact = {
  spec_id: string
  format_version: number
  feature_order: string[]
  word: VectorizerExport
  char: VectorizerExport
  classifier: {
    type: string
    classes: string[]
    coef: number[][]
    intercept: number[]
  }
  policy_defaults?: {
    tau_rescue?: number
    tau_veto?: number
    mode_default?: string
  }
}

type VectorizerExport = {
  analyzer: "word" | "char_wb" | string
  ngram_range: [number, number]
  sublinear_tf: boolean
  lowercase: boolean
  strip_accents: "unicode" | "ascii" | null
  norm: "l1" | "l2" | null
  token_pattern: string | null
  vocabulary: Record<string, number>
  idf: number[]
  n_features: number
}

export type A4DomainPrediction = {
  pred: A4DomainLabel
  proba: Record<A4DomainLabel, number>
  pFinance: number
  pOffTopic: number
  pMixed: number
  specId: string
}

/** Mirrors sklearn `(?u)\\b\\w\\w+\\b` (Unicode word chars, length ≥ 2). */
const WORD_TOKEN_RE = /\b\w\w+\b/gu

/** NFKD + drop combining marks — mirrors sklearn strip_accents='unicode'. */
export function stripAccentsUnicode(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "")
}

function prepareText(text: string, strip: VectorizerExport["strip_accents"], lower: boolean): string {
  let t = text
  if (strip === "unicode") t = stripAccentsUnicode(t)
  else if (strip === "ascii") {
    t = stripAccentsUnicode(t).replace(/[^\x00-\x7F]/g, "")
  }
  if (lower) t = t.toLowerCase()
  return t
}

function wordTokens(text: string): string[] {
  const out: string[] = []
  WORD_TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WORD_TOKEN_RE.exec(text)) !== null) {
    out.push(m[0])
  }
  return out
}

function wordNgrams(tokens: string[], nmin: number, nmax: number): string[] {
  const grams: string[] = []
  for (let n = nmin; n <= nmax; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      grams.push(tokens.slice(i, i + n).join(" "))
    }
  }
  return grams
}

/** sklearn char_wb n-grams */
function charWbNgrams(text: string, nmin: number, nmax: number): string[] {
  const grams: string[] = []
  // Split on whitespace like sklearn (_char_wb_ngrams)
  const words = text.split(/\s+/)
  for (const w of words) {
    if (!w) continue
    const padded = ` ${w} `
    const L = padded.length
    for (let n = nmin; n <= nmax; n++) {
      if (L < n) continue
      for (let i = 0; i + n <= L; i++) {
        grams.push(padded.slice(i, i + n))
      }
    }
  }
  return grams
}

function vectorize(text: string, vec: VectorizerExport): Float64Array {
  const prepared = prepareText(text, vec.strip_accents, vec.lowercase)
  const [nmin, nmax] = vec.ngram_range
  let grams: string[]
  if (vec.analyzer === "word") {
    grams = wordNgrams(wordTokens(prepared), nmin, nmax)
  } else if (vec.analyzer === "char_wb") {
    grams = charWbNgrams(prepared, nmin, nmax)
  } else {
    throw new Error(`Unsupported analyzer: ${vec.analyzer}`)
  }

  const counts = new Map<number, number>()
  for (const g of grams) {
    const idx = vec.vocabulary[g]
    if (idx === undefined) continue
    counts.set(idx, (counts.get(idx) ?? 0) + 1)
  }

  const n = vec.n_features
  const values = new Float64Array(n)
  let sumSq = 0
  for (const [idx, tfRaw] of counts) {
    let tf = tfRaw
    if (vec.sublinear_tf) tf = 1 + Math.log(tf)
    const v = tf * vec.idf[idx]
    values[idx] = v
    sumSq += v * v
  }
  if (vec.norm === "l2" && sumSq > 0) {
    const inv = 1 / Math.sqrt(sumSq)
    for (let i = 0; i < n; i++) {
      if (values[i] !== 0) values[i] *= inv
    }
  }
  return values
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits)
  const exps = logits.map((z) => Math.exp(z - max))
  const s = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / s)
}

export function predictA4Domain(
  text: string,
  artifact: A4DomainClfArtifact
): A4DomainPrediction {
  const word = vectorize(text, artifact.word)
  const char = vectorize(text, artifact.char)
  const dim = word.length + char.length
  const x = new Float64Array(dim)
  x.set(word, 0)
  x.set(char, word.length)

  const { coef, intercept, classes } = artifact.classifier
  if (coef[0].length !== dim) {
    throw new Error(
      `coef dim mismatch: coef=${coef[0].length} features=${dim}`
    )
  }
  const logits = intercept.map((b, c) => {
    let s = b
    const row = coef[c]
    for (let j = 0; j < dim; j++) {
      const v = x[j]
      if (v !== 0) s += v * row[j]
    }
    return s
  })
  const probs = softmax(logits)
  const proba = {
    finance: 0,
    off_topic: 0,
    mixed: 0,
  } as Record<A4DomainLabel, number>
  let bestI = 0
  for (let i = 0; i < classes.length; i++) {
    const lab = classes[i] as A4DomainLabel
    proba[lab] = probs[i]
    if (probs[i] > probs[bestI]) bestI = i
  }
  return {
    pred: classes[bestI] as A4DomainLabel,
    proba,
    pFinance: proba.finance,
    pOffTopic: proba.off_topic,
    pMixed: proba.mixed,
    specId: artifact.spec_id,
  }
}

let cached: A4DomainClfArtifact | null = null
let cachedPath: string | null = null

/** Default path: repo agents/artifacts (dev) — overridable via env. */
export function defaultA4DomainClfJsonPath(): string {
  const env = (process.env.A4_DOMAIN_CLF_JSON ?? "").trim()
  if (env) return env
  const here = dirname(fileURLToPath(import.meta.url))
  // backend/src/lib → repo root
  return join(
    here,
    "..",
    "..",
    "..",
    "agents",
    "artifacts",
    "a4_domain",
    "a4-domain-clf-improve-v1-lr_mindf1.json"
  )
}

export function loadA4DomainClfArtifact(
  path?: string
): A4DomainClfArtifact {
  const p = path ?? defaultA4DomainClfJsonPath()
  if (cached && cachedPath === p) return cached
  const raw = readFileSync(p, "utf8")
  const art = JSON.parse(raw) as A4DomainClfArtifact
  if (!art || art.format_version !== 1 || !art.classifier?.coef) {
    throw new Error("Malformed A4 domain classifier artifact")
  }
  if (art.spec_id !== A4_DOMAIN_CLF_SPEC_ID) {
    throw new Error(`Unexpected clf spec_id: ${art.spec_id}`)
  }
  cached = art
  cachedPath = p
  return art
}

/** Test helper — clear module cache. */
export function clearA4DomainClfCache(): void {
  cached = null
  cachedPath = null
}

export function tryPredictA4Domain(
  text: string,
  path?: string
):
  | { ok: true; prediction: A4DomainPrediction }
  | { ok: false; error: string } {
  try {
    const art = loadA4DomainClfArtifact(path)
    return { ok: true, prediction: predictA4Domain(text, art) }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg.slice(0, 200) }
  }
}
