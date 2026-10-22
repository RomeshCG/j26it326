/**
 * Push a local/wizard application into M3 DB:
 * borrower → application → submit → approve → loan (pending_disbursement).
 * Used by the loan-officer disbursement screen so the demo works without Bruno.
 */

import { fetchTenantBranches } from "@/lib/api"
import {
  approveApplication,
  createApplication,
  createBorrower,
  createProduct,
  getBorrowers,
  getProducts,
  submitApplication,
} from "@/lib/m3-api"

function unwrapList(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  return []
}

function pickBranch(branches, preferredName) {
  const list = unwrapList(branches)
  if (!list.length) return null
  const name = String(preferredName || "").toLowerCase()
  if (name && name !== "—" && name !== "-") {
    const match = list.find((b) => String(b.name || "").toLowerCase().includes(name.split(" ")[0]))
    if (match) return match
  }
  return list.find((b) => b.isActive !== false) || list[0]
}

async function ensureProduct() {
  const existing = unwrapList(await getProducts())
  if (existing.length) return existing[0]

  return createProduct({
    code: `CONS-${Date.now().toString().slice(-6)}`,
    name: "Consumer loan",
    productCategory: "Consumer",
    defaultInterestRate: 18,
    minAmount: 10000,
    maxAmount: 500000,
    minTermMonths: 3,
    maxTermMonths: 36,
  })
}

/** Last resort if tenant was never seeded — BM seed script is preferred. */
async function ensureBranchOrThrow(preferredName) {
  const branchRes = await fetchTenantBranches()
  const branch = pickBranch(branchRes?.data ?? branchRes, preferredName)
  if (branch?.id) return branch
  throw new Error(
    "No branch found in tenant DB. From backend/ run: npm run seed:ruwani  (creates Colombo Head Office + Ruwani)"
  )
}

async function ensureBorrower(app, branchId) {
  const nic = String(app.nic || "").trim()
  if (nic && nic !== "—") {
    const found = unwrapList(await getBorrowers({ search: nic }))
    const hit = found.find(
      (b) => String(b.nicNumber || "").toLowerCase() === nic.toLowerCase()
    )
    if (hit) return hit
  }

  return createBorrower({
    branchId,
    fullName: app.fullName || "Unnamed borrower",
    nicNumber: nic && nic !== "—" ? nic : `TEMP-${Date.now()}`,
    contactNumber: app.phone || app.contactNo || undefined,
    district: app.district && app.district !== "—" ? app.district : undefined,
    occupation: app.occupation || undefined,
    monthlyIncome: app.monthlyIncome ? Number(app.monthlyIncome) : undefined,
  })
}

/**
 * @param {object} app — disbursement summary (+ optional form fields)
 * @returns {Promise<{ borrowerId, applicationId, loanId, loan }>}
 */
export async function ensureApprovedLoan(app) {
  const amount = Number(app.amount)
  if (!amount || amount <= 0) {
    throw new Error("Loan amount is required before approve")
  }

  const branch = await ensureBranchOrThrow(app.district)

  const product = await ensureProduct()
  if (!product?.id) {
    throw new Error("Could not create or load a loan product")
  }

  const borrower = await ensureBorrower(app, branch.id)
  const termMonths = Math.max(1, Number(app.tenure) || 12)

  const application = await createApplication({
    branchId: branch.id,
    productId: product.id,
    applicationType: "individual",
    borrowerId: borrower.id,
    requestedAmount: amount,
    requestedTermMonths: termMonths,
    purpose: app.product || "Consumer loan",
    purposeDetail: app.purpose || undefined,
  })

  await submitApplication(application.id)

  const approved = await approveApplication(application.id, {
    approvedAmount: amount,
    termMonths,
    decisionNotes: "Approved after M1 risk review (loan officer UI)",
  })

  // m3-api unwraps { data }; shape is { application, loan, scheduleCount }
  const loan = approved?.loan
  if (!loan?.id) {
    throw new Error("Approve succeeded but no loan id was returned")
  }

  return {
    borrowerId: borrower.id,
    applicationId: application.id,
    loanId: loan.id,
    loan,
  }
}
