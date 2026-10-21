import "dotenv/config"
import { PrismaClient } from "../../../backend/node_modules/.prisma/tenant-client/index.js"
import { computePar } from "../lib/m3/par-computer.js"

const prisma = new PrismaClient()

const SAMPLE_BORROWERS = [
  {
    name: "Sunethra Bandara",
    nic: "198451203491",
    phone: "0771234891",
    district: "Colombo",
    income: 48000,
    occupation: "Textile & Garment Tailoring",
    amount: 120000,
    termMonths: 12,
    productCode: "MICRO",
    distressCategory: "early_warning_watch", // dropping repayments, late 14 days
    paidInstallments: 5,
    lateDays: 14,
  },
  {
    name: "Priyantha Jayasinghe",
    nic: "197820491823",
    phone: "0714920192",
    district: "Colombo",
    income: 55000,
    occupation: "Vegetable Distribution",
    amount: 150000,
    termMonths: 12,
    productCode: "MICRO",
    distressCategory: "early_warning_high", // consecutive missed = 2, late 24 days
    paidInstallments: 4,
    lateDays: 24,
  },
  {
    name: "Kumari Perera",
    nic: "199160293847",
    phone: "0783920194",
    district: "Kandy",
    income: 38000,
    occupation: "Spices & Agro-processing",
    amount: 75000,
    termMonths: 10,
    productCode: "GROUP",
    distressCategory: "early_warning_critical", // broken promises, late 28 days
    paidInstallments: 3,
    lateDays: 28,
  },
  {
    name: "Anura Wickramasinghe",
    nic: "198210394857",
    phone: "0702938471",
    district: "Colombo",
    income: 62000,
    occupation: "Carpentry & Furniture Workshop",
    amount: 200000,
    termMonths: 18,
    productCode: "MICRO",
    distressCategory: "stable",
    paidInstallments: 8,
    lateDays: 0,
  },
  {
    name: "Sandya Fernando",
    nic: "198971029384",
    phone: "0751928374",
    district: "Colombo",
    income: 42000,
    occupation: "Bakery & Confectionery",
    amount: 90000,
    termMonths: 12,
    productCode: "MICRO",
    distressCategory: "stable",
    paidInstallments: 6,
    lateDays: 0,
  },
  {
    name: "Nihal Rajapakse",
    nic: "197530491827",
    phone: "0778192039",
    district: "Kandy",
    income: 70000,
    occupation: "Tea Smallholding",
    amount: 250000,
    termMonths: 24,
    productCode: "MICRO",
    distressCategory: "par30_default", // 38 days past due
    paidInstallments: 7,
    lateDays: 38,
  },
  {
    name: "Chandani Silva",
    nic: "199380192837",
    phone: "0729384710",
    district: "Colombo",
    income: 36000,
    occupation: "Handloom Weaving",
    amount: 60000,
    termMonths: 10,
    productCode: "GROUP",
    distressCategory: "early_warning_watch",
    paidInstallments: 4,
    lateDays: 16,
  },
  {
    name: "Kamal Dissanayake",
    nic: "198640291847",
    phone: "0762938471",
    district: "Kandy",
    income: 50000,
    occupation: "Dairy Cattle Farming",
    amount: 110000,
    termMonths: 12,
    productCode: "MICRO",
    distressCategory: "stable",
    paidInstallments: 5,
    lateDays: 0,
  },
]

