/**
 * M3 — Tenant resolution helper for route handlers.
 *
 * With real M4 JWT auth the tenant Prisma client is already attached to
 * req.tenantPrisma by the resolveTenantContext middleware, and the
 * institutionId comes from the verified JWT payload (req.user.institutionId).
 *
 * This helper wraps both so route handlers keep the same call shape:
 *
 *   const tenant = await resolveTenant(req, res)
 *   if (!tenant) return          // response already sent
 *   const data = await tenant.prisma.borrower.findMany(...)
 *
 * Fallback (dev-only): if resolveTenantContext was NOT run upstream (i.e.
 * req.tenantPrisma is absent) the helper falls back to the default tenant
 * Prisma client — matching the old behaviour for local development without
 * a real JWT.
 */
import type { Request, Response } from "express"
import {
  resolveTenantByInstitutionId,
  type TenantResolution,
} from "../tenant-context.js"
import { defaultTenantPrisma } from "../prisma-tenant.js"
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
  // ── Path A: M4 middleware already resolved the tenant ────────────────────
  if (req.tenantPrisma && req.user?.institutionId) {
    return {
      prisma:        req.tenantPrisma as TenantClient,
      institutionId: req.user.institutionId,
      dbIdentifier:  req.user.institutionId,
    }
  }

  // ── Path B: Legacy / dev — resolve from x-institution-id header ──────────
  const institutionId = req.headers["x-institution-id"] as string | undefined

  if (!institutionId) {
    // Dev / demo shortcut: no header → use default tenant
    return {
      prisma:        defaultTenantPrisma,
      institutionId: "demo",
      dbIdentifier:  "default-demo",
    }
  }

  const resolved: TenantResolution = await resolveTenantByInstitutionId(institutionId)

  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.message })
    return null
  }

  return {
    prisma:        resolved.prisma,
    institutionId: resolved.institutionId,
    dbIdentifier:  resolved.dbIdentifier,
  }
}
