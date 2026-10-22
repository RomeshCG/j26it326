/**
 * Shared demo portfolio seed (M1 / M2 / M3 UI — real DB rows, not frontend mock).
 *
 * Creates:
 *  - Branches: Colombo Head Office, Kandy, Galle
 *  - Products: MICRO, GROUP, CONSUMER, HIRE_PURCHASE
 *  - Borrowers + applications + loans in useful statuses:
 *      submitted          → Branch Manager "Pending loan approvals" (Ruwani + 1 more)
 *      pending_disbursement → ready for Confirm disbursement
 *      active             → borrower list / loan officer screens
 *      active + overdue schedules → overdue / collection demos
 *
 * Usage (from backend/):
 *   npm run seed:demo-portfolio
 *
 * Safe to re-run: upserts by NIC / product code / fixed branch UUIDs.
 * Does NOT wipe unrelated tenants or M2 journals (use seed:m2-demo separately).
 */
import "dotenv/config"
import { PrismaClient } from "../node_modules/.prisma/tenant-client/index.js"
import { generateSchedule } from "../src/lib/m3/schedule-generator.js"

const prisma = new PrismaClient()

const BRANCHES = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Colombo Head Office",
    location: "Colombo 03",
    district: "Colombo",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Kandy Branch",
    location: "Kandy",
    district: "Kandy",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Galle Branch",
    location: "Galle",
    district: "Galle",
  },
] as const

const PRODUCTS = [
  {
    code: "MICRO",
    name: "Microenterprise Loan",
    productCategory: "microloan",
    defaultInterestRate: 18,
    minAmount: 25000,
    maxAmount: 500000,
    minTermMonths: 6,
    maxTermMonths: 24,
  },
  {
    code: "GROUP",
    name: "Group Lending",
    productCategory: "group_lending",
    defaultInterestRate: 16,
    minAmount: 10000,
    maxAmount: 150000,
    minTermMonths: 6,
    maxTermMonths: 18,
  },
  {
    code: "CONSUMER",
    name: "Consumer loan",
    productCategory: "Consumer",
    defaultInterestRate: 18,
    minAmount: 10000,
    maxAmount: 500000,
    minTermMonths: 3,
    maxTermMonths: 36,
  },
  {
    code: "HIRE_PURCHASE",
    name: "Hire Purchase",
    productCategory: "hire_purchase",
    defaultInterestRate: 20,
    minAmount: 100000,
    maxAmount: 2000000,
    minTermMonths: 12,
    maxTermMonths: 48,
  },
] as const

const SUBMITTED_BY = "00000000-0000-4000-8000-0000000000a1"
const OFFICER_ID = "00000000-0000-4000-8000-0000000000a1"

type DemoRow = {
  fullName: string
  nicNumber: string
  contactNumber: string
  gender: "female" | "male"
  district: "Colombo" | "Kandy" | "Galle"
  occupation: string
  monthlyIncome: number
  amount: number
  termMonths: number
  productCode: (typeof PRODUCTS)[number]["code"]
  /** submitted | pending_disbursement | active | overdue */
  pipeline: "submitted" | "pending_disbursement" | "active" | "overdue"
  purpose: string
  paidInstallments?: number
}

