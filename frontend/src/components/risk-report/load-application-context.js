/**
 * Build risk-report navigation/assess context from an M3 loan application (API or local).
 * Ensures each borrower is scored on their own amount / tenure / branch — not the mock 150k defaults.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return UUID_RE.test(String(value || ""))
}

export function buildContextFromM3Application(app, navState = {}) {
  const form = app?.wizardPayload?.form || {}
  const amount = Number(
    navState.loanAmount ??
      app?.requestedAmount ??
      form.loanAmount ??
      form.financeAmount ??
      0
  )
  const tenure = Number(
    navState.features?.tenure ?? app?.requestedTermMonths ?? form.terms ?? 12
  )
  const installment = Number(
    navState.features?.installment ??
      form.installment ??
      (amount && tenure ? Math.round(amount / tenure) : 0)
  )
  const interestRate = Number(form.interestRate ?? 18)
  const interestAmount = Number(
    navState.features?.interest_amount ??
      (amount ? Math.round((amount * interestRate) / 100) : 0)
  )
  const branch =
    navState.branch ||
    form.branch ||
    form.assignedBranch ||
    "Colombo Head Office"
  const product =
    navState.product ||
    app?.product?.name ||
    form.facilityType ||
    app?.purpose ||
    "Consumer loan"
  const productCategory =
    navState.features?.product_category ||
    app?.product?.productCategory ||
    "Consumer"

  return {
    ...navState,
    applicationId: app?.id || navState.applicationId,
    loanAmount: amount > 0 ? amount : undefined,
    product,
    branch,
    applicant: {
      name:
        navState.applicant?.name ||
        app?.borrower?.fullName ||
        form.fullName ||
        "Applicant",
      nic:
        navState.applicant?.nic ||
        app?.borrower?.nicNumber ||
        form.nic ||
        "—",
      date:
        navState.applicant?.date ||
        form.applicationDate ||
        new Date().toISOString().slice(0, 10),
    },
    features: {
      contract_amount: amount > 0 ? amount : undefined,
      tenure: tenure || undefined,
      installment: installment > 0 ? installment : undefined,
      interest_amount: interestAmount > 0 ? interestAmount : undefined,
      branch,
      product,
      product_category: productCategory,
      product_type: navState.features?.product_type || "Monthly",
    },
  }
}
