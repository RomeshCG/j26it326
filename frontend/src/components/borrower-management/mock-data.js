export const BORROWER_FILTERS = [
  { id: "all", label: "All" },
  { id: "low", label: "Low Risk" },
  { id: "medium", label: "Medium Risk" },
  { id: "high", label: "High Risk" },
  { id: "ews", label: "Early Warning" },
]

export const PRODUCT_FILTERS = [
  { id: "all", label: "All products" },
  { id: "consumer", label: "Consumer / Normal" },
  { id: "vehicle", label: "Bike & Three-wheel" },
  { id: "vehicle-other", label: "Other vehicles" },
]

export const BORROWERS = [
  {
    id: "BR-001",
    name: "Kumari Fernando",
    nic: "895612347V",
    branch: "Gampaha Central",
    product: "Group Enterprise",
    loanCategory: "consumer",
    loanId: "LN-88421",
    outstanding: 86500,
    riskBand: "medium",
    riskScore: 62,
    ews: true,
    alertId: "EWS-1042",
    status: "active",
    officer: "Nimali Jayasuriya",
  },
  {
    id: "BR-002",
    name: "Ruwan Perera",
    nic: "901234567V",
    branch: "Gampaha Central",
    product: "Individual Working Capital",
    loanCategory: "consumer",
    loanId: "LN-88390",
    outstanding: 124000,
    riskBand: "low",
    riskScore: 81,
    ews: false,
    alertId: null,
    status: "active",
    officer: "Nimali Jayasuriya",
  },
  {
    id: "BR-003",
    name: "Sanduni Wickramasinghe",
    nic: "926781234V",
    branch: "Yakkala",
    product: "Agricultural Seasonal",
    loanCategory: "consumer",
    loanId: "LN-88211",
    outstanding: 54000,
    riskBand: "high",
    riskScore: 38,
    ews: true,
    alertId: "EWS-1038",
    status: "active",
    officer: "Nuwan Jayasuriya",
  },
  {
    id: "BR-004",
    name: "Ajith Bandara",
    nic: "883456789V",
    branch: "Miriswatta",
    product: "Group Enterprise",
    loanCategory: "consumer",
    loanId: "LN-88104",
    outstanding: 31200,
    riskBand: "low",
    riskScore: 78,
    ews: false,
    alertId: null,
    status: "active",
    officer: "Nimali Jayasuriya",
  },
  {
    id: "BR-005",
    name: "Fathima Nizar",
    nic: "915678123V",
    branch: "Ganemulla",
    product: "Housing Repair",
    loanCategory: "consumer",
    loanId: "LN-88077",
    outstanding: 198000,
    riskBand: "medium",
    riskScore: 58,
    ews: true,
    alertId: "EWS-1045",
    status: "active",
    officer: "Malkanthi Rathnayake",
  },
  {
    id: "BR-006",
    name: "Chathura Silva",
    nic: "932145678V",
    branch: "Colombo Head Office",
    product: "Consumer / Personal-Business",
    loanCategory: "consumer",
    loanId: null,
    outstanding: 0,
    riskBand: "high",
    riskScore: 34,
    ews: false,
    alertId: null,
    status: "pending",
    officer: "Nuwan Jayasuriya",
    applicationId: "APP-DEMO-006",
  },
  {
    id: "BR-007",
    name: "Nadeesha Gunasekara",
    nic: "877654321V",
    branch: "Kandy Branch",
    product: "Consumer / Personal-Business",
    loanCategory: "consumer",
    loanId: null,
    outstanding: 0,
    riskBand: "medium",
    riskScore: 55,
    ews: false,
    alertId: null,
    status: "pending",
    officer: "Sunil Bandara",
    applicationId: "APP-DEMO-007",
  },
  {
    id: "BR-008",
    name: "Amal Jayawardena",
    nic: "944321876V",
    branch: "Galle Branch",
    product: "Agricultural Seasonal",
    loanCategory: "consumer",
    loanId: "LN-87920",
    outstanding: 72000,
    riskBand: "low",
    riskScore: 84,
    ews: false,
    alertId: null,
    status: "active",
    officer: "Kumari Fernando",
  },
  {
    id: "BR-009",
    name: "Ishara Bandara",
    nic: "898765432V",
    branch: "Gampaha Central",
    product: "Group Enterprise",
    loanCategory: "consumer",
    loanId: "LN-87855",
    outstanding: 45600,
    riskBand: "high",
    riskScore: 41,
    ews: true,
    alertId: "EWS-1031",
    status: "active",
    officer: "Nimali Jayasuriya",
  },
  {
    id: "BR-010",
    name: "Malini Rathnayake",
    nic: "912345678V",
    branch: "Colombo Head Office",
    product: "Individual Working Capital",
    loanCategory: "consumer",
    loanId: null,
    outstanding: 0,
    riskBand: "low",
    riskScore: 88,
    ews: false,
    alertId: null,
    status: "pending",
    officer: "Nimal Silva",
    applicationId: "APP-DEMO-010",
  },
  {
    id: "BR-011",
    name: "Kasun Mendis",
    nic: "921234567V",
    branch: "Kandy Branch",
    product: "Hire Purchase · Bike",
    loanCategory: "vehicle",
    loanId: "LN-88501",
    outstanding: 142000,
    riskBand: "low",
    riskScore: 76,
    ews: false,
    alertId: null,
    status: "active",
    officer: "Nuwan Jayasuriya",
    applicationId: "APP-DEMO-008",
  },
  {
    id: "BR-012",
    name: "Sunil Premaratne",
    nic: "903456789V",
    branch: "Galle Branch",
    product: "Hire Purchase · Three-wheeler",
    loanCategory: "vehicle",
    loanId: null,
    outstanding: 0,
    riskBand: "medium",
    riskScore: 48,
    ews: false,
    alertId: null,
    status: "pending",
    officer: "Malkanthi Rathnayake",
    applicationId: "APP-DEMO-009",
  },
  {
    id: "BR-014",
    name: "Roshan De Silva",
    nic: "861234567V",
    branch: "Colombo Head Office",
    product: "Hire Purchase · Van",
    loanCategory: "vehicle-other",
    loanId: "LN-88544",
    outstanding: 1280000,
    riskBand: "medium",
    riskScore: 69,
    ews: false,
    alertId: null,
    status: "active",
    officer: "Nimal Silva",
    applicationId: "APP-DEMO-011",
  },
  {
    id: "BR-015",
    name: "Mahesh Jayawardena",
    nic: "882345678V",
    branch: "Galle Branch",
    product: "Vehicle Lease · Lorry",
    loanCategory: "vehicle-other",
    loanId: null,
    outstanding: 0,
    riskBand: "medium",
    riskScore: 52,
    ews: false,
    alertId: null,
    status: "pending",
    officer: "Kumari Fernando",
    applicationId: "APP-DEMO-013",
  },
  {
    id: "BR-016",
    name: "Priya Senanayake",
    nic: "936789012V",
    branch: "Kandy Branch",
    product: "Consumer / Personal-Business",
    loanCategory: "consumer",
    loanId: null,
    outstanding: 0,
    riskBand: "low",
    riskScore: 82,
    ews: false,
    alertId: null,
    status: "pending",
    officer: "Sunil Bandara",
    applicationId: "APP-DEMO-012",
  },
  {
    id: "BR-017",
    name: "Dilshan Perera",
    nic: "894567123V",
    branch: "Colombo Head Office",
    product: "Micro-Enterprise Loan",
    loanCategory: "consumer",
    loanId: null,
    outstanding: 0,
    riskBand: "medium",
    riskScore: 61,
    ews: false,
    alertId: null,
    status: "pending",
    officer: "Nimal Silva",
    applicationId: "APP-DEMO-014",
  },
]

