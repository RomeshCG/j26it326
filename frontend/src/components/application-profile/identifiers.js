const CUSTOMER_SEQ_KEY = "mf_customer_code_seq"
const GROUP_SEQ_KEY = "mf_group_no_seq"
const PRODUCT_SEQ_KEY = "mf_product_code_seq"

const BRANCH_CODES = {
  "Colombo Head Office": "COL",
  "Kandy Branch": "KDY",
  "Galle Branch": "GAL",
}

function nextSequence(key) {
  const current = Number(localStorage.getItem(key) || "0") + 1
  localStorage.setItem(key, String(current))
  return current
}

function branchCode(branch = "") {
  if (BRANCH_CODES[branch]) return BRANCH_CODES[branch]
  const slug = branch
    .replace(/branch/gi, "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
  return slug.slice(0, 3) || "GEN"
}

export function generateCustomerCode() {
  const seq = nextSequence(CUSTOMER_SEQ_KEY)
  return `CUS-${String(seq).padStart(6, "0")}`
}

export function generateGroupNo(branch = "") {
  const seq = nextSequence(GROUP_SEQ_KEY)
  return `GRP-${branchCode(branch)}-${String(seq).padStart(3, "0")}`
}

export function generateProductCode() {
  const seq = nextSequence(PRODUCT_SEQ_KEY)
  return `VH-${String(seq).padStart(4, "0")}`
}

export function assignApplicationIdentifiers(form, branch = "", options = {}) {
  const { includeProductCode = false } = options
  const next = {
    ...form,
    customerCode: form.customerCode || generateCustomerCode(),
    groupNo: form.groupNo || generateGroupNo(branch),
  }
  if (includeProductCode && !next.productCode) {
    next.productCode = generateProductCode()
  }
  return next
}

export function ensureApplicationIdentifiers(form, branch = "", options = {}) {
  const needsProduct = options.includeProductCode && !form.productCode
  if (form.customerCode && form.groupNo && !needsProduct) return form
  return assignApplicationIdentifiers(form, branch, options)
}
