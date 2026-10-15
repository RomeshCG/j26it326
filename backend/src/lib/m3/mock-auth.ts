/**
 * M3 — Mock auth middleware
 * Until M4 JWT is wired, reads:
 *   x-mock-user-id  : UUID of the acting user (soft ref → central.users)
 *   x-mock-role     : one of the 6 system roles
 *
 * Replace this entire file with M4's real JWT middleware once available.
 */
import type { Request, Response, NextFunction } from "express"

export interface AuthContext {
  userId: string
  role: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

const VALID_ROLES = new Set([
  "admin",
  "executive",
  "finance_officer",
  "hr_officer",
  "branch_manager",
  "loan_officer",
])

/**
 * Attaches req.auth from mock headers. Returns 401 when headers are absent.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers["x-mock-user-id"] as string | undefined
  const role = req.headers["x-mock-role"] as string | undefined

  if (!userId || !role) {
    res.status(401).json({ error: "Missing x-mock-user-id or x-mock-role header (mock auth)" })
    return
  }

  if (!VALID_ROLES.has(role)) {
    res.status(403).json({ error: `Unknown role '${role}'` })
    return
  }

  req.auth = { userId, role }
  next()
}

/**
 * Factory: requires the request role to be one of the allowed roles.
 * Usage: router.post("/approve", requireAuth, requireRole("branch_manager"), handler)
 */
export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Not authenticated" })
      return
    }
    if (!allowed.includes(req.auth.role)) {
      res
        .status(403)
        .json({ error: `Role '${req.auth.role}' is not allowed. Required: ${allowed.join(" | ")}` })
      return
    }
    next()
  }
}
