/**
 * Seeds the M2 demo data into the DEFAULT tenant DB (TENANT_DATABASE_URL) from the Python outputs in
 * ml/m2_mission_intel/data/processed/ (run make_m2_synthetic.py and mdi/run_mdi.py first).
 *
 *   npx tsx scripts/seed-m2-demo.ts
 *
 * - chart of accounts
 * - journals_monthly.csv  -> journal entries via the single balanced posting function (data_source = synthetic)
 * - kpi_monthly.csv + ledger -> financial_kpi_snapshots (OSS, OER, yield computed from JOURNAL LINES by the backend;
 *                                PAR30 and portfolio/avg loan size from the CSV)
 * - social_monthly.csv    -> social_performance_indicators
 * - mdi_monthly.csv       -> mission_drift_scores (+ an alert for every month in state "alert")
 *
 * Re-runnable: it replaces previously seeded synthetic journals and upserts the monthly rows.
 * Safe: it only touches M2 tables of the default tenant DB. Never point it at a shared integration DB (5437).
 */
import "dotenv/config"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defaultTenantPrisma as prisma } from "../src/lib/prisma-tenant.js"
import { Prisma } from "../node_modules/.prisma/tenant-client/index.js"
import { postJournalEntry, seedChartOfAccounts, type LineInput } from "../src/lib/m2/ledger.js"
import { monthlyJournalKpis } from "../src/lib/m2/reports.js"

const here = path.dirname(fileURLToPath(import.meta.url))
const PROC = path.resolve(here, "../../ml/m2_mission_intel/data/processed")

/** Minimal CSV parser (handles quoted fields with commas/quotes; our files have no embedded newlines). */
function parseCsv(file: string): Record<string, string>[] {
  const text = fs.readFileSync(path.join(PROC, file), "utf8").replace(/^\uFEFF/, "").trim()
  const lines = text.split(/\r?\n/)
  const split = (line: string): string[] => {
    const out: string[] = []
    let cur = ""
    let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') q = false
        else cur += ch
      } else if (ch === '"') q = true
      else if (ch === ",") {
        out.push(cur)
        cur = ""
      } else cur += ch
    }
    out.push(cur)
    return out
  }
  const header = split(lines[0]!)
  return lines.slice(1).map((l) => {
    const cells = split(l)
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]))
  })
}

const monthStart = (m: string) => new Date(`${m}-01T00:00:00.000Z`) // m = YYYY-MM
const monthEnd = (m: string) => {
  const s = monthStart(m)
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0))
}
const dec = (v: string) => new Prisma.Decimal(v)

async function main() {
  console.log("Seeding M2 demo data into the default tenant DB...")
  const accounts = await seedChartOfAccounts(prisma)
  console.log(`  chart of accounts: ${accounts}`)

  // ---- journals
  const deleted = await prisma.journalEntry.deleteMany({ where: { dataSource: "synthetic" } })
  const rows = parseCsv("journals_monthly.csv")
  const byRef = new Map<string, Record<string, string>[]>()
  for (const r of rows) {
    const list = byRef.get(r.entry_ref!) ?? []
    list.push(r)
    byRef.set(r.entry_ref!, list)
  }
  let entries = 0
  for (const [ref, lines] of byRef) {
    const first = lines[0]!
    const lineInputs: LineInput[] = lines.map((l) => ({
      accountCode: l.account_code!,
      debit: dec(l.debit!),
      credit: dec(l.credit!),
    }))
    // lines with 0/0 cannot occur; zero side is simply 0
    await postJournalEntry(prisma, {
      transactionDate: monthEnd(first.month!),
      referenceType: `m2_seed_${first.entry_type}`,
      description: `${first.description} [${ref}]`,
      dataSource: "synthetic",
      lines: lineInputs,
    })
    entries++
  }
  console.log(`  journals: replaced ${deleted.count}, posted ${entries} balanced entries`)

  // ---- KPIs (OSS / OER / yield from the ledger)
  const kpiRows = parseCsv("kpi_monthly.csv")
  for (const r of kpiRows) {
    const month = r.month!
    const k = await monthlyJournalKpis(prisma, monthStart(month), monthEnd(month))
    const data = {
      par30: dec(r.par30!),
      oss: k.oss === null ? null : new Prisma.Decimal(k.oss),
      oer: k.oer === null ? null : new Prisma.Decimal(k.oer),
      portfolioYield: k.portfolioYield === null ? null : new Prisma.Decimal(k.portfolioYield),
      portfolioOutstanding: dec(r.portfolio!),
      avgLoanSize: dec(r.avg_loan_size!),
      dataSource: r.data_source!,
    }
    await prisma.financialKpiSnapshot.upsert({
      where: { period: monthStart(month) },
      update: data,
      create: { period: monthStart(month), ...data },
    })
  }
  console.log(`  KPI snapshots: ${kpiRows.length}`)

  // ---- social indicators
  const socRows = parseCsv("social_monthly.csv")
  for (const r of socRows) {
    const data = {
      femaleBorrowerRatio: dec(r.female!),
      ruralBorrowerRatio: dec(r.rural!),
      lowIncomeClientRatio: dec(r.low_income!),
      newToBankingRatio: dec(r.new_to_banking!),
      dropoutRate: dec(r.dropout!),
      povertyProxyScore: dec(r.poverty!), // share of borrowers below the poverty line
      dataSource: r.data_source!,
    }
    await prisma.socialPerformanceIndicator.upsert({
      where: { period: monthStart(r.month!) },
      update: data,
      create: { period: monthStart(r.month!), ...data },
    })
  }
  console.log(`  social indicators: ${socRows.length}`)

  // ---- MDI scores + alerts (evidence = contributingTrends of the linked score)
  const mdiRows = parseCsv("mdi_monthly.csv")
  let alerts = 0
  for (const r of mdiRows) {
    const trends = JSON.parse(r.contributingTrends!) as {
      label: string
      relativeChange: number
      contribution: number
    }[]
    const data = {
      mdiScore: dec(r.score!),
      thresholdState: r.state!,
      contributingTrends: trends as unknown as Prisma.InputJsonValue,
      dataSource: r.data_source!,
    }
    const score = await prisma.missionDriftScore.upsert({
      where: { period: monthStart(r.month!) },
      update: data,
      create: { period: monthStart(r.month!), ...data },
    })
    if (r.state === "alert") {
      const existing = await prisma.missionDriftAlert.findFirst({ where: { mdiScoreId: score.id } })
      if (!existing) {
        // narrative is templated from the evidence only: no invented numbers
        const top = trends
          .filter((t) => t.contribution > 0)
          .slice(0, 3)
          .map((t) => `${t.label} ${(t.relativeChange * 100).toFixed(1)}%`)
          .join("; ")
        await prisma.missionDriftAlert.create({
          data: {
            mdiScoreId: score.id,
            narrative: `MDI ${Number(r.score).toFixed(1)} exceeds threshold ${r.threshold} for ${r.month}. Main drivers: ${top}. (Synthetic demo scenario.)`,
          },
        })
        alerts++
      }
    }
  }
  console.log(`  MDI scores: ${mdiRows.length}, new alerts: ${alerts}`)
  console.log("Done.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
