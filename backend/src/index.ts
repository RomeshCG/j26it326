import "dotenv/config"
import cors from "cors"
import express from "express"
import { centralPrisma } from "./lib/prisma-central.js"
import { defaultTenantPrisma, disconnectAllTenantClients } from "./lib/prisma-tenant.js"
import {
  resolveTenantByDbIdentifier,
  resolveTenantByInstitutionId,
} from "./lib/tenant-context.js"

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors())
app.use(express.json())

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

app.get("/api/institutions", async (_req, res) => {
  try {
    const institutions = await centralPrisma.institution.findMany({
      include: {
        databases: true,
        subscriptions: true,
      },
      orderBy: { createdAt: "asc" },
    })
    res.json({ data: institutions })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list institutions"
    res.status(500).json({ error: message })
  }
})

app.get("/api/tenants/:dbIdentifier/info", async (req, res) => {
  const resolved = await resolveTenantByDbIdentifier(req.params.dbIdentifier)
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.message })
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

app.get("/api/institutions/:institutionId/tenant-health", async (req, res) => {
  const resolved = await resolveTenantByInstitutionId(req.params.institutionId)
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
  console.log("Endpoints: GET /health  GET /health/db  GET /api/institutions")
})