export const BORROWER_ACCESS_ROLES = [
  "Institution Admin",
  "Branch Manager",
  "Loan Officer",
  "Finance Officer",
]

export function formatLkr(amount) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function loanCategoryMeta(category) {
  if (category === "vehicle") {
    return { label: "Vehicle", variant: "secondary" }
  }
  if (category === "vehicle-other") {
    return { label: "Other vehicle", variant: "outline" }
  }
  return { label: "Consumer", variant: "outline" }
}

export function riskBandMeta(band) {
  if (band === "low") {
    return {
      label: "Low",
      className:
        "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    }
  }
  if (band === "high") {
    return {
      label: "High",
      className: "border-transparent bg-destructive/15 text-destructive",
    }
  }
  return {
    label: "Medium",
    className:
      "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  }
}

export function filterBorrowers(
  borrowers,
  filterId,
  search = "",
  productFilterId = "all"
) {
  let result = borrowers

  if (filterId === "low") {
    result = result.filter((b) => b.riskBand === "low")
  } else if (filterId === "medium") {
    result = result.filter((b) => b.riskBand === "medium")
  } else if (filterId === "high") {
    result = result.filter((b) => b.riskBand === "high")
  } else if (filterId === "ews") {
    result = result.filter((b) => b.ews)
  }

  if (productFilterId === "consumer") {
    result = result.filter((b) => b.loanCategory === "consumer")
  } else if (productFilterId === "vehicle") {
    result = result.filter((b) => b.loanCategory === "vehicle")
  } else if (productFilterId === "vehicle-other") {
    result = result.filter((b) => b.loanCategory === "vehicle-other")
  }

  const query = search.trim().toLowerCase()
  if (query) {
    result = result.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.nic.toLowerCase().includes(query) ||
        b.branch.toLowerCase().includes(query) ||
        b.product.toLowerCase().includes(query) ||
        (b.loanId && b.loanId.toLowerCase().includes(query)) ||
        (b.applicationId && b.applicationId.toLowerCase().includes(query))
    )
  }

  return result
}
