export const EXECUTIVE_ROLES = ["Institution Admin", "Finance Officer", "Branch Manager"]

export function createDefaultBranchOverride() {
  return {
    enabled: false,
    requestedBranch: "",
    reason: "",
    status: "none",
  }
}

export function getAuthRole() {
  if (typeof window === "undefined") return "Institution Admin"
  try {
    const raw = localStorage.getItem("mf_auth_role")
    return raw || "Institution Admin"
  } catch {
    return "Institution Admin"
  }
}

export function getAuthBranch() {
  if (typeof window === "undefined") return ""
  try {
    return localStorage.getItem("mf_auth_branch") || ""
  } catch {
    return ""
  }
}

export function getBranchContext(role, assignedBranch, branches = []) {
  const branchOptions = branches.map((branch) => branch.name).filter(Boolean)
  const fallbackBranch = assignedBranch || branchOptions[0] || ""
  const isExecutive = EXECUTIVE_ROLES.includes(role)

  return {
    role,
    mode: isExecutive ? "select" : "assigned",
    assignedBranch: fallbackBranch,
    branchOptions,
  }
}

export function hydrateFormBranch(form, branchContext) {
  const branchOverride = {
    ...createDefaultBranchOverride(),
    ...(form.branchOverride || {}),
  }

  if (branchContext.mode === "assigned") {
    const assignedBranch = form.assignedBranch || branchContext.assignedBranch
    return {
      ...form,
      assignedBranch,
      branch: form.branch || assignedBranch,
      branchOverride,
    }
  }

  return {
    ...form,
    branchOverride,
  }
}

export function getEffectiveBranch(form) {
  const override = form.branchOverride
  if (override?.enabled && override.status === "approved" && override.requestedBranch) {
    return override.requestedBranch
  }
  return form.assignedBranch || form.branch || ""
}

export function isBranchOverridePending(form) {
  return Boolean(form.branchOverride?.enabled && form.branchOverride?.status === "pending")
}
