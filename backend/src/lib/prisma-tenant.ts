import { PrismaClient } from "../../node_modules/.prisma/tenant-client/index.js"

const globalForPrisma = globalThis as unknown as {
  defaultTenantPrisma?: PrismaClient
  tenantClients?: Map<string, PrismaClient>
}

/** Default demo tenant from TENANT_DATABASE_URL */
export const defaultTenantPrisma =
  globalForPrisma.defaultTenantPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.defaultTenantPrisma = defaultTenantPrisma
}

/**
 * Cache of Prisma clients keyed by Neon connection URL.
 * One physical DB per institution → one client per connection string.
 */
function getClientCache() {
  if (!globalForPrisma.tenantClients) {
    globalForPrisma.tenantClients = new Map()
  }
  return globalForPrisma.tenantClients
}

export function getTenantPrisma(connectionUrl: string): PrismaClient {
  const cache = getClientCache()
  const existing = cache.get(connectionUrl)
  if (existing) return existing

  const client = new PrismaClient({
    datasources: { db: { url: connectionUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
  cache.set(connectionUrl, client)
  return client
}

export async function disconnectAllTenantClients() {
  const cache = getClientCache()
  await Promise.all([...cache.values()].map((c) => c.$disconnect()))
  cache.clear()
  await defaultTenantPrisma.$disconnect()
}
