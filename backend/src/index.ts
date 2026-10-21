import "dotenv/config"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { exec } from "child_process"
import cron from "node-cron"
import cors from "cors"
import express from "express"
import helmet from "helmet"
import swaggerUi from "swagger-ui-express"
import { centralPrisma } from "./lib/prisma-central.js"
import { defaultTenantPrisma, disconnectAllTenantClients } from "./lib/prisma-tenant.js"
import {
  resolveTenantByDbIdentifier,
  resolveTenantByInstitutionId,
} from "./lib/tenant-context.js"
import { m3Router } from "./routes/m3/index.js"
import { getJwtSecret, logSafeError } from "./lib/auth.js"
import { authRouter } from "./routes/auth.js"
import { publicDomainRouter, tenantDomainRouter } from "./routes/domains.js"
import { registrationRouter } from "./routes/registration.js"
import { tenantRouter } from "./routes/tenant.js"
import { exampleRouter } from "./routes/_example.js"
import { internalAgentDispatchRouter } from "./routes/internal-agent-dispatch.js"
import { authenticate, resolveTenantContext, requireRole } from "./middleware/auth.js"
import { configureTrustProxy } from "./middleware/rate-limit.js"
import { registerDefaultAgentHandlers } from "./lib/agent-handlers.js"

// Register Graduated Trust action handlers (A2 budget threshold, …)
registerDefaultAgentHandlers()

// Strict JWT_SECRET startup guard: server must fail fast if secret is missing or insecure
try {
  getJwtSecret()
} catch (error) {
  console.error("FATAL: JWT configuration error:", error instanceof Error ? error.message : error)
  process.exit(1)
}

const app = express()
const port = Number(process.env.PORT ?? 4000)

// Configure client IP resolution via trust proxy
configureTrustProxy(app, process.env.TRUST_PROXY)

// Startup check: ENABLE_RATE_LIMITING=false is ignored in production (Amendment 5)
if (process.env.NODE_ENV === "production" && process.env.ENABLE_RATE_LIMITING === "false") {
  console.warn("[security-audit] WARNING: ENABLE_RATE_LIMITING=false is ignored in production. Rate limiting is active.")
}

// OpenAPI / Swagger: available in development by default; in production only if ENABLE_SWAGGER_DOCS === "true"
const isDev = process.env.NODE_ENV !== "production"
const enableSwagger = isDev || process.env.ENABLE_SWAGGER_DOCS === "true"

// Security headers (Helmet). CSP disabled while Swagger UI is mounted — it needs inline script/style.
app.use(
  helmet({
    contentSecurityPolicy: enableSwagger ? false : undefined,
  })
)

app.use(cors())
app.use(express.json())

// Compute paths relative to source file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// backend/src -> docs/openapi.json is at ../../docs/openapi.json
const openApiPath = path.resolve(__dirname, "../../docs/openapi.json")

let openApiSpec: any = null
function getOpenApiSpec() {
  if (openApiSpec) return openApiSpec
  try {
    if (fs.existsSync(openApiPath)) {
      const content = fs.readFileSync(openApiPath, "utf8")
      openApiSpec = JSON.parse(content)
      return openApiSpec
    } else {
      console.warn(`[warning] openapi.json not found at ${openApiPath}`)
      return null
    }
  } catch (err) {
    console.warn(`[warning] Failed to load openapi.json:`, err)
    return null
  }
}

if (enableSwagger) {
  app.get("/openapi.json", (_req, res) => {
    const spec = getOpenApiSpec()
    if (!spec) {
      res.status(404).json({ error: "OpenAPI specification not available" })
      return
    }
    res.json(spec)
  })

  app.use("/docs", swaggerUi.serve, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const spec = getOpenApiSpec()
    if (!spec) {
      res.status(404).send("OpenAPI documentation not found")
      return
    }
    swaggerUi.setup(spec)(req, res, next)
  })
}

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
    logSafeError("[health/db] Database check failed", error)
    res.status(503).json({ ok: false, error: "Database check failed" })
  }
})

// Authentication & Profile routes
app.use("/auth", authRouter)
app.use("/auth", publicDomainRouter)
app.use("/auth", registrationRouter)

// Core Tenant routes (M4 and cross-module queries)
app.use("/api/tenant", tenantRouter)
app.use("/api/tenant", tenantDomainRouter)

// Internal agent → Node dispatch (shared service key; not user JWT)
app.use("/api/internal", internalAgentDispatchRouter)

// M2 — Ledger & Dual-Mission event receiver webhook
app.post("/api/m2/events/loan-lifecycle", (req, res) => {
  console.log("[M2 Webhook Received Event]", JSON.stringify(req.body))
  res.status(200).json({ ok: true, status: "event_processed", payload: req.body, receivedAt: new Date().toISOString() })
})

// Integration example router for teammates (non-production only)
if (isDev) {
  app.use("/api/example", exampleRouter)
}

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
    logSafeError("[api/institutions] Failed to list institutions", error)
    res.status(500).json({ error: "Failed to list institutions" })
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
    logSafeError("[api/tenants/:dbIdentifier/info] Failed to load tenant info", error)
    res.status(500).json({ error: "Failed to load tenant info" })
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
    logSafeError("[api/institutions/:id/tenant-health] Tenant DB unreachable", error)
    res.status(503).json({ ok: false, error: "Tenant DB unreachable" })
  }
})

// ── M3 — Loan Lifecycle & EWS ────────────────────────────────────────────────
app.use("/api/m3", m3Router)

// Nightly 2:00 AM EWS Batch Scoring Trigger
const repoRoot = path.resolve(__dirname, "../../")
const venvPyWindows = path.join(repoRoot, "ml", ".venv", "Scripts", "python.exe")
const venvPyUnix = path.join(repoRoot, "ml", ".venv", "bin", "python")
const pyExecutable = fs.existsSync(venvPyWindows)
  ? venvPyWindows
  : fs.existsSync(venvPyUnix)
  ? venvPyUnix
  : "python"
const batchScoreScript = path.join(repoRoot, "ml", "m3_ews", "serve", "batch_score.py")

cron.schedule("0 2 * * *", () => {
  console.log(`[M3 Cron] Initiating nightly EWS batch scoring (${new Date().toISOString()})...`)
  exec(`"${pyExecutable}" "${batchScoreScript}"`, { cwd: repoRoot }, (err, stdout, stderr) => {
    if (err) {
      console.error("[M3 Cron] EWS batch scoring error:", err.message)
      if (stderr) console.error("[M3 Cron] Stderr:", stderr)
      return
    }
    console.log("[M3 Cron] Nightly EWS batch scoring completed successfully.")
    if (stdout) console.log("[M3 Cron] Output summary:", stdout.slice(0, 300))
  })
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
  console.log(`Endpoints: GET /health  GET /health/db  POST /auth/login  GET /auth/me`)
  console.log("M3 routes: /api/m3/products  /api/m3/borrowers  /api/m3/groups")
  console.log("           /api/m3/applications  /api/m3/loans  /api/m3/collections")
  console.log("           /api/m3/par  /api/m3/ews")
  if (enableSwagger) {
    console.log(`Swagger Docs: http://localhost:${port}/docs  (OpenAPI JSON: http://localhost:${port}/openapi.json)`)
  }
})