const PORTFOLIO: DemoRow[] = [
  // BM approve queue — clearly different ticket sizes
  {
    fullName: "Ruwani Perera",
    nicNumber: "905678912V",
    contactNumber: "0774567890",
    gender: "female",
    district: "Colombo",
    occupation: "Tailor / home sewing",
    monthlyIncome: 48000,
    amount: 85000,
    termMonths: 12,
    productCode: "CONSUMER",
    pipeline: "submitted",
    purpose: "Working capital for fabric & machine upgrade",
  },
  {
    fullName: "Nimal Jayasuriya",
    nicNumber: "881234567V",
    contactNumber: "0718899001",
    gender: "male",
    district: "Kandy",
    occupation: "Vegetable vendor",
    monthlyIncome: 42000,
    amount: 45000,
    termMonths: 8,
    productCode: "MICRO",
    pipeline: "submitted",
    purpose: "Seasonal inventory",
  },
  // Ready to disburse
  {
    fullName: "Chathura Silva",
    nicNumber: "932145678V",
    contactNumber: "0772345678",
    gender: "male",
    district: "Colombo",
    occupation: "Retail vendor",
    monthlyIncome: 45000,
    amount: 110000,
    termMonths: 12,
    productCode: "MICRO",
    pipeline: "pending_disbursement",
    purpose: "Grocery stall expansion",
  },
  // Active healthy — spread of principals
  {
    fullName: "Malini Rathnayake",
    nicNumber: "912345678V",
    contactNumber: "0771122334",
    gender: "female",
    district: "Colombo",
    occupation: "Handicrafts",
    monthlyIncome: 38000,
    amount: 55000,
    termMonths: 10,
    productCode: "GROUP",
    pipeline: "active",
    purpose: "Working capital",
    paidInstallments: 5,
  },
  {
    fullName: "Kasun Mendis",
    nicNumber: "921234567V",
    contactNumber: "0773456789",
    gender: "male",
    district: "Kandy",
    occupation: "Delivery rider",
    monthlyIncome: 55000,
    amount: 275000,
    termMonths: 24,
    productCode: "HIRE_PURCHASE",
    pipeline: "active",
    purpose: "Bike hire purchase",
    paidInstallments: 6,
  },
  {
    fullName: "Nadeesha Gunasekara",
    nicNumber: "877654321V",
    contactNumber: "0719988776",
    gender: "female",
    district: "Kandy",
    occupation: "Boutique owner",
    monthlyIncome: 62000,
    amount: 165000,
    termMonths: 18,
    productCode: "MICRO",
    pipeline: "active",
    purpose: "Inventory purchase",
    paidInstallments: 8,
  },
  {
    fullName: "Sandya Fernando",
    nicNumber: "898012345V",
    contactNumber: "0751928374",
    gender: "female",
    district: "Galle",
    occupation: "Bakery",
    monthlyIncome: 42000,
    amount: 72000,
    termMonths: 12,
    productCode: "MICRO",
    pipeline: "active",
    purpose: "Oven upgrade",
    paidInstallments: 4,
  },
  {
    fullName: "Anura Wickramasinghe",
    nicNumber: "851122334V",
    contactNumber: "0702938471",
    gender: "male",
    district: "Colombo",
    occupation: "Carpentry",
    monthlyIncome: 62000,
    amount: 320000,
    termMonths: 24,
    productCode: "MICRO",
    pipeline: "active",
    purpose: "Workshop tools",
    paidInstallments: 10,
  },
  // Overdue loans (loan.status = overdue) — distinct amounts
  {
    fullName: "Sunethra Bandara",
    nicNumber: "845120349V",
    contactNumber: "0771234891",
    gender: "female",
    district: "Colombo",
    occupation: "Textile & garment",
    monthlyIncome: 48000,
    amount: 135000,
    termMonths: 12,
    productCode: "MICRO",
    pipeline: "overdue",
    purpose: "Working capital",
    paidInstallments: 5,
  },
  {
    fullName: "Priyantha Jayasinghe",
    nicNumber: "782049182V",
    contactNumber: "0714920192",
    gender: "male",
    district: "Colombo",
    occupation: "Vegetable distribution",
    monthlyIncome: 55000,
    amount: 210000,
    termMonths: 15,
    productCode: "MICRO",
    pipeline: "overdue",
    purpose: "Transport costs",
    paidInstallments: 4,
  },
  {
    fullName: "Kumari Fernando",
    nicNumber: "895612347V",
    contactNumber: "0783920194",
    gender: "female",
    district: "Kandy",
    occupation: "Spices processing",
    monthlyIncome: 38000,
    amount: 48000,
    termMonths: 10,
    productCode: "GROUP",
    pipeline: "overdue",
    purpose: "Raw materials",
    paidInstallments: 3,
  },
  {
    fullName: "Nihal Rajapakse",
    nicNumber: "753049182V",
    contactNumber: "0778192039",
    gender: "male",
    district: "Galle",
    occupation: "Tea smallholding",
    monthlyIncome: 70000,
    amount: 380000,
    termMonths: 24,
    productCode: "MICRO",
    pipeline: "overdue",
    purpose: "Seasonal inputs",
    paidInstallments: 7,
  },
]

