import crypto from "crypto"
import express from "express"
import { provisionTenant } from "../lib/provisioning-service.js"
import { logSafeError } from "../lib/auth.js"

export const registrationRouter = express.Router()

/**
 * Timing-safe string comparison
 */
export function safeCompareKeys(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison to equalize timing
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

export interface RegistrationGateOptions {
  enabled?: boolean | string
  nodeEnv?: string
  configuredKey?: string | null
  clientKey?: string | null
}

export interface RegistrationGateResult {
  allowed: boolean
  status: number
  error?: string
}

/**
 * Pure evaluation function for registration abuse gate matrix
 */
export function evaluateRegistrationGate(opts: RegistrationGateOptions): RegistrationGateResult {
  const isEnabled = opts.enabled === true || opts.enabled === "true"
  if (!isEnabled) {
    return { allowed: false, status: 403, error: "Public institution registration is currently disabled." }
  }

  const isProduction = opts.nodeEnv === "production"
  if (isProduction) {
    const configuredKey = opts.configuredKey?.trim()
    if (!configuredKey) {
      return { allowed: false, status: 403, error: "Public institution registration is currently disabled." }
    }

    const clientKey = opts.clientKey ?? ""
    if (!safeCompareKeys(clientKey, configuredKey)) {
      return { allowed: false, status: 403, error: "Invalid registration setup key." }
    }
  }

  return { allowed: true, status: 200 }
}

/**
 * Public Endpoint: POST /auth/register-institution
 * Gated behind ENABLE_PUBLIC_TENANT_REGISTRATION and production setup key.
 */
registrationRouter.post("/register-institution", async (req, res) => {
  // 1. Abuse Gate Check
  const gateResult = evaluateRegistrationGate({
    enabled: process.env.ENABLE_PUBLIC_TENANT_REGISTRATION,
    nodeEnv: process.env.NODE_ENV,
    configuredKey: process.env.REGISTRATION_SETUP_KEY,
    clientKey: req.header("x-registration-setup-key"),
  })

  if (!gateResult.allowed) {
    res.status(gateResult.status).json({ error: gateResult.error })
    return
  }

  // 2. Delegate to Provisioning Service
  try {
    const {
      institutionName,
      licenseNumber,
      adminFullName,
      adminEmail,
      adminPassword,
      institutionType,
      district,
      planName,
      billingCycle,
    } = req.body ?? {}

    // Security: Do NOT pass any internal test hook parameters from request body
    const result = await provisionTenant({
      institutionName,
      licenseNumber,
      adminFullName,
      adminEmail,
      adminPassword,
      institutionType,
      district,
      planName,
      billingCycle,
    })

    if (!result.success) {
      res.status(result.status).json({ error: result.error })
      return
    }

    res.status(result.status).json(result.data)
  } catch (error) {
    logSafeError("[registration-route] Unexpected error", error)
    res.status(500).json({ error: "Failed to process registration request" })
  }
})
