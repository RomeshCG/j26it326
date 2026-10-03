import "dotenv/config"
import { PrismaClient } from "../../node_modules/.prisma/tenant-client/index.js"

const prisma = new PrismaClient()

async function main() {
  await prisma.tenantInfo.upsert({
    where: { id: 1 },
    update: {
      institutionName: process.env.DEMO_INSTITUTION_NAME ?? "Apex Microfinance Ltd",
    },
    create: {
      id: 1,
      institutionId: "00000000-0000-4000-8000-000000000001",
      institutionName: process.env.DEMO_INSTITUTION_NAME ?? "Apex Microfinance Ltd",
    },
  })

  const colombo = await prisma.branch.upsert({
    where: { id: "10000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Colombo Head Office",
      location: "Colombo 03",
      district: "Colombo",
      isActive: true,
    },
  })

  await prisma.branch.upsert({
    where: { id: "10000000-0000-4000-8000-000000000002" },
    update: {},
    create: {
      id: "10000000-0000-4000-8000-000000000002",
      name: "Kandy Branch",
      location: "Kandy",
      district: "Kandy",
      isActive: true,
    },
  })

  const products = [
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

  for (const p of products) {
    await prisma.loanProduct.upsert({
      where: { code: p.code },
      update: { name: p.name, isActive: true },
      create: { ...p, isActive: true },
    })
  }

  const policies = [
    {
      actionType: "nlq_query",
      agentName: "NLQ",
      tier: 1,
      description: "Answer natural-language queries automatically",
    },
    {
      actionType: "budget_threshold_alert",
      agentName: "Workflow Orchestrator",
      tier: 2,
      description: "Execute alert and notify manager",
    },
    {
      actionType: "generate_cbsl_report",
      agentName: "Compliance",
      tier: 3,
      description: "Prepare CBSL report; human approval required",
    },
    {
      actionType: "volume_spike_alert",
      agentName: "Anomaly Detection",
      tier: 4,
      description: "Alert only — human decides next steps",
    },
  ] as const

  for (const policy of policies) {
    await prisma.agentTierPolicy.upsert({
      where: { actionType: policy.actionType },
      update: {
        agentName: policy.agentName,
        tier: policy.tier,
        description: policy.description,
        isActive: true,
      },
      create: { ...policy, isActive: true },
    })
  }

  const accounts = [
    { accountCode: "1000", accountName: "Cash", accountType: "asset" },
    { accountCode: "1200", accountName: "Loan Portfolio", accountType: "asset" },
    { accountCode: "2000", accountName: "Client Deposits", accountType: "liability" },
    { accountCode: "3000", accountName: "Equity", accountType: "equity" },
    { accountCode: "4000", accountName: "Interest Income", accountType: "income" },
    { accountCode: "5000", accountName: "Operating Expenses", accountType: "expense" },
  ] as const

  for (const a of accounts) {
    await prisma.chartOfAccount.upsert({
      where: { accountCode: a.accountCode },
      update: { accountName: a.accountName, isActive: true },
      create: { ...a, isActive: true },
    })
  }

  console.log("Tenant seed complete:", {
    branch: colombo.name,
    products: products.length,
    policies: policies.length,
    accounts: accounts.length,
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
