import { PrismaClient } from "../../node_modules/.prisma/central-client/index.js"

const globalForPrisma = globalThis as unknown as {
  centralPrisma?: PrismaClient
}

export const centralPrisma =
  globalForPrisma.centralPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.centralPrisma = centralPrisma
}
