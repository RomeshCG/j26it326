import "dotenv/config"
import crypto from "crypto"
import { centralPrisma } from "../src/lib/prisma-central.js"
import { hashPassword } from "../src/lib/auth.js"
import { ROLES, type RoleName } from "../src/lib/permissions.js"

const DEMO_INSTITUTION_ID = "00000000-0000-4000-8000-000000000001"

/**
 * Creates or updates 6 demo test users (one per role) in the demo institution.
 * Passwords can be passed via environment variables (e.g., TEST_ADMIN_PASSWORD)
 * or are securely generated and printed ONCE to stdout.
 * Note: Never store passwords in git or commit files.
 */
async function seedTestUsers() {
  console.log("=== IMFS M4: Seed Test Users for Demo Institution ===\n")

  const credentials: Array<{ role: RoleName; email: string; password: string }> = []

  for (const roleName of ROLES) {
    const roleRecord = await centralPrisma.role.findUnique({
      where: { name: roleName },
    })

    if (!roleRecord) {
      console.error(`Role '${roleName}' not found in database. Run db:seed:central first.`)
      continue
    }

    const email = `${roleName.replace(/_/g, ".")}@apex.lk`
    const envPasswordKey = `TEST_${roleName.toUpperCase()}_PASSWORD`
    const rawPassword = process.env[envPasswordKey] || `Apex#${crypto.randomBytes(6).toString("hex")}`
    const passwordHash = await hashPassword(rawPassword)

    await centralPrisma.user.upsert({
      where: { email },
      update: {
        roleId: roleRecord.id,
        passwordHash,
        status: "active",
      },
      create: {
        institutionId: DEMO_INSTITUTION_ID,
        roleId: roleRecord.id,
        fullName: `Apex Demo ${roleName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
        email,
        passwordHash,
        status: "active",
      },
    })

    credentials.push({ role: roleName, email, password: rawPassword })
  }

  console.log("Test users created successfully:")
  console.log("---------------------------------------------------------------------------------")
  for (const cred of credentials) {
    console.log(`Role: ${cred.role.padEnd(16)} | Email: ${cred.email.padEnd(28)} | Password: ${cred.password}`)
  }
  console.log("---------------------------------------------------------------------------------")
  console.log("Store these credentials in your local gitignored notes. They will not be printed again.\n")
}

seedTestUsers()
  .catch((e) => {
    console.error("Error seeding test users:", e)
    process.exit(1)
  })
  .finally(async () => {
    await centralPrisma.$disconnect()
  })
