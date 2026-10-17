import type { Request, Response, NextFunction } from "express"
import { verifyAccessToken, type JWTPayload } from "../lib/auth.js"
import { centralPrisma } from "../lib/prisma-central.js"
import { resolveTenantByInstitutionId } from "../lib/tenant-context.js"
import type { RoleName } from "../lib/permissions.js"
import type { PrismaClient as TenantClient } from "../../node_modules/.prisma/tenant-client/index.js"

// Extend Express Request interface to hold authenticated user and tenant prisma client
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & { email?: string; fullName?: string }
      tenantPrisma?: TenantClient
    }
  }
}

// In-memory cache for user and institution active checks (TTL: 30 seconds)
interface CachedUserState {
  userId: string
  institutionId: string
  userStatus: string
  institutionStatus: string
  roleName: string
  email: string
  fullName: string
  cachedAt: number
}

const userStateCache = new Map<string, CachedUserState>()

function getUserCacheTtlMs(): number {
  const envVal = process.env.USER_AUTH_CACHE_TTL_MS
  if (envVal !== undefined) {
    const parsed = Number.parseInt(envVal, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5000
  }
  return 5000 // 5 seconds default
}

// In-process cache invalidation; across multiple server instances or processes, the TTL is the true consistency guarantee.
export function invalidateUserAuthCache(userId: string): void {
  userStateCache.delete(userId)
}

export function clearUserAuthCache(): void {
  userStateCache.clear()
}

/**
 * Middleware: Verify JWT access token and attach user to req.user.
 * Returns 401 for missing, expired, or malformed tokens.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" })
    return
  }

  const token = authHeader.substring(7).trim()
  if (!token) {
    res.status(401).json({ error: "Bearer token missing" })
    return
  }

  try {
    const payload = verifyAccessToken(token)
    req.user = payload
    next()
  } catch {
    // Do not echo jsonwebtoken library messages (e.g. "jwt malformed") to clients
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

/**
 * Middleware: Verifies the authenticated user against central DB status,
 * verifies institution active status, ensures token institution matches the user's institution,
 * and attaches the tenant Prisma client to req.tenantPrisma.
 */
export async function resolveTenantContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "User is not authenticated" })
    return
  }

  const { userId, institutionId } = req.user
  const now = Date.now()
  const cached = userStateCache.get(userId)

  let userState: CachedUserState

  if (cached && now - cached.cachedAt < getUserCacheTtlMs()) {
    userState = cached
  } else {
    const user = await centralPrisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        institution: true,
      },
    })

    if (!user) {
      res.status(401).json({ error: "User account no longer exists" })
      return
    }

    userState = {
      userId: user.id,
      institutionId: user.institutionId,
      userStatus: user.status,
      institutionStatus: user.institution.status,
      roleName: user.role.name,
      email: user.email,
      fullName: user.fullName,
      cachedAt: now,
    }

    userStateCache.set(userId, userState)
  }

  // Refuse if user was disabled while holding a valid token
  if (userState.userStatus !== "active") {
    res.status(401).json({ error: "User account has been disabled" })
    return
  }

  // Refuse if institution is not active
  if (userState.institutionStatus !== "active") {
    res.status(403).json({ error: "Institution account is not active" })
    return
  }

  // Enforce tenant boundary: token institutionId must match user's actual institution in central
  if (userState.institutionId !== institutionId) {
    res.status(403).json({ error: "Token institution does not match user institution" })
    return
  }

  // Update attached details from latest central query
  req.user.email = userState.email
  req.user.fullName = userState.fullName

  // Resolve tenant Prisma client for the institution
  const resolved = await resolveTenantByInstitutionId(institutionId)
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.message })
    return
  }

  req.tenantPrisma = resolved.prisma
  next()
}

/**
 * Middleware: Role-Based Access Control (RBAC).
 * Restricts access to one or more allowed roles.
 * Returns 403 Forbidden if user role is not in the allowed list.
 */
export function requireRole(...allowedRoles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" })
      return
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
      })
      return
    }

    next()
  }
}
