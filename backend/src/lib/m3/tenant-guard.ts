/**
 * M3 — Tenant resolution helper for route handlers.
 *
 * Enforces real M4 JWT tenant context:
 * - req.tenantPrisma is attached by resolveTenantContext middleware.
 * - req.user.institutionId is extracted from the cryptographically verified JWT.
 * - Path B (unauthenticated x-institution-id spoofing & "demo" fallback) has been removed.
 */
import type { Request, Response } from "express"
import type { PrismaClient as TenantClient } from "../../../node_modules/.prisma/tenant-client/index.js"

export type ResolvedTenant = {
  prisma: TenantClient
  institutionId: string
  dbIdentifier: string
}

export async function resolveTenant(
  req: Request,
  res: Response
): Promise<ResolvedTenant | null> {
  if (req.tenantPrisma && req.user?.institutionId) {
    return {
      prisma: req.tenantPrisma as TenantClient,
      institutionId: req.user.institutionId,
      dbIdentifier: req.user.institutionId,
    }
  }

  res.status(401).json({ error: "Unauthorized: tenant context could not be resolved from JWT" })
  return null
}
