import { centralPrisma } from "./prisma-central.js"
import {
  getTenantPrisma,
  evictTenantClient,
} from "./prisma-tenant.js"
import type { PrismaClient as TenantClient } from "../../node_modules/.prisma/tenant-client/index.js"

export interface TenantResolutionSuccess {
  ok: true
  institutionId: string
  dbIdentifier: string
  connectionUrl: string
  prisma: TenantClient
}

export interface TenantResolutionFailure {
  ok: false
  status: number
  message: string
}

export type TenantResolution = TenantResolutionSuccess | TenantResolutionFailure

interface CachedRoutingRecord {
  institutionId: string
  institutionStatus: string
  dbIdentifier: string
  dbHost: string
  dbPort: number
  dbName: string
  dbStatus: string
  cachedAt: number
}

// TTL cache for routing lookups
const routingCacheByInstitutionId = new Map<string, CachedRoutingRecord>()
const routingCacheByDbIdentifier = new Map<string, CachedRoutingRecord>()

function getRoutingCacheTtlMs(): number {
  const envSeconds = process.env.ROUTING_CACHE_TTL_SECONDS
  const parsed = envSeconds ? Number.parseInt(envSeconds, 10) : 60
  const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 60
  return seconds * 1000
}

function getDefaultTenantConnectionLimit(): number {
  const envVal = process.env.TENANT_DB_CONNECTION_LIMIT
  const parsed = envVal ? Number.parseInt(envVal, 10) : 5
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5
}

/**
 * Builds the tenant connection URL using the credentials and search params from CENTRAL_DATABASE_URL
 * while replacing host, port, database name, and setting connection_limit.
 */
export function buildTenantDatabaseUrl(
  dbHost: string,
  dbPort: number,
  dbName: string
): string {
  const centralUrl = process.env.CENTRAL_DATABASE_URL
  if (!centralUrl) {
    throw new Error("CENTRAL_DATABASE_URL is not configured in environment")
  }

  // Parse using WHATWG URL class
  // Normalize protocol to postgres: if needed for URL constructor
  const url = new URL(centralUrl)
  url.hostname = dbHost
  url.port = String(dbPort)
  url.pathname = `/${dbName.replace(/^\//, "")}`

  // Ensure connection_limit query parameter is configured
  const connectionLimit = getDefaultTenantConnectionLimit()
  url.searchParams.set("connection_limit", String(connectionLimit))

  return url.toString()
}

/**
 * Invalidate cached routing entry and optionally evict the associated PrismaClient.
 */
export async function invalidateTenantRouting(institutionId?: string, dbIdentifier?: string): Promise<void> {
  let record: CachedRoutingRecord | undefined

  if (institutionId) {
    record = routingCacheByInstitutionId.get(institutionId)
    routingCacheByInstitutionId.delete(institutionId)
  }

  if (dbIdentifier) {
    if (!record) record = routingCacheByDbIdentifier.get(dbIdentifier)
    routingCacheByDbIdentifier.delete(dbIdentifier)
  }

  if (record) {
    routingCacheByInstitutionId.delete(record.institutionId)
    routingCacheByDbIdentifier.delete(record.dbIdentifier)
    try {
      const url = buildTenantDatabaseUrl(record.dbHost, record.dbPort, record.dbName)
      await evictTenantClient(url)
    } catch {
      // Ignore if URL construction fails during cleanup
    }
  }
}

/**
 * Clear all routing caches and tenant client pool.
 */
export function clearRoutingCache(): void {
  routingCacheByInstitutionId.clear()
  routingCacheByDbIdentifier.clear()
}

/**
 * Resolve tenant Prisma client by institutionId.
 * Strictly verifies institution status = 'active' and institution_database status = 'active'.
 */
