/**
 * Dev-only: seed reusable ZZ Test Org 1 central users (one per non-admin role).
 *
 * NEVER modifies admin@zz-test-org1.lk.
 * NEVER creates tenant Employee / branch assignments.
 * NEVER prints passwords, hashes, or DB URLs.
 *
 * Required env:
 *   ALLOW_ZZ_TEST_USER_SEED=1
 *   NODE_ENV must not be "production"
 *   CENTRAL_DATABASE_URL (via dotenv)
 *
 * Credentials (new accounts only) → backend/.zz-test-credentials.local (gitignored).
 * If that file already exists, the script refuses to create users (no overwrite).
 *
 * Run (after approval):
 *   cd backend
 *   $env:ALLOW_ZZ_TEST_USER_SEED="1"   # PowerShell
 *   npm run seed:zz-test-users
 *
 * Disable later: set user.status = 'disabled' in central (login rejects non-active).
 */
import "dotenv/config"
import { randomBytes } from "node:crypto"
import {
  chmodSync,
  existsSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"
import { hashPassword } from "../src/lib/auth.js"
import { centralPrisma } from "../src/lib/prisma-central.js"
import type { RoleName } from "../src/lib/permissions.js"

export const ZZ_INSTITUTION_ID = "33b6545d-7c78-4354-a017-d0717efba3b8" as const
export const ZZ_ADMIN_EMAIL = "admin@zz-test-org1.lk" as const
export const ZZ_EMAIL_DOMAIN = "zz-test-org1.lk" as const

/** Non-admin roles only — admin is never created or updated by this script. */
export const ZZ_SEED_ROLES: readonly Exclude<RoleName, "admin">[] = [
  "executive",
  "branch_manager",
  "finance_officer",
  "hr_officer",
  "loan_officer",
] as const

export const ZZ_CREDENTIALS_FILENAME = ".zz-test-credentials.local" as const

export function zzEmailForRole(role: Exclude<RoleName, "admin">): string {
  return `${role.replace(/_/g, ".")}@${ZZ_EMAIL_DOMAIN}`
}

export function zzDisplayName(role: Exclude<RoleName, "admin">): string {
  const label = role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
  return `ZZ Dev ${label}`
}

export function assertZzSeedEnvironmentAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (String(env.NODE_ENV ?? "").toLowerCase() === "production") {
    throw new Error(
      "Refusing ZZ test-user seed: NODE_ENV=production. Development/E2E only."
    )
  }
  if (String(env.ALLOW_ZZ_TEST_USER_SEED ?? "").trim() !== "1") {
    throw new Error(
      'Refusing ZZ test-user seed: set ALLOW_ZZ_TEST_USER_SEED=1 explicitly (and keep NODE_ENV out of production).'
    )
  }
}

export function generateZzTestPassword(): string {
  // Independent strong password; never logged.
  return `Zz#${randomBytes(18).toString("base64url")}`
}

export function credentialsFilePath(
  backendRoot = path.dirname(fileURLToPath(import.meta.url)) + "/.."
): string {
  return path.resolve(backendRoot, ZZ_CREDENTIALS_FILENAME)
}

function applyRestrictiveFileMode(filePath: string): void {
  try {
    chmodSync(filePath, 0o600)
  } catch {
    // Windows may not honor Unix modes; best-effort only.
  }
}

function writeCredentialsFile(
  filePath: string,
  lines: Array<{ role: string; email: string; password: string }>
): void {
  if (existsSync(filePath)) {
    throw new Error(
      `Credentials file already exists at ${ZZ_CREDENTIALS_FILENAME}. ` +
        "Move or archive it before creating new ZZ test users (refusing overwrite)."
    )
  }
  const header = [
    "# ZZ Test Org 1 — DEVELOPMENT / E2E test credentials",
    `# Institution: ${ZZ_INSTITUTION_ID}`,
    `# Generated: ${new Date().toISOString()}`,
    "# DO NOT COMMIT. DO NOT SHARE outside the local research team.",
    "# Admin account is NOT managed by this file.",
    "",
  ].join("\n")
  const body = lines
    .map((r) => `role=${r.role}\nemail=${r.email}\npassword=${r.password}\n`)
    .join("\n")
  writeFileSync(filePath, `${header}${body}`, { encoding: "utf8", flag: "wx" })
  applyRestrictiveFileMode(filePath)
}

type SeedOutcome =
  | { email: string; role: string; status: "created" }
  | { email: string; role: string; status: "skipped_exists_ok" }
  | { email: string; role: string; status: "mismatch"; detail: string }

