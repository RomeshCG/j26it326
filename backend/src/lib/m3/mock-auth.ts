/**
 * M3 — Real JWT auth adapter (replaces mock-auth.ts)
 * ====================================================
 * Delegates authentication and tenant resolution to M4's middleware:
 *   authenticate        → verifies Bearer JWT, attaches req.user (JWTPayload)
 *   resolveTenantContext → validates user/institution in central DB,
 *                          attaches req.tenantPrisma (tenant PrismaClient)
 *   requireRole         → RBAC guard identical to the M4 interface
 *
 * M3 routes that previously imported from "./mock-auth.js" now import from
 * this file with the same symbol names so the route files need NO changes
 * beyond the import path.
 *
 * req.auth (legacy mock shape) is populated here for backwards compatibility
 * with any existing handler that reads req.auth.userId / req.auth.role.
 */
import type { Request, Response, NextFunction } from "express"
import {
  authenticate as _authenticate,
  resolveTenantContext as _resolveTenantContext,
  requireRole as _requireRole,
} from "../../middleware/auth.js"
import type { RoleName } from "../../lib/permissions.js"

// Re-export the standard M4 type so route files can import it
export type { RoleName }

// Backwards-compatible legacy shape used by older handler code (req.auth)
export interface AuthContext {
  userId: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

/**
 * Step 1 — verify JWT Bearer token.
 * Attaches req.user (JWTPayload) on success.
 * Also back-fills req.auth for any handler still reading the legacy shape.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  _authenticate(req, res, () => {
    // Back-fill legacy req.auth from the real JWT payload
    if (req.user) {
      req.auth = {
        userId: req.user.userId,
        role:   req.user.role,
      }
    }
    next()
  })
}

/**
 * Step 2 — resolve tenant Prisma client via M4 resolveTenantContext.
 * Call this after requireAuth when you need DB access.
 * req.tenantPrisma is attached on success.
 */
export async function resolveTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return _resolveTenantContext(req, res, next)
}

/**
 * RBAC guard — thin wrapper so M3 routes can call requireRole() with the
 * same string literals they used against the old mock-auth.
 */
export function requireRole(...allowed: string[]) {
  return _requireRole(...(allowed as RoleName[]))
}
