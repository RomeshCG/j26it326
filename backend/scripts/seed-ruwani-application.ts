/**
 * Seed Ruwani Perera + submitted loan application for the BM approve demo.
 * Also ensures Colombo Head Office branch + Consumer product exist
 * (fixes: "No branch found in tenant DB").
 *
 * Usage (from backend/):
 *   npx tsx scripts/seed-ruwani-application.ts
 */
import "dotenv/config"
import { PrismaClient } from "../node_modules/.prisma/tenant-client/index.js"

const prisma = new PrismaClient()

const COLOMBO_BRANCH_ID = "10000000-0000-4000-8000-000000000001"
const SUBMITTED_BY = "00000000-0000-4000-8000-0000000000a1"

const RUWANI = {
  fullName: "Ruwani Perera",
  nicNumber: "905678912V",
  contactNumber: "0774567890",
  gender: "female",
  dateOfBirth: new Date("1990-06-14"),
  addressLine: "No. 28, High Level Road, Nugegoda",
  district: "Colombo",
  localityType: "urban",
  monthlyIncome: 48000,
  incomeBand: "medium",
  occupation: "Tailor / home sewing",
  householdSize: 4,
  isNewToBanking: false,
}

const WIZARD_PAYLOAD = {
  loanType: "consumer",
  applicantType: "individual",
  form: {
    branch: "Colombo Head Office",
    assignedBranch: "Colombo Head Office",
    centerName: "Colombo Central 07",
    contactNo: "0774567890",
    loanAmount: "85000",
    terms: "12",
    installment: "8200",
    salutation: "Mrs",
    civilStatus: "Married",
    nameWithInitials: "R. Perera",
    fullName: RUWANI.fullName,
    preferredName: "Ruwani",
    dateOfBirth: "1990-06-14",
    nic: RUWANI.nicNumber,
    address: RUWANI.addressLine,
    occupation: RUWANI.occupation,
    phoneMobile: RUWANI.contactNumber,
    email: "ruwani.perera@example.com",
    purpose: "Working capital for fabric & machine upgrade",
    facilityType: "Consumer loan",
    applicationDate: "2026-10-21",
    interestRate: "18",
    interestPeriod: "Monthly",
    spouse: {
      name: "Asanka Perera",
      occupation: "Driver",
      phone: "0712345678",
      nic: "882345678V",
    },
    income: {
      netSalary: "0",
      otherIncome: "48000",
      livingExpenses: "22000",
      otherIncomeDetails: "Home-based garment stitching orders",
      existingRentals: "0",
      otherDebtService: "3500",
      proposedCommitment: "8200",
    },
  },
  riskDemo: {
    riskScore: 77,
    classification: "LOW",
    defaultProbability: 23,
  },
}

async function ensureBranch() {
  return prisma.branch.upsert({
    where: { id: COLOMBO_BRANCH_ID },
    update: { name: "Colombo Head Office", district: "Colombo", isActive: true },
    create: {
      id: COLOMBO_BRANCH_ID,
      name: "Colombo Head Office",
      location: "Colombo 03",
      district: "Colombo",
      isActive: true,
    },
  })
}

async function ensureProduct() {
  return prisma.loanProduct.upsert({
    where: { code: "CONSUMER" },
    update: { name: "Consumer loan", isActive: true },
    create: {
      code: "CONSUMER",
      name: "Consumer loan",
      productCategory: "Consumer",
      defaultInterestRate: 18,
      minAmount: 10000,
      maxAmount: 500000,
      minTermMonths: 3,
      maxTermMonths: 36,
      isActive: true,
    },
  })
}

async function main() {
  console.log("=== Seed Ruwani Perera (submitted application for BM approve) ===\n")

  if (!process.env.TENANT_DATABASE_URL) {
    throw new Error("TENANT_DATABASE_URL missing in backend/.env")
  }

  const branch = await ensureBranch()
  console.log(`Branch OK: ${branch.name} (${branch.id})`)

  const product = await ensureProduct()
  console.log(`Product OK: ${product.name} (${product.id})`)

  const borrower = await prisma.borrower.upsert({
    where: { nicNumber: RUWANI.nicNumber },
    update: {
      ...RUWANI,
      branchId: branch.id,
      kycStatus: "verified",
      status: "active",
    },
    create: {
      ...RUWANI,
      branchId: branch.id,
      kycStatus: "verified",
      status: "active",
    },
  })
  console.log(`Borrower OK: ${borrower.fullName} · ${borrower.nicNumber} (${borrower.id})`)

  // Remove prior Ruwani apps/loans so re-seed is idempotent for the demo path
  const priorApps = await prisma.loanApplication.findMany({
    where: { borrowerId: borrower.id },
    select: { id: true },
  })
  for (const app of priorApps) {
    await prisma.loan.deleteMany({ where: { applicationId: app.id } })
    await prisma.loanApplication.delete({ where: { id: app.id } })
  }

  const application = await prisma.loanApplication.create({
    data: {
      branchId: branch.id,
      productId: product.id,
      applicationType: "individual",
      borrowerId: borrower.id,
      requestedAmount: 85000,
      requestedTermMonths: 12,
      purpose: "Consumer loan",
      purposeDetail: "Working capital for fabric & machine upgrade",
      wizardPayload: WIZARD_PAYLOAD,
      submittedBy: SUBMITTED_BY,
      status: "submitted",
      decisionNotes: null,
    },
  })

  console.log(`\nApplication READY (status=submitted): ${application.id}`)
  console.log("\nNext steps:")
  console.log("  1. Login as branch.manager@apex.lk")
  console.log("  2. Open Branch Manager → Pending loan approvals")
  console.log("  3. Click Approve on Ruwani Perera")
  console.log("  4. Then Confirm disbursement (loan officer or BM)")
  console.log("\nRisk report deep link state (paste into browser console if needed):")
  console.log(
    JSON.stringify(
      {
        applicationId: application.id,
        applicant: { name: RUWANI.fullName, nic: RUWANI.nicNumber, date: "2026-10-21" },
        loanAmount: 85000,
        product: "Consumer loan",
        branch: "Colombo Head Office",
        features: {
          contract_amount: 85000,
          tenure: 12,
          installment: 8200,
          interest_amount: 15300,
          branch: "Colombo Head Office",
          product: "Consumer loan",
          product_category: "Consumer",
          product_type: "Monthly",
        },
      },
      null,
      2
    )
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
