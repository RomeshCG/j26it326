import "dotenv/config"
import cors from "cors"
import express from "express"
import { centralPrisma } from "./lib/prisma-central.js"
import { defaultTenantPrisma, disconnectAllTenantClients } from "./lib/prisma-tenant.js"
import {
  resolveTenantByDbIdentifier,
  resolveTenantByInstitutionId,
} from "./lib/tenant-context.js"
import { getJwtSecret } from "./lib/auth.js"
import { authRouter } from "./routes/auth.js"
import { authenticate, resolveTenantContext, requireRole } from "./middleware/auth.js"

// Strict JWT_SECRET startup guard: server must fail fast if secret is missing or insecure
try {
  getJwtSecret()
} catch (error) {
  console.error("FATAL: JWT configuration error:", error instanceof Error ? error.message : error)
  process.exit(1)
}

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors())
app.use(express.json())

// Public health checks
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "imfs-backend",
    multiTenant: "database-per-tenant",
    orm: "prisma",
  })
})

app.get("/health/db", async (_req, res) => {
  try {
    await centralPrisma.$queryRaw`SELECT 1`
    await defaultTenantPrisma.$queryRaw`SELECT 1`
    res.json({
      ok: true,
      central: "connected",
      tenantDefault: "connected",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database check failed"
    res.status(503).json({ ok: false, error: message })
  }
})

// Authentication & Profile routes
app.use("/auth", authRouter)

// ============================================================================
// Protected Infrastructure Routes (Admin of caller's own institution only)
// ============================================================================

/**
 * GET /api/institutions
 * Returns ONLY the caller's own institution (no cross-institution super-admin).
 */
app.get("/api/institutions", authenticate, resolveTenantContext, requireRole("admin"), async (req, res) => {
  try {
    const callerInstitutionId = req.user!.institutionId

    const institutions = await centralPrisma.institution.findMany({
      where: { id: callerInstitutionId },
      include: {
        databases: true,
        subscriptions: true,
      },
    })
    res.json({ data: institutions })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list institutions"
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/tenants/:dbIdentifier/info
 * Returns tenant info ONLY if dbIdentifier belongs to caller's own institution.
 */
app.get("/api/tenants/:dbIdentifier/info", authenticate, resolveTenantContext, requireRole("admin"), async (req, res) => {
  const dbIdentifier = String(req.params.dbIdentifier)
  const resolved = await resolveTenantByDbIdentifier(dbIdentifier)
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.message })
    return
  }

  // Cross-institution protection: tenant must belong to the caller's institution
  if (resolved.institutionId !== req.user!.institutionId) {
    res.status(403).json({ error: "Access denied to foreign tenant database" })
    return
  }

  try {
    const info = await resolved.prisma.tenantInfo.findUnique({ where: { id: 1 } })
    const branchCount = await resolved.prisma.branch.count()
    const borrowerCount = await resolved.prisma.borrower.count()
    res.json({
      dbIdentifier: resolved.dbIdentifier,
      institutionId: resolved.institutionId,
      tenantInfo: info,
      counts: { branches: branchCount, borrowers: borrowerCount },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load tenant info"
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/institutions/:institutionId/tenant-health
 * Returns tenant health ONLY if institutionId matches caller's own institution.
 */
app.get("/api/institutions/:institutionId/tenant-health", authenticate, resolveTenantContext, requireRole("admin"), async (req, res) => {
  const targetInstitutionId = String(req.params.institutionId)
  if (targetInstitutionId !== req.user!.institutionId) {
    res.status(403).json({ error: "Access denied to foreign institution health check" })
    return
  }

  const resolved = await resolveTenantByInstitutionId(targetInstitutionId)
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.message })
    return
  }

  try {
    await resolved.prisma.$queryRaw`SELECT 1`
    res.json({
      ok: true,
      institutionId: resolved.institutionId,
      dbIdentifier: resolved.dbIdentifier,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tenant DB unreachable"
    res.status(503).json({ ok: false, error: message })
  }
})

async function shutdown() {
  await centralPrisma.$disconnect()
  await disconnectAllTenantClients()
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

app.listen(port, () => {
  console.log(`IMFS backend listening on http://localhost:${port}`)
  console.log("Endpoints: GET /health  GET /health/db  POST /auth/login  GET /auth/me")
})
