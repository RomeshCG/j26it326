import "dotenv/config"
import { PrismaClient } from "../../../backend/node_modules/.prisma/tenant-client/index.js"

const prisma = new PrismaClient()

async function main() {
  try {
    const branches = await prisma.branch.findMany({ select: { id: true, name: true } })
    const borrowers = await prisma.borrower.count()
    const loans = await prisma.loan.count()
    const alerts = await prisma.ewsAlert.count()
    const scores = await prisma.ewsScore.count()
    console.log("DB_STATUS:", JSON.stringify({ branches, borrowers, loans, alerts, scores }))
  } catch (err) {
    console.error("DB_ERROR:", err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
