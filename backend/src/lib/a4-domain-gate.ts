/**
 * A4 knowledge-domain gate: Stage-0 + optional ML (off | shadow | enforce).
 *
 * Enforce policy (default `ml_tau`): allow generative knowledge iff
 *   pred === "finance" && pFinance >= tau
 * Stage-0 remains the production path when mode=off; shadow logs ML without
 * changing responses. Hybrid_v1 optional via A4_DOMAIN_ML_POLICY.
 *
 * Never grants institutional data / NLQ / GT permissions — knowledge eligibility only.
 */

import {
  questionSuggestsA4KnowledgeTopic,
} from "./agent-a4-knowledge.js"
import {
  tryPredictA4Domain,
  type A4DomainPrediction,
} from "./a4-domain-clf.js"

export type A4DomainMlMode = "off" | "shadow" | "enforce"
export type A4DomainMlPolicy = "ml_tau" | "hybrid_v1"

export const A4_DOMAIN_ML_TAU_DEFAULT = 0.45
export const A4_DOMAIN_ML_TAU_VETO_DEFAULT = 0.5

export type A4DomainGateDecision = {
  /** Whether generative knowledge Ollama may run (after grounded card miss). */
  allowKnowledge: boolean
  mode: A4DomainMlMode
  policy: A4DomainMlPolicy
  stage0Allow: boolean
  /** What enforce would decide (always computed when ML ok). */
  enforceWouldAllow: boolean | null
  ml: A4DomainPrediction | null
  mlError: string | null
  tau: number
  tauVeto: number
  reason:
    | "mode_off_stage0"
    | "shadow_stage0"
    | "enforce_ml_finance"
    | "enforce_ml_refuse"
    | "enforce_hybrid_allow"
    | "enforce_hybrid_refuse"
    | "enforce_fail_closed"
}

export function resolveA4DomainMlMode(
  env: NodeJS.ProcessEnv = process.env
): A4DomainMlMode {
  const raw = (env.A4_DOMAIN_ML_MODE ?? "off").trim().toLowerCase()
  if (raw === "shadow" || raw === "enforce" || raw === "off") return raw
  return "off"
}

export function resolveA4DomainMlPolicy(
  env: NodeJS.ProcessEnv = process.env
): A4DomainMlPolicy {
  const raw = (env.A4_DOMAIN_ML_POLICY ?? "ml_tau").trim().toLowerCase()
  if (raw === "hybrid_v1") return "hybrid_v1"
  return "ml_tau"
}

export function resolveA4DomainMlTau(
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = (env.A4_DOMAIN_ML_TAU ?? "").trim()
  if (raw) {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n
  }
  return A4_DOMAIN_ML_TAU_DEFAULT
}

export function resolveA4DomainMlTauVeto(
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = (env.A4_DOMAIN_ML_TAU_VETO ?? "").trim()
  if (raw) {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n
  }
  return A4_DOMAIN_ML_TAU_VETO_DEFAULT
}

export function mlTauAllows(
  ml: A4DomainPrediction,
  tau: number
): boolean {
  return ml.pred === "finance" && ml.pFinance >= tau
}

/**
 * hybrid_v1: Stage-0 allow unless ML confident off_topic; else rescue finance∧τ.
 * Higher FA on val than ml_tau — kept for A/B only.
 */
export function hybridV1Allows(
  stage0Allow: boolean,
  ml: A4DomainPrediction,
  tauRescue: number,
  tauVeto: number
): boolean {
  if (stage0Allow) {
    const veto = ml.pred === "off_topic" && ml.pOffTopic >= tauVeto
    return !veto
  }
  return mlTauAllows(ml, tauRescue)
}

export function evaluateEnforceAllow(
  stage0Allow: boolean,
  ml: A4DomainPrediction,
  policy: A4DomainMlPolicy,
  tau: number,
  tauVeto: number
): boolean {
  if (policy === "hybrid_v1") {
    return hybridV1Allows(stage0Allow, ml, tau, tauVeto)
  }
  return mlTauAllows(ml, tau)
}