export async function resolveTenantByInstitutionId(
  institutionId: string
): Promise<TenantResolution> {
  const now = Date.now()
  const ttlMs = getRoutingCacheTtlMs()
  const cached = routingCacheByInstitutionId.get(institutionId)

  let routing: CachedRoutingRecord

  if (cached && now - cached.cachedAt < ttlMs) {
    routing = cached
  } else {
    // Lookup central institution and institution_databases
    const institution = await centralPrisma.institution.findUnique({
      where: { id: institutionId },
      include: {
        databases: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    })

    if (!institution) {
      return {
        ok: false,
        status: 404,
        message: `Institution '${institutionId}' not found`,
      }
    }

    const dbRecord = institution.databases[0]
    if (!dbRecord) {
      return {
        ok: false,
        status: 404,
        message: `No tenant database registered for institution '${institutionId}'`,
      }
    }

    routing = {
      institutionId: institution.id,
      institutionStatus: institution.status,
      dbIdentifier: dbRecord.dbIdentifier,
      dbHost: dbRecord.dbHost,
      dbPort: dbRecord.dbPort,
      dbName: dbRecord.dbName,
      dbStatus: dbRecord.status,
      cachedAt: now,
    }

    routingCacheByInstitutionId.set(institutionId, routing)
    routingCacheByDbIdentifier.set(routing.dbIdentifier, routing)
  }

  // Refuse if institution is not active
  if (routing.institutionStatus !== "active") {
    return {
      ok: false,
      status: 403,
      message: `Institution '${institutionId}' is not active (current status: ${routing.institutionStatus})`,
    }
  }

  // Refuse if tenant database is not active
  if (routing.dbStatus !== "active") {
    return {
      ok: false,
      status: 403,
      message: `Tenant database '${routing.dbIdentifier}' is not active (current status: ${routing.dbStatus})`,
    }
  }

  try {
    const connectionUrl = buildTenantDatabaseUrl(routing.dbHost, routing.dbPort, routing.dbName)
    const prisma = await getTenantPrisma(connectionUrl)
    return {
      ok: true,
      institutionId: routing.institutionId,
      dbIdentifier: routing.dbIdentifier,
      connectionUrl,
      prisma,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build tenant connection"
    return {
      ok: false,
      status: 500,
      message,
    }
  }
}

/**
 * Resolve tenant Prisma client by dbIdentifier.
 * Strictly verifies institution status = 'active' and institution_database status = 'active'.
 */
export async function resolveTenantByDbIdentifier(
  dbIdentifier: string
): Promise<TenantResolution> {
  const now = Date.now()
  const ttlMs = getRoutingCacheTtlMs()
  const cached = routingCacheByDbIdentifier.get(dbIdentifier)

  let routing: CachedRoutingRecord

  if (cached && now - cached.cachedAt < ttlMs) {
    routing = cached
  } else {
    const dbRecord = await centralPrisma.institutionDatabase.findUnique({
      where: { dbIdentifier },
      include: {
        institution: true,
      },
    })

    if (!dbRecord) {
      return {
        ok: false,
        status: 404,
        message: `Tenant database '${dbIdentifier}' not found`,
      }
    }

    routing = {
      institutionId: dbRecord.institutionId,
      institutionStatus: dbRecord.institution.status,
      dbIdentifier: dbRecord.dbIdentifier,
      dbHost: dbRecord.dbHost,
      dbPort: dbRecord.dbPort,
      dbName: dbRecord.dbName,
      dbStatus: dbRecord.status,
      cachedAt: now,
    }

    routingCacheByInstitutionId.set(routing.institutionId, routing)
    routingCacheByDbIdentifier.set(routing.dbIdentifier, routing)
  }

  // Refuse if institution is not active
  if (routing.institutionStatus !== "active") {
    return {
      ok: false,
      status: 403,
      message: `Institution '${routing.institutionId}' is not active (current status: ${routing.institutionStatus})`,
    }
  }

  // Refuse if tenant database is not active
  if (routing.dbStatus !== "active") {
    return {
      ok: false,
      status: 403,
      message: `Tenant database '${routing.dbIdentifier}' is not active (current status: ${routing.dbStatus})`,
    }
  }

  try {
    const connectionUrl = buildTenantDatabaseUrl(routing.dbHost, routing.dbPort, routing.dbName)
    const prisma = await getTenantPrisma(connectionUrl)
    return {
      ok: true,
      institutionId: routing.institutionId,
      dbIdentifier: routing.dbIdentifier,
      connectionUrl,
      prisma,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build tenant connection"
    return {
      ok: false,
      status: 500,
      message,
    }
  }
}