function branchFor(district: DemoRow["district"]) {
  return BRANCHES.find((b) => b.district === district) ?? BRANCHES[0]
}

function incomeBand(income: number) {
  if (income < 40000) return "low"
  if (income < 70000) return "medium"
  return "high"
}

async function wipeBorrowerPipeline(borrowerId: string) {
  const apps = await prisma.loanApplication.findMany({
    where: { borrowerId },
    select: { id: true },
  })
  for (const app of apps) {
    const loans = await prisma.loan.findMany({
      where: { applicationId: app.id },
      select: { id: true },
    })
    for (const loan of loans) {
      await prisma.collection.deleteMany({ where: { loanId: loan.id } })
      await prisma.disbursement.deleteMany({ where: { loanId: loan.id } })
      await prisma.repaymentSchedule.deleteMany({ where: { loanId: loan.id } })
      await prisma.loan.delete({ where: { id: loan.id } })
    }
    await prisma.loanApplication.delete({ where: { id: app.id } })
  }
}

async function main() {
  console.log("=== IMFS shared demo portfolio seed ===\n")

  if (!process.env.TENANT_DATABASE_URL) {
    throw new Error("TENANT_DATABASE_URL missing in backend/.env")
  }

  for (const b of BRANCHES) {
    await prisma.branch.upsert({
      where: { id: b.id },
      update: { name: b.name, location: b.location, district: b.district, isActive: true },
      create: { ...b, isActive: true },
    })
  }
  console.log(`Branches: ${BRANCHES.length}`)

  const productByCode = new Map<string, { id: string; defaultInterestRate: unknown }>()
  for (const p of PRODUCTS) {
    const row = await prisma.loanProduct.upsert({
      where: { code: p.code },
      update: { name: p.name, isActive: true, productCategory: p.productCategory },
      create: { ...p, isActive: true },
    })
    productByCode.set(p.code, row)
  }
  console.log(`Products: ${PRODUCTS.length}`)

  let borrowers = 0
  let submitted = 0
  let pendingDisb = 0
  let active = 0
  let overdue = 0

  for (const item of PORTFOLIO) {
    const branch = branchFor(item.district)
    const product = productByCode.get(item.productCode)
    if (!product) throw new Error(`Missing product ${item.productCode}`)

    const borrower = await prisma.borrower.upsert({
      where: { nicNumber: item.nicNumber },
      update: {
        fullName: item.fullName,
        contactNumber: item.contactNumber,
        gender: item.gender,
        district: item.district,
        occupation: item.occupation,
        monthlyIncome: item.monthlyIncome,
        incomeBand: incomeBand(item.monthlyIncome),
        branchId: branch.id,
        kycStatus: "verified",
        status: "active",
        localityType: item.district === "Colombo" ? "urban" : "rural",
      },
      create: {
        branchId: branch.id,
        fullName: item.fullName,
        nicNumber: item.nicNumber,
        contactNumber: item.contactNumber,
        gender: item.gender,
        district: item.district,
        occupation: item.occupation,
        monthlyIncome: item.monthlyIncome,
        incomeBand: incomeBand(item.monthlyIncome),
        kycStatus: "verified",
        status: "active",
        localityType: item.district === "Colombo" ? "urban" : "rural",
        isNewToBanking: false,
        householdSize: 4,
      },
    })
    borrowers++

    await wipeBorrowerPipeline(borrower.id)

    const rate = Number(product.defaultInterestRate)
    const wizardPayload = {
      loanType: item.productCode === "HIRE_PURCHASE" ? "hire-purchase" : "consumer",
      form: {
        fullName: item.fullName,
        nic: item.nicNumber,
        branch: branch.name,
        assignedBranch: branch.name,
        loanAmount: String(item.amount),
        terms: String(item.termMonths),
        installment: String(Math.round(item.amount / item.termMonths)),
        phoneMobile: item.contactNumber,
        occupation: item.occupation,
        purpose: item.purpose,
        applicationDate: "2026-10-01",
        interestRate: String(rate),
      },
      riskDemo: { riskScore: 70, classification: "LOW", defaultProbability: 25 },
    }

    if (item.pipeline === "submitted") {
      await prisma.loanApplication.create({
        data: {
          branchId: branch.id,
          productId: product.id,
          applicationType: "individual",
          borrowerId: borrower.id,
          requestedAmount: item.amount,
          requestedTermMonths: item.termMonths,
          purpose: item.productCode === "CONSUMER" ? "Consumer loan" : item.purpose,
          purposeDetail: item.purpose,
          wizardPayload,
          submittedBy: SUBMITTED_BY,
          status: "submitted",
        },
      })
      submitted++
      continue
    }

    const application = await prisma.loanApplication.create({
      data: {
        branchId: branch.id,
        productId: product.id,
        applicationType: "individual",
        borrowerId: borrower.id,
        requestedAmount: item.amount,
        requestedTermMonths: item.termMonths,
        purpose: item.purpose,
        purposeDetail: item.purpose,
        wizardPayload,
        submittedBy: SUBMITTED_BY,
        status: "approved",
        reviewedBy: SUBMITTED_BY,
        reviewedAt: new Date(),
        decisionNotes: "Seeded demo approval",
      },
    })

    const monthsAgo = item.pipeline === "pending_disbursement" ? 0 : 4
    const activatedAt = new Date(Date.now() - monthsAgo * 30 * 24 * 3600 * 1000)

    if (item.pipeline === "pending_disbursement") {
      await prisma.loan.create({
        data: {
          applicationId: application.id,
          productId: product.id,
          borrowerId: borrower.id,
          principal: item.amount,
          interestRate: rate,
          termMonths: item.termMonths,
          status: "pending_disbursement",
        },
      })
      pendingDisb++
      continue
    }

    const loanStatus = item.pipeline === "overdue" ? "overdue" : "active"
    const loan = await prisma.loan.create({
      data: {
        applicationId: application.id,
        productId: product.id,
        borrowerId: borrower.id,
        principal: item.amount,
        interestRate: rate,
        termMonths: item.termMonths,
        status: loanStatus,
        activatedAt,
      },
    })

    await prisma.disbursement.create({
      data: {
        loanId: loan.id,
        amount: item.amount,
        method: "cash_at_branch",
        status: "completed",
        disbursedBy: OFFICER_ID,
        disbursedAt: activatedAt,
        notes: "Demo seed disbursement",
      },
    })

    const firstDue = new Date(activatedAt)
    firstDue.setMonth(firstDue.getMonth() + 1)
    const schedule = generateSchedule({
      principal: item.amount,
      annualInterestRate: rate / 100,
      termMonths: item.termMonths,
      firstDueDate: firstDue,
      method: "flat",
    })

    const paidCount = item.paidInstallments ?? 0
    const forceOverdue = item.pipeline === "overdue"

    const scheduleRows = schedule.map((row) => {
      const isPaid = row.installmentNo <= paidCount
      let dueDate = row.dueDate
      if (forceOverdue && row.installmentNo === paidCount + 1) {
        dueDate = new Date(Date.now() - 21 * 24 * 3600 * 1000)
      }
      const status = isPaid ? "paid" : dueDate < new Date() ? "overdue" : "upcoming"
      return {
        loanId: loan.id,
        installmentNo: row.installmentNo,
        dueDate,
        principalDue: row.principalDue,
        interestDue: row.interestDue,
        amountDue: row.amountDue,
        amountPaid: isPaid ? row.amountDue : 0,
        status,
      }
    })

    await prisma.repaymentSchedule.createMany({ data: scheduleRows })

    const createdSchedules = await prisma.repaymentSchedule.findMany({
      where: { loanId: loan.id, status: "paid" },
      orderBy: { installmentNo: "asc" },
    })

    if (createdSchedules.length) {
      await prisma.collection.createMany({
        data: createdSchedules.map((sched) => ({
          loanId: loan.id,
          scheduleId: sched.id,
          officerId: OFFICER_ID,
          visitDate: new Date(sched.dueDate.getTime() - 2 * 24 * 3600 * 1000),
          outcome: "collected",
          amountCollected: sched.amountDue,
          syncedOfflineEntry: false,
        })),
      })
    }

    if (forceOverdue) overdue++
    else active++
  }

  // ── EWS scores + alerts for overdue (and one watch) borrowers ─────────────
  const ewsTargets = [
    { nic: "845120349V", distress: 0.78, band: "high", days: 28, signal: "Payment delay" },
    { nic: "782049182V", distress: 0.71, band: "high", days: 24, signal: "Missed installments" },
    { nic: "895612347V", distress: 0.66, band: "high", days: 21, signal: "Payment delay" },
    { nic: "753049182V", distress: 0.82, band: "high", days: 35, signal: "PAR30 breach" },
    { nic: "898012345V", distress: 0.48, band: "watch", days: 12, signal: "Late repayment" },
  ] as const

  // Clear prior demo EWS rows for these borrowers (idempotent re-seed)
  const ewsBorrowers = await prisma.borrower.findMany({
    where: { nicNumber: { in: ewsTargets.map((t) => t.nic) } },
    select: { id: true, branchId: true, nicNumber: true, fullName: true },
  })
  const ewsBorrowerIds = ewsBorrowers.map((b) => b.id)
  if (ewsBorrowerIds.length) {
    const oldScores = await prisma.ewsScore.findMany({
      where: { borrowerId: { in: ewsBorrowerIds } },
      select: { id: true },
    })
    const oldScoreIds = oldScores.map((s) => s.id)
    if (oldScoreIds.length) {
      await prisma.intervention.deleteMany({
        where: { alert: { ewsScoreId: { in: oldScoreIds } } },
      })
      await prisma.ewsAlert.deleteMany({ where: { ewsScoreId: { in: oldScoreIds } } })
      await prisma.ewsScore.deleteMany({ where: { id: { in: oldScoreIds } } })
    }
  }

  let ewsAlerts = 0
  for (const target of ewsTargets) {
    const borrower = ewsBorrowers.find((b) => b.nicNumber === target.nic)
    if (!borrower) continue

    const loan = await prisma.loan.findFirst({
      where: { borrowerId: borrower.id, status: { in: ["active", "overdue"] } },
      orderBy: { createdAt: "desc" },
    })

    const score = await prisma.ewsScore.create({
      data: {
        borrowerId: borrower.id,
        distressScore: target.distress,
        riskBand: target.band,
        modelVersion: "demo_seed_rule_v1",
        fusionSummary: {
          signal: target.signal,
          daysPastDue: target.days,
          loanId: loan?.id ?? null,
          principal: loan ? Number(loan.principal) : null,
          source: "seed-demo-portfolio",
        },
      },
    })

    await prisma.ewsAlert.create({
      data: {
        ewsScoreId: score.id,
        branchId: borrower.branchId,
        rationale: `${borrower.fullName}: ${target.signal} (${target.days}d). Seeded EWS for LO demo.`,
        status: "new",
        assignedOfficerId: null,
      },
    })
    ewsAlerts++
  }

  console.log("\nSeed complete:")
  console.log(`  Borrowers:              ${borrowers}`)
  console.log(`  Submitted (BM approve): ${submitted}`)
  console.log(`  Pending disbursement:   ${pendingDisb}`)
  console.log(`  Active (healthy):       ${active}`)
  console.log(`  Active (overdue sched): ${overdue}`)
  console.log(`  EWS alerts:             ${ewsAlerts}`)
  console.log(`\nUI checks:`)
  console.log(`  BM  → /branch-manager  (Pending loan approvals)`)
  console.log(`  LO  → /loan-officer/borrowers  Live API`)
  console.log(`  LO  → /loan-officer/alerts     Early warning (Live API)`)
  console.log(`  LO  → disbursement for Chathura (pending_disbursement)`)
  console.log(`  LO  → overdue / collection for Sunethra / Kumari`)
  console.log(`\nOptional M2 finance seed (separate, needs processed CSVs):`)
  console.log(`  npm run seed:m2-demo`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
