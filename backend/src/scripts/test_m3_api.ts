import "dotenv/config"
import { PrismaClient as CentralPrismaClient } from "../../../backend/node_modules/.prisma/central-client/index.js"
import { signAccessToken } from "../lib/auth.js"
import type { RoleName } from "../lib/permissions.js"

const centralPrisma = new CentralPrismaClient()

async function main() {
  console.log("Testing real M4 auth token generation and M3 routes...")

  // Find admin or loan officer user
  const user = await centralPrisma.user.findFirst({
    include: { role: true, institution: true },
  })

  if (!user) {
    throw new Error("No user found in central DB")
  }

  console.log(`User: ${user.fullName} (${user.email}), Role: ${user.role.name}, Inst: ${user.institution.name}`)

  const token = signAccessToken({
    userId: user.id,
    institutionId: user.institutionId,
    role: user.role.name as RoleName,
  })

  console.log("Generated JWT Token:", token.slice(0, 30) + "...")

  // Call GET /api/m3/ews/alerts using fetch
  const res = await fetch("http://localhost:4000/api/m3/ews/alerts", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  console.log("HTTP Status:", res.status)
  const json = await res.json()
  console.log("Alerts count returned:", json.data?.length ?? 0)
  if (json.data && json.data.length > 0) {
    console.log("First Alert Sample:", {
      id: json.data[0].id,
      borrower: json.data[0].ewsScore?.borrower?.fullName,
      distressScore: json.data[0].ewsScore?.distressScore,
      riskBand: json.data[0].ewsScore?.riskBand,
      rationale: json.data[0].rationale,
    })
  }
}

main()
  .catch(console.error)
  .finally(() => centralPrisma.$disconnect())
