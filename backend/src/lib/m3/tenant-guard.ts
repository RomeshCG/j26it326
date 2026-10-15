/**
 * M3 — Tenant resolution helper for route handlers.
 *
 * Reads  x-institution-id  header (UUID) → resolves correct tenant PrismaClient.
 * Falls back to the default demo tenant if no routing row exists yet (dev convenience).
 *
 * Usage:
 *   const tenant = await resolveTenant(req, res)
 *   if (!tenant) return          // response already sent
 *   const data = await tenant.prisma.borrower.findMany(...)
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
  const institutionId = req.headers["x-institution-id"] as string | undefined

  // Dev / demo shortcut: no header → use default tenant
  if (!institutionId) {
    return {
      prisma: defaultTenantPrisma,
      institutionId: "demo",
      dbIdentifier: "default-demo",
    }
  }

  const resolved: TenantResolution = await resolveTenantByInstitutionId(institutionId)

  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.message })
    return null
  }

  return {
    prisma: resolved.prisma,
    institutionId: resolved.institutionId,
    dbIdentifier: resolved.dbIdentifier,
  }
}