/**
 * Resolve knowledge-domain eligibility for the generative path.
 * Call only after hardRefuse / NLQ / grounded card handling.
 */
export function resolveA4KnowledgeDomainGate(
  question: string,
  options?: {
    env?: NodeJS.ProcessEnv
    /** Inject prediction for tests */
    ml?: A4DomainPrediction | null
    mlError?: string | null
    stage0Allow?: boolean
  }
): A4DomainGateDecision {
  const env = options?.env ?? process.env
  const mode = resolveA4DomainMlMode(env)
  const policy = resolveA4DomainMlPolicy(env)
  const tau = resolveA4DomainMlTau(env)
  const tauVeto = resolveA4DomainMlTauVeto(env)
  const stage0Allow =
    options?.stage0Allow ?? questionSuggestsA4KnowledgeTopic(question)

  let ml: A4DomainPrediction | null = options?.ml ?? null
  let mlError: string | null = options?.mlError ?? null

  if (mode !== "off" && ml === null && mlError === null) {
    // Honor A4_DOMAIN_CLF_JSON from the same env snapshot as mode (not only process.env),
    // so enforce fail-closed works under isolated tests / injected env.
    const clfPath = (env.A4_DOMAIN_CLF_JSON ?? "").trim() || undefined
    const tried = tryPredictA4Domain(question, clfPath)
    if (tried.ok) ml = tried.prediction
    else mlError = tried.error
  }

  const enforceWouldAllow =
    ml && !mlError
      ? evaluateEnforceAllow(stage0Allow, ml, policy, tau, tauVeto)
      : null

  if (mode === "off") {
    return {
      allowKnowledge: stage0Allow,
      mode,
      policy,
      stage0Allow,
      enforceWouldAllow,
      ml: null,
      mlError: null,
      tau,
      tauVeto,
      reason: "mode_off_stage0",
    }
  }

  if (mode === "shadow") {
    return {
      allowKnowledge: stage0Allow,
      mode,
      policy,
      stage0Allow,
      enforceWouldAllow,
      ml,
      mlError,
      tau,
      tauVeto,
      reason: "shadow_stage0",
    }
  }

  // enforce
  if (mlError || !ml) {
    return {
      allowKnowledge: false,
      mode,
      policy,
      stage0Allow,
      enforceWouldAllow: false,
      ml,
      mlError: mlError ?? "missing_prediction",
      tau,
      tauVeto,
      reason: "enforce_fail_closed",
    }
  }

  const allow = evaluateEnforceAllow(stage0Allow, ml, policy, tau, tauVeto)
  if (policy === "hybrid_v1") {
    return {
      allowKnowledge: allow,
      mode,
      policy,
      stage0Allow,
      enforceWouldAllow: allow,
      ml,
      mlError: null,
      tau,
      tauVeto,
      reason: allow ? "enforce_hybrid_allow" : "enforce_hybrid_refuse",
    }
  }
  return {
    allowKnowledge: allow,
    mode,
    policy,
    stage0Allow,
    enforceWouldAllow: allow,
    ml,
    mlError: null,
    tau,
    tauVeto,
    reason: allow ? "enforce_ml_finance" : "enforce_ml_refuse",
  }
}

/** Safe telemetry fragment for logs / optional response meta (no raw question). */
export function domainGateTelemetry(
  d: A4DomainGateDecision
): Record<string, unknown> {
  return {
    mode: d.mode,
    policy: d.policy,
    stage0Allow: d.stage0Allow,
    allowKnowledge: d.allowKnowledge,
    enforceWouldAllow: d.enforceWouldAllow,
    reason: d.reason,
    tau: d.tau,
    mlPred: d.ml?.pred ?? null,
    pFinance: d.ml ? round4(d.ml.pFinance) : null,
    mlError: d.mlError,
    specId: d.ml?.specId ?? null,
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