async function main() {
  console.log("Seeding realistic M3 borrowers and active loans...")

  // Fetch branches and products
  const branches = await prisma.branch.findMany()
  if (branches.length === 0) {
    throw new Error("No branches found. Run tenant seed first.")
  }
  const colomboBranch = branches.find((b) => b.district === "Colombo") ?? branches[0]
  const kandyBranch = branches.find((b) => b.district === "Kandy") ?? branches[0]

  const products = await prisma.loanProduct.findMany()
  const microProduct = products.find((p) => p.code === "MICRO") ?? products[0]
  const groupProduct = products.find((p) => p.code === "GROUP") ?? products[0]

  let createdBorrowers = 0
  let createdLoans = 0

  for (const item of SAMPLE_BORROWERS) {
    const branch = item.district === "Kandy" ? kandyBranch : colomboBranch
    const product = item.productCode === "GROUP" ? groupProduct : microProduct

    // 1. Upsert Borrower
    const borrower = await prisma.borrower.upsert({
      where: { nicNumber: item.nic },
      update: {
        fullName: item.name,
        contactNumber: item.phone,
        monthlyIncome: item.income,
        occupation: item.occupation,
        branchId: branch.id,
      },
      create: {
        branchId: branch.id,
        fullName: item.name,
        nicNumber: item.nic,
        contactNumber: item.phone,
        gender: "female",
        district: item.district,
        localityType: item.district === "Colombo" ? "urban" : "rural",
        monthlyIncome: item.income,
        incomeBand: item.income < 40000 ? "low" : item.income < 70000 ? "medium" : "high",
        occupation: item.occupation,
        status: "active",
        kycStatus: "verified",
      },
    })
    createdBorrowers++

    // 2. Clear previous loan if partially created to ensure clean seed
    const existingLoan = await prisma.loan.findFirst({
      where: { borrowerId: borrower.id },
    })
    if (existingLoan) {
      await prisma.loan.delete({ where: { id: existingLoan.id } })
    }

    if (true) {
      // Create Application
      const application = await prisma.loanApplication.create({
        data: {
          branchId: branch.id,
          productId: product.id,
          applicationType: item.productCode === "GROUP" ? "group" : "individual",
          borrowerId: borrower.id,
          requestedAmount: item.amount,
          requestedTermMonths: item.termMonths,
          purpose: item.occupation,
          submittedBy: "00000000-0000-4000-8000-000000000001",
          status: "approved",
          decisionNotes: "Approved under standard underwriting criteria",
        },
      })

      // Create Loan
      const loan = await prisma.loan.create({
        data: {
          applicationId: application.id,
          productId: product.id,
          borrowerId: borrower.id,
          principal: item.amount,
          interestRate: Number(product.defaultInterestRate),
          termMonths: item.termMonths,
          status: "active",
          activatedAt: new Date(Date.now() - 120 * 24 * 3600 * 1000), // activated 4 months ago
        },
      })
      createdLoans++

      // Create Repayment Schedule (e.g. 10 or 12 installments)
      const monthlyPrincipal = Math.round(item.amount / item.termMonths)
      const monthlyInterest = Math.round((item.amount * (Number(product.defaultInterestRate) / 100)) / item.termMonths)
      const monthlyInstallment = monthlyPrincipal + monthlyInterest

      for (let i = 1; i <= item.termMonths; i++) {
        // Due date: i months after activation (approx i * 30 days)
        const dueOffsetDays = (i - 4) * 30 - (item.lateDays > 0 && i === item.paidInstallments + 1 ? item.lateDays : 0)
        const dueDate = new Date(Date.now() + dueOffsetDays * 24 * 3600 * 1000)

        const isPaid = i <= item.paidInstallments
        const schedule = await prisma.repaymentSchedule.create({
          data: {
            loanId: loan.id,
            installmentNo: i,
            dueDate,
            principalDue: monthlyPrincipal,
            interestDue: monthlyInterest,
            amountDue: monthlyInstallment,
            amountPaid: isPaid ? monthlyInstallment : 0,
            status: isPaid ? "paid" : dueDate < new Date() ? "overdue" : "upcoming",
          },
        })

        // If paid, create Collection record
        if (isPaid) {
          await prisma.collection.create({
            data: {
              loanId: loan.id,
              scheduleId: schedule.id,
              officerId: "00000000-0000-4000-8000-000000000001",
              visitDate: new Date(dueDate.getTime() - 2 * 24 * 3600 * 1000),
              outcome: "collected",
              amountCollected: monthlyInstallment,
              syncedOfflineEntry: false,
            },
          })
        }
      }
    }
  }

  // Compute PAR
  console.log("Computing initial PAR status for seeded portfolio...")
  const parSummary = await computePar(prisma)
  console.log("PAR computation result:", parSummary)

  console.log(`Seeding finished. Borrowers: ${createdBorrowers}, Loans: ${createdLoans}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
