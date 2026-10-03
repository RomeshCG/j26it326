import { centralPrisma } from "./prisma-central.js"
import { defaultTenantPrisma, getTenantPrisma } from "./prisma-tenant.js"
import type { PrismaClient as TenantClient } from "../../node_modules/.prisma/tenant-client/index.js"

export type TenantResolution =
  | { ok: true; institutionId: string; dbIdentifier: string; prisma: TenantClient }
  | { ok: false; status: number; message: string }

/**
 * Resolve the tenant Prisma client for an institution.
 * Looks up central.institution_databases and uses connection_url when set,
 * otherwise falls back to TENANT_DATABASE_URL for local/demo.
 */
export async function resolveTenantByInstitutionId(
  institutionId: string
): Promise<TenantResolution> {
  const record = await centralPrisma.institutionDatabase.findFirst({
    where: { institutionId, status: "active" },
    orderBy: { createdAt: "desc" },
  })

  if (!record) {
    // Dev convenience: if no routing row yet, use default tenant URL
    if (process.env.TENANT_DATABASE_URL) {
      return {
        ok: true,
        institutionId,
        dbIdentifier: "default-demo",
        prisma: defaultTenantPrisma,
      }
    }
    return {
      ok: false,
      status: 404,
      message: "No active tenant database registered for this institution",
    }
  }

  const url = record.connectionUrl ?? process.env.TENANT_DATABASE_URL
  if (!url) {
    return {
      ok: false,
      status: 500,
      message: "Tenant database has no connection_url and TENANT_DATABASE_URL is unset",
    }
  }

  return {
    ok: true,
    institutionId,
    dbIdentifier: record.dbIdentifier,
    prisma: url === process.env.TENANT_DATABASE_URL ? defaultTenantPrisma : getTenantPrisma(url),
  }
}

export async function resolveTenantByDbIdentifier(
  dbIdentifier: string
): Promise<TenantResolution> {
  const record = await centralPrisma.institutionDatabase.findUnique({
    where: { dbIdentifier },
  })

  if (!record || record.status !== "active") {
    return {
      ok: false,
      status: 404,
      message: `Tenant database '${dbIdentifier}' not found or not active`,
    }
  }

  const url = record.connectionUrl ?? process.env.TENANT_DATABASE_URL
  if (!url) {
    return {
      ok: false,
      status: 500,
      message: "Tenant database has no connection_url and TENANT_DATABASE_URL is unset",
    }
  }

  return {
    ok: true,
    institutionId: record.institutionId,
    dbIdentifier: record.dbIdentifier,
    prisma: url === process.env.TENANT_DATABASE_URL ? defaultTenantPrisma : getTenantPrisma(url),
  }
}
