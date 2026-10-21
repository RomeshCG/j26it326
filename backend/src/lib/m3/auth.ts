/**
 * M3 Real JWT Authentication & RBAC Middleware
 * ============================================
 * Production authentication adapter delegating directly to M4's central JWT
 * and multi-tenant resolution pipeline:
 *   - authenticate: Verifies Bearer JWT token signed with JWT_SECRET
 *   - resolveTenantContext: Validates user institution and attaches tenant Prisma client
 *   - requireRole: Enforces strict role-based access control
 */
import type { Request, Response, NextFunction } from "express"
import {
  authenticate as _authenticate,
  resolveTenantContext as _resolveTenantContext,
  requireRole as _requireRole,
} from "../../middleware/auth.js"
import type { RoleName } from "../../lib/permissions.js"

export type { RoleName }

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
 * Validates the caller's M4 Bearer JWT token and attaches req.user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  _authenticate(req, res, () => {
    if (req.user) {
      req.auth = {
        userId: req.user.userId,
        role: req.user.role,
      }
      _resolveTenantContext(req, res, next).catch(next)
    } else {
      next()
    }
  })
}

/**
 * Resolves tenant Prisma client via central database and attaches req.tenantPrisma.
 */
export async function resolveTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return _resolveTenantContext(req, res, next)
}

/**
 * Enforces role authorization (e.g. loan_officer, branch_manager, admin).
 */
export function requireRole(...allowed: string[]) {
  return _requireRole(...(allowed as RoleName[]))
}
