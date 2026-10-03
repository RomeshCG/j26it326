import "dotenv/config"
import { PrismaClient } from "../../node_modules/.prisma/central-client/index.js"

const prisma = new PrismaClient()

const ROLES = [
  "admin",
  "executive",
  "finance_officer",
  "hr_officer",
  "branch_manager",
  "loan_officer",
] as const

async function main() {
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  const institution = await prisma.institution.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {
      name: process.env.DEMO_INSTITUTION_NAME ?? "Apex Microfinance Ltd",
      status: "active",
    },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      name: process.env.DEMO_INSTITUTION_NAME ?? "Apex Microfinance Ltd",
      licenseNumber: process.env.DEMO_INSTITUTION_LICENSE ?? "MFI-DEMO-001",
      status: "active",
    },
  })

  const tenantUrl = process.env.TENANT_DATABASE_URL
  if (tenantUrl) {
    const url = new URL(tenantUrl.replace(/^postgresql:/, "http:"))
    await prisma.institutionDatabase.upsert({
      where: { dbIdentifier: "tenant_apex_demo" },
      update: {
        connectionUrl: tenantUrl,
        status: "active",
        dbHost: url.hostname,
        dbPort: Number(url.port || 5432),
        dbName: url.pathname.replace(/^\//, "") || "neondb",
      },
      create: {
        institutionId: institution.id,
        dbIdentifier: "tenant_apex_demo",
        dbHost: url.hostname,
        dbPort: Number(url.port || 5432),
        dbName: url.pathname.replace(/^\//, "") || "neondb",
        connectionUrl: tenantUrl,
        status: "active",
      },
    })
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } })
  await prisma.user.upsert({
    where: { email: "admin@microflow.lk" },
    update: {},
    create: {
      institutionId: institution.id,
      roleId: adminRole.id,
      fullName: "Jane Smith",
      email: "admin@microflow.lk",
      // placeholder hash — replace with real bcrypt when auth is wired
      passwordHash: "demo-password-not-hashed-yet",
      status: "active",
    },
  })

  console.log("Central seed complete:", {
    institution: institution.name,
    roles: ROLES.length,
    tenantRouting: Boolean(tenantUrl),
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
