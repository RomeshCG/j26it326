import "dotenv/config"
import bcrypt from "bcryptjs"
import { centralPrisma } from "../lib/prisma-central.js"

async function main() {
  console.log("Setting up demo loan officer and admin with known password...")

  const salt = await bcrypt.genSalt(10)
  const passwordHash = await bcrypt.hash("Password123!", salt)

  const institution = await centralPrisma.institution.findFirstOrThrow()
  const loanOfficerRole = await centralPrisma.role.findUniqueOrThrow({ where: { name: "loan_officer" } })
  const adminRole = await centralPrisma.role.findUniqueOrThrow({ where: { name: "admin" } })

  // 1. Upsert Loan Officer
  const officer = await centralPrisma.user.upsert({
    where: { email: "officer@microflow.lk" },
    update: {
      passwordHash,
      status: "active",
      roleId: loanOfficerRole.id,
    },
    create: {
      id: "20000000-0000-4000-8000-000000000001",
      institutionId: institution.id,
      roleId: loanOfficerRole.id,
      fullName: "Anula Gamage",
      email: "officer@microflow.lk",
      passwordHash,
      status: "active",
    },
  })

  // 2. Update Admin
  await centralPrisma.user.updateMany({
    where: { email: "admin@microflow.lk" },
    data: { passwordHash, status: "active" },
  })

  console.log("Demo credentials ready:")
  console.log("  Loan Officer: officer@microflow.lk / Password123!")
  console.log("  Admin       : admin@microflow.lk / Password123!")
}

main()
  .catch(console.error)
  .finally(() => centralPrisma.$disconnect())