async function seedZzTestUsers(): Promise<void> {
  assertZzSeedEnvironmentAllowed()

  const credPath = credentialsFilePath()
  console.log("=== IMFS M4: Seed ZZ Test Org 1 users (non-admin) ===")
  console.log(`Institution: ${ZZ_INSTITUTION_ID}`)
  console.log(`Credentials file (new creates only): ${ZZ_CREDENTIALS_FILENAME}`)
  console.log("Passwords will not be printed.\n")

  const institution = await centralPrisma.institution.findUnique({
    where: { id: ZZ_INSTITUTION_ID },
    select: { id: true, name: true, status: true },
  })
  if (!institution) {
    throw new Error(`ZZ institution not found: ${ZZ_INSTITUTION_ID}`)
  }
  if (institution.status !== "active") {
    throw new Error(
      `ZZ institution status is '${institution.status}' (expected active). Refusing seed.`
    )
  }
  console.log(`Verified institution: ${institution.name} (${institution.status})`)

  const admin = await centralPrisma.user.findUnique({
    where: { email: ZZ_ADMIN_EMAIL },
    select: {
      id: true,
      institutionId: true,
      status: true,
      role: { select: { name: true } },
    },
  })
  if (!admin || admin.institutionId !== ZZ_INSTITUTION_ID) {
    throw new Error(
      `Expected ZZ admin ${ZZ_ADMIN_EMAIL} on this institution before seeding. Aborting.`
    )
  }
  if (admin.role.name !== "admin") {
    throw new Error(`ZZ admin email exists but role is '${admin.role.name}'. Aborting.`)
  }
  console.log(`Verified existing admin left untouched: ${ZZ_ADMIN_EMAIL}`)

  // Pre-resolve roles
  const roleByName = new Map<string, { id: number; name: string }>()
  for (const roleName of ZZ_SEED_ROLES) {
    const role = await centralPrisma.role.findUnique({
      where: { name: roleName },
      select: { id: true, name: true },
    })
    if (!role) {
      throw new Error(
        `Role '${roleName}' missing in central.roles. Run central seed first.`
      )
    }
    roleByName.set(roleName, role)
  }
  console.log(`Verified ${ZZ_SEED_ROLES.length} role records.\n`)

  const plannedCreates: Array<{
    role: Exclude<RoleName, "admin">
    email: string
    password: string
    roleId: number
  }> = []
  const outcomes: SeedOutcome[] = []

  for (const roleName of ZZ_SEED_ROLES) {
    const email = zzEmailForRole(roleName)
    if (email.toLowerCase() === ZZ_ADMIN_EMAIL.toLowerCase()) {
      throw new Error("Internal guard: refusing any operation on admin email")
    }
    const role = roleByName.get(roleName)!
    const existing = await centralPrisma.user.findUnique({
      where: { email },
      select: {
        institutionId: true,
        status: true,
        role: { select: { name: true } },
      },
    })

    if (!existing) {
      plannedCreates.push({
        role: roleName,
        email,
        password: generateZzTestPassword(),
        roleId: role.id,
      })
      continue
    }

    const problems: string[] = []
    if (existing.institutionId !== ZZ_INSTITUTION_ID) {
      problems.push("institutionId mismatch")
    }
    if (existing.role.name !== roleName) {
      problems.push(`role is '${existing.role.name}' (expected ${roleName})`)
    }
    if (existing.status !== "active") {
      problems.push(`status is '${existing.status}' (expected active)`)
    }
    if (problems.length > 0) {
      outcomes.push({
        email,
        role: roleName,
        status: "mismatch",
        detail: problems.join("; "),
      })
    } else {
      outcomes.push({
        email,
        role: roleName,
        status: "skipped_exists_ok",
      })
    }
  }

  if (outcomes.some((o) => o.status === "mismatch")) {
    console.error("Refusing to write: mismatched existing account(s):")
    for (const o of outcomes.filter((x) => x.status === "mismatch")) {
      console.error(`  - ${o.email} (${o.role}): ${o.detail}`)
    }
    throw new Error("ZZ seed aborted due to account mismatches (no DB writes performed).")
  }

  if (plannedCreates.length === 0) {
    console.log("No new users to create. Existing ZZ role accounts look valid.")
    for (const o of outcomes) {
      console.log(`  SKIP  ${o.role.padEnd(16)} ${o.email}`)
    }
    console.log("\nAdmin was not modified. Done.")
    return
  }

  if (existsSync(credPath)) {
    throw new Error(
      `Need to create ${plannedCreates.length} user(s), but ${ZZ_CREDENTIALS_FILENAME} already exists. ` +
        "Archive/move that file first so new passwords are not overwritten. No DB writes performed."
    )
  }

  const createdCreds: Array<{ role: string; email: string; password: string }> = []

  for (const row of plannedCreates) {
    await centralPrisma.user.create({
      data: {
        institutionId: ZZ_INSTITUTION_ID,
        roleId: row.roleId,
        fullName: zzDisplayName(row.role),
        email: row.email,
        passwordHash: await hashPassword(row.password),
        status: "active",
      },
    })
    createdCreds.push({
      role: row.role,
      email: row.email,
      password: row.password,
    })
    outcomes.push({
      email: row.email,
      role: row.role,
      status: "created",
    })
  }

  writeCredentialsFile(credPath, createdCreds)

  console.log("Results (no secrets):")
  for (const o of outcomes) {
    if (o.status === "created") {
      console.log(`  CREATE ${o.role.padEnd(16)} ${o.email}`)
    } else if (o.status === "skipped_exists_ok") {
      console.log(`  SKIP   ${o.role.padEnd(16)} ${o.email}`)
    }
  }
  console.log(`\nNew credentials written to local gitignored file: ${ZZ_CREDENTIALS_FILENAME}`)
  console.log("Open that file on this machine only. Passwords were not printed.")
  console.log("Admin account was not modified.")
  console.log(
    "To disable a test user later: set central.users.status='disabled' for that email."
  )
}

function isExecutedAsMain(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href
  } catch {
    return false
  }
}

if (isExecutedAsMain()) {
  seedZzTestUsers()
    .catch((e) => {
      console.error(e instanceof Error ? e.message : String(e))
      process.exit(1)
    })
    .finally(async () => {
      await centralPrisma.$disconnect()
    })
}
