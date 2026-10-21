import "dotenv/config"
import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { centralPrisma } from "../src/lib/prisma-central.js"
import { buildTenantDatabaseUrl } from "../src/lib/tenant-context.js"

/**
 * Migrate the integration server: the central DB, the default tenant DB and EVERY tenant DB
 * registered in central `institution_databases` (DB-per-tenant: each one needs its own deploy).
 *
 * Default is a dry run (`prisma migrate status` only). `--apply` runs `prisma migrate deploy`,
 * which applies pending migrations and nothing else. This script never resets or drops anything.
 *
 * Usage (from backend/, with .env pointing at the integration server):
 *   npx tsx scripts/migrate-integration.ts                              # status only
 *   npx tsx scripts/migrate-integration.ts --apply --expect-port 5437   # deploy
 *
 * --expect-port is required with --apply so a .env pointing at the wrong server aborts instead.
 */

const run = promisify(execFile)
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const prismaCli = path.join(backendDir, "node_modules/prisma/build/index.js")

type Target = { label: string; schema: "central" | "tenant"; url: string }
type State = "up to date" | "pending" | "error"

const args = process.argv.slice(2)
const apply = args.includes("--apply")
const portArg = args.indexOf("--expect-port")
const expectPort = portArg >= 0 ? Number(args[portArg + 1]) : null

const redact = (s: string) => s.replace(/(postgres(?:ql)?:\/\/[^:/@\s]+:)[^@\s]+@/g, "$1***@")

function where(url: string): string {
  const u = new URL(url)
  return `${u.hostname}:${u.port || 5432}/${u.pathname.replace(/^\//, "")}`
}

async function prisma(cmd: "status" | "deploy", t: Target): Promise<{ state: State; out: string }> {
  const env = { ...process.env, [t.schema === "central" ? "CENTRAL_DATABASE_URL" : "TENANT_DATABASE_URL"]: t.url }
  try {
    const { stdout, stderr } = await run(
      process.execPath,
      [prismaCli, "migrate", cmd, "--schema", `prisma/${t.schema}/schema.prisma`],
      { cwd: backendDir, env, timeout: 120_000 }
    )
    const out = stdout + stderr
    return { state: /not yet been applied/i.test(out) ? "pending" : "up to date", out }
  } catch (err: any) {
    // `migrate status` exits 1 when migrations are pending; only that case is not an error.
    const out = `${err?.stdout ?? ""}${err?.stderr ?? ""}` || String(err?.message ?? err)
    return { state: /not yet been applied/i.test(out) ? "pending" : "error", out }
  }
}

async function tenantTargets(): Promise<Target[]> {
  const seen = new Set<string>()
  const targets: Target[] = []
  const add = (label: string, url: string) => {
    const key = where(url)
    if (seen.has(key)) return
    seen.add(key)
    targets.push({ label, schema: "tenant", url })
  }
  if (process.env.TENANT_DATABASE_URL) add("tenant (default)", process.env.TENANT_DATABASE_URL)
  // Same URL construction the app uses at runtime for tenant routing.
  const dbs = await centralPrisma.institutionDatabase.findMany({
    where: { status: { in: ["active", "migrating"] } },
    select: { dbIdentifier: true, dbHost: true, dbPort: true, dbName: true },
    orderBy: { createdAt: "asc" },
  })
  for (const d of dbs) add(`tenant ${d.dbIdentifier}`, buildTenantDatabaseUrl(d.dbHost, d.dbPort, d.dbName))
  return targets
}

async function main() {
  const central = process.env.CENTRAL_DATABASE_URL
  if (!central) throw new Error("CENTRAL_DATABASE_URL is not set")
  const centralPort = Number(new URL(central).port || 5432)

  if (apply && expectPort === null) throw new Error("--apply needs --expect-port <port> (e.g. 5437)")
  if (expectPort !== null && centralPort !== expectPort) {
    throw new Error(`CENTRAL_DATABASE_URL is on port ${centralPort}, expected ${expectPort}. Aborting.`)
  }

  console.log(`Mode: ${apply ? "APPLY (migrate deploy)" : "DRY RUN (migrate status only)"}`)
  console.log(`Central: ${where(central)}\n`)

  const rows: Array<{ label: string; at: string; before: State; after: State | "-" }> = []
  let failed = false

  // Central first: the tenant list lives there, and tenants are useless if central did not migrate.
  const targets: Target[] = [{ label: "central", schema: "central", url: central }]
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    const before = await prisma("status", t)
    let after: State | "-" = "-"
    if (apply && before.state === "pending") {
      const deployed = await prisma("deploy", t)
      after = deployed.state === "error" ? "error" : (await prisma("status", t)).state
      if (after !== "up to date") console.error(`\n[${t.label}] deploy output:\n${redact(deployed.out).trim()}\n`)
    }
    if (before.state === "error") console.error(`\n[${t.label}] status output:\n${redact(before.out).trim()}\n`)
    rows.push({ label: t.label, at: where(t.url), before: before.state, after })
    if (before.state === "error" || after === "error" || (apply && after === "pending")) failed = true
    if (i === 0) {
      if (failed) break
      targets.push(...(await tenantTargets()))
    }
  }

  console.table(rows)
  if (!apply && rows.some((r) => r.before === "pending")) {
    console.log("Pending migrations found. Re-run with --apply --expect-port <port> to deploy them.")
  }
  if (failed) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error(redact(String(err?.message ?? err)))
    process.exitCode = 1
  })
  .finally(() => centralPrisma.$disconnect())
