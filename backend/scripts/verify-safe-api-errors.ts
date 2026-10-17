/**
 * Offline contract checks: M4 routes must not echo Error.message to API clients.
 * Run: npm run verify:safe-api-errors
 *
 * Does not start the server or touch databases.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.resolve(__dirname, "../src")

let passed = 0
let failed = 0

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(srcRoot, rel), "utf8")
}

/** Client-facing leak: assign error.message then send as JSON error body. */
const LEAK_ASSIGN =
  /const message = error instanceof Error \? error\.message/

console.log("\n=== No raw Error.message assignment for client responses ===")

const indexSrc = read("index.ts")
const authSrc = read("middleware/auth.ts")
const tenantSrc = read("routes/tenant.ts")

assert(!LEAK_ASSIGN.test(indexSrc), "index.ts has no error.message client assign")
assert(!LEAK_ASSIGN.test(authSrc), "auth.ts has no error.message client assign")
assert(!LEAK_ASSIGN.test(tenantSrc), "tenant.ts has no error.message client assign")

console.log("\n=== Generic public messages present ===")
assert(
  indexSrc.includes('error: "Database check failed"'),
  "health/db uses generic 503 message"
)
assert(
  indexSrc.includes('error: "Failed to list institutions"'),
  "institutions uses generic 500 message"
)
assert(
  indexSrc.includes('error: "Failed to load tenant info"'),
  "tenant info uses generic 500 message"
)
assert(
  indexSrc.includes('error: "Tenant DB unreachable"'),
  "tenant-health uses generic 503 message"
)
assert(
  authSrc.includes('error: "Invalid or expired token"'),
  "authenticate uses generic 401 message"
)
assert(
  tenantSrc.includes('error: "Failed to retrieve tenant info"'),
  "GET /info uses generic 500 message"
)
assert(
  tenantSrc.includes('error: "Failed to load branches"'),
  "GET /branches uses generic 500 message"
)

console.log("\n=== Server-side safe logging ===")
assert(indexSrc.includes("logSafeError"), "index.ts imports/uses logSafeError")
assert(tenantSrc.includes("logSafeError"), "tenant.ts imports/uses logSafeError")

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
