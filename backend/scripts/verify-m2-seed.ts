/**
 * Verifies the seeded M2 data in the default tenant DB (run after seed-m2-demo.ts).
 *   npx tsx scripts/verify-m2-seed.ts
 */
import "dotenv/config"
import assert from "node:assert/strict"
import { defaultTenantPrisma as prisma } from "../src/lib/prisma-tenant.js"
import { balanceSheet, profitAndLoss } from "../src/lib/m2/reports.js"

async function main() {
  // every stored entry balances
  const lines = await prisma.journalEntryLine.findMany({ select: { journalEntryId: true, debitAmount: true, creditAmount: true } })
  const byEntry = new Map<string, { d: number; c: number }>()
  for (const l of lines) {
    const e = byEntry.get(l.journalEntryId) ?? { d: 0, c: 0 }
    e.d += Number(l.debitAmount)
    e.c += Number(l.creditAmount)
    byEntry.set(l.journalEntryId, e)
  }
  for (const [id, e] of byEntry) assert.ok(Math.abs(e.d - e.c) < 0.005, `entry ${id} unbalanced: ${e.d} vs ${e.c}`)
  console.log(`journal entries: ${byEntry.size}, all balanced`)

  // balance sheet balances at July 2026
  const bs = await balanceSheet(prisma, new Date("2026-07-31T00:00:00Z"))
  assert.ok(bs.balanced, "balance sheet does not balance")
  console.log(`balance sheet 2026-07-31: assets ${bs.totalAssets.toLocaleString()} = liabilities ${bs.totalLiabilities.toLocaleString()} + equity ${bs.totalEquity.toLocaleString()}`)

  // P&L for July
  const pl = await profitAndLoss(prisma, new Date("2026-07-01T00:00:00Z"), new Date("2026-07-31T00:00:00Z"))
  console.log(`P&L Jul 2026: income ${pl.totalIncome.toLocaleString()}, expenses ${pl.totalExpenses.toLocaleString()}, net ${pl.netIncome.toLocaleString()}`)

  const kpi = await prisma.financialKpiSnapshot.findMany({ orderBy: { period: "asc" } })
  const july = kpi[kpi.length - 1]!
  console.log(
    `KPI Jul 2026 (${july.dataSource}): PAR30 ${(Number(july.par30) * 100).toFixed(2)}%, OSS ${july.oss}, OER ${july.oer}, yield ${july.portfolioYield}, portfolio ${Number(july.portfolioOutstanding).toLocaleString()}`
  )
  assert.equal(july.dataSource, "par")

  const mdi = await prisma.missionDriftScore.findMany({ orderBy: { period: "asc" } })
  const latest = mdi[mdi.length - 1]!
  assert.equal(latest.thresholdState, "alert", "July must produce an alert")
  const alerts = await prisma.missionDriftAlert.count({ where: { mdiScoreId: latest.id } })
  assert.ok(alerts >= 1, "alert missing for July")
  console.log(`MDI Jul 2026: ${latest.mdiScore} (${latest.thresholdState}), alerts linked: ${alerts}`)
  console.log("verify-m2-seed: OK")
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
