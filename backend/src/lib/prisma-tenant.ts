import { PrismaClient } from "../../node_modules/.prisma/tenant-client/index.js"

interface TenantClientEntry {
  client: PrismaClient
  lastUsed: number
  inFlight: number
}

const globalForPrisma = globalThis as unknown as {
  defaultTenantPrisma?: PrismaClient
  tenantClientPool?: Map<string, TenantClientEntry>
}

/** Default demo tenant from TENANT_DATABASE_URL */
export const defaultTenantPrisma =
  globalForPrisma.defaultTenantPrisma ??
  new PrismaClient({
    errorFormat: "minimal",
    log: process.env.NODE_ENV === "development" ? ["warn"] : [],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.defaultTenantPrisma = defaultTenantPrisma
}

function getPool(): Map<string, TenantClientEntry> {
  if (!globalForPrisma.tenantClientPool) {
    globalForPrisma.tenantClientPool = new Map()
  }
  return globalForPrisma.tenantClientPool
}

export function getMaxCachedClients(): number {
  const envVal = process.env.MAX_TENANT_CLIENTS
  const parsed = envVal ? Number.parseInt(envVal, 10) : 10
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
}

/**
 * Evict idle clients when pool exceeds cap.
 * Only evicts entries with inFlight === 0.
 */
async function evictIdleClientsIfNeeded(targetSize?: number): Promise<void> {
  const pool = getPool()
  const maxClients = getMaxCachedClients()
  const target = targetSize ?? maxClients

  if (pool.size <= target) return

  // Find all idle entries sorted by least recently used (ascending lastUsed)
  const idleEntries = Array.from(pool.entries())
    .filter(([_, entry]) => entry.inFlight === 0)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed)

  for (const [key, entry] of idleEntries) {
    if (pool.size <= target) break
    pool.delete(key)
    try {
      await entry.client.$disconnect()
    } catch (err) {
      console.error(`[prisma-tenant] Error disconnecting evicted client for ${key}:`, err)
    }
  }
}

/**
 * Get or create a cached PrismaClient for a tenant connection URL.
 * Bounded by MAX_TENANT_CLIENTS, evicting only idle clients.
 */
export async function getTenantPrisma(connectionUrl: string): Promise<PrismaClient> {
  const pool = getPool()
  const existing = pool.get(connectionUrl)

  if (existing) {
    existing.lastUsed = Date.now()
    return existing.client
  }

  // Check if we need to evict an idle client before allocating a new one
  await evictIdleClientsIfNeeded(getMaxCachedClients() - 1)

  const client = new PrismaClient({
    datasources: { db: { url: connectionUrl } },
    errorFormat: "minimal",
    log: process.env.NODE_ENV === "development" ? ["warn"] : [],
  })

  pool.set(connectionUrl, {
    client,
    lastUsed: Date.now(),
    inFlight: 0,
  })

  return client
}

/**
 * Acquire client for an operation, incrementing in-flight count.
 */
export async function acquireTenantClient(connectionUrl: string): Promise<PrismaClient> {
  const client = await getTenantPrisma(connectionUrl)
  const pool = getPool()
  const entry = pool.get(connectionUrl)
  if (entry) {
    entry.inFlight += 1
    entry.lastUsed = Date.now()
  }
  return client
}

/**
 * Release client after operation finishes, decrementing in-flight count.
 */
export function releaseTenantClient(connectionUrl: string): void {
  const pool = getPool()
  const entry = pool.get(connectionUrl)
  if (entry) {
    entry.inFlight = Math.max(0, entry.inFlight - 1)
    entry.lastUsed = Date.now()
  }
}

/**
 * Explicitly evict a tenant client by connection URL.
 * If inFlight > 0, removes from cache immediately and defers disconnect until idle.
 */
export async function evictTenantClient(connectionUrl: string): Promise<void> {
  const pool = getPool()
  const entry = pool.get(connectionUrl)
  if (!entry) return

  pool.delete(connectionUrl)

  if (entry.inFlight === 0) {
    try {
      await entry.client.$disconnect()
    } catch (err) {
      console.error(`[prisma-tenant] Error disconnecting client for ${connectionUrl}:`, err)
    }
  } else {
    // In flight: wait for inFlight to reach 0 before disconnecting
    const checkInterval = setInterval(async () => {
      if (entry.inFlight === 0) {
        clearInterval(checkInterval)
        try {
          await entry.client.$disconnect()
        } catch (err) {
          console.error(`[prisma-tenant] Error disconnecting deferred client for ${connectionUrl}:`, err)
        }
      }
    }, 100)
    // Safety unref if Node supports it
    if (checkInterval.unref) checkInterval.unref()
  }
}

/**
 * Disconnect and clear all cached tenant clients, plus defaultTenantPrisma.
 */
export async function disconnectAllTenantClients(): Promise<void> {
  const pool = getPool()
  const entries = Array.from(pool.values())
  pool.clear()

  await Promise.all(
    entries.map(async (e) => {
      try {
        await e.client.$disconnect()
      } catch (err) {
        console.error("[prisma-tenant] Error disconnecting client:", err)
      }
    })
  )

  await defaultTenantPrisma.$disconnect()
}

/**
 * Returns current pool diagnostic stats (useful for tests and monitoring).
 */
export function getTenantPoolStats() {
  const pool = getPool()
  return {
    size: pool.size,
    maxSize: getMaxCachedClients(),
    entries: Array.from(pool.entries()).map(([url, entry]) => ({
      url,
      inFlight: entry.inFlight,
      lastUsed: entry.lastUsed,
    })),
  }
}
