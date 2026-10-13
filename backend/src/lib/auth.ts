import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { centralPrisma } from "./prisma-central.js"
import type { RoleName } from "./permissions.js"

export const JWT_ISSUER = "imfs-auth"
export const JWT_ALGORITHM = "HS256"

export interface JWTPayload {
  userId: string
  institutionId: string
  role: RoleName
}

/**
 * Validates and retrieves the JWT_SECRET from environment.
 * The server refuses to operate if JWT_SECRET is missing, is a known placeholder,
 * or is shorter than 32 characters.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()

  if (!secret) {
    throw new Error("JWT_SECRET environment variable is missing. Server cannot start.")
  }

  const placeholderValues = [
    "replace-with-a-secure-random-secret",
    "replace-with-a-secure-random-secret-at-least-32-chars-long",
    "your-jwt-secret",
    "secret",
    "changeme",
  ]

  if (placeholderValues.includes(secret.toLowerCase())) {
    throw new Error("JWT_SECRET must not use a placeholder value. Provide a real secret.")
  }

  if (secret.length < 32) {
    throw new Error(`JWT_SECRET must be at least 32 characters long (current length: ${secret.length}).`)
  }

  return secret
}

/**
 * Sign an access token using HS256 and configured expiration.
 */
export function signAccessToken(payload: JWTPayload): string {
  const secret = getJwtSecret()
  const rawExpiresIn = process.env.JWT_EXPIRES_IN ?? "15m"
  const options: jwt.SignOptions = {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    expiresIn: (rawExpiresIn as unknown as jwt.SignOptions["expiresIn"]),
  }

  return jwt.sign(payload, secret, options)
}

/**
 * Verify and decode an access token using HS256 and strict issuer checks.
 */
export function verifyAccessToken(token: string): JWTPayload {
  const secret = getJwtSecret()

  const decoded = jwt.verify(token, secret, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER,
  }) as jwt.JwtPayload & JWTPayload

  if (!decoded.userId || !decoded.institutionId || !decoded.role) {
    throw new Error("Invalid token payload structure")
  }

  return {
    userId: decoded.userId,
    institutionId: decoded.institutionId,
    role: decoded.role,
  }
}

export const BCRYPT_SALT_ROUNDS = 10

/**
 * Hash a plain-text password using bcrypt with salt rounds >= 10.
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_SALT_ROUNDS)
}

// Generate dummy hash dynamically at module load using the same bcrypt cost
export const DUMMY_HASH = bcrypt.hashSync("dummy-password-timing-parity", BCRYPT_SALT_ROUNDS)

/**
 * Verify a plain-text password against a bcrypt hash.
 * If passwordHash is not provided, runs comparison against DUMMY_HASH to maintain constant-time response.
 */
export async function comparePassword(plainText: string, passwordHash?: string | null): Promise<boolean> {
  if (!passwordHash) {
    await bcrypt.compare(plainText, DUMMY_HASH)
    return false
  }
  return bcrypt.compare(plainText, passwordHash)
}

/**
 * Safe error logger: logs only error name, error codes, and context without echoing raw parameters, hashes, or URLs.
 */
export function logSafeError(context: string, error: unknown): void {
  const err = error as any
  const errName = err?.name ?? "Error"
  const codeVal = err?.code ?? err?.errorCode
  const prismaCode = codeVal ? ` [Code: ${codeVal}]` : ""
  let message = "Unknown error"
  if (err?.message) {
    const lines = String(err.message).split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
    if (lines.length > 0) {
      message = lines[0].substring(0, 120)
    }
  }
  console.error(`${context}: ${errName}${prismaCode} - ${message}`)
}

/**
 * Record a login audit event to central.login_audit.
 */
export async function recordLoginAudit(params: {
  userId?: string | null
  event: "login_success" | "login_failed" | "account_disabled" | "institution_inactive"
  ipAddress?: string | null
}): Promise<void> {
  try {
    if (params.userId) {
      await centralPrisma.loginAudit.create({
        data: {
          userId: params.userId,
          event: params.event,
          ipAddress: params.ipAddress ?? null,
        },
      })
    } else {
      // If user is unknown, we cannot write to central.login_audit because user_id is non-nullable.
      // In production/Phase 2b this can be logged to a system security log.
    }
  } catch (error) {
    logSafeError("[auth] Failed to record login audit", error)
  }
}

export interface UserValidationResult {
  valid: boolean
  user?: {
    id: string
    institutionId: string
    roleId: number
    roleName: string
    fullName: string
    email: string
    status: string
  }
  error?: string
}

/**
 * Shared helper that checks central.users for soft reference validation.
 * Verifies user exists, has status 'active', and belongs to the specified institution.
 * Exported for M1, M2, and M3.
 */
export async function validateUserId(
  userId: string,
  institutionId: string
): Promise<UserValidationResult> {
  if (!userId || !institutionId) {
    return { valid: false, error: "userId and institutionId are required" }
  }

  const user = await centralPrisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  })

  if (!user) {
    return { valid: false, error: `User '${userId}' not found` }
  }

  if (user.institutionId !== institutionId) {
    return {
      valid: false,
      error: `User '${userId}' does not belong to institution '${institutionId}'`,
    }
  }

  if (user.status !== "active") {
    return {
      valid: false,
      error: `User '${userId}' account is not active (status: ${user.status})`,
    }
  }

  return {
    valid: true,
    user: {
      id: user.id,
      institutionId: user.institutionId,
      roleId: user.roleId,
      roleName: user.role.name,
      fullName: user.fullName,
      email: user.email,
      status: user.status,
    },
  }
}
