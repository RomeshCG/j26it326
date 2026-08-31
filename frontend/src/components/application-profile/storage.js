import { createApplication } from "./constants"
import { buildDemoApplications } from "./demo-seeds"
import { createVehicleApplication } from "./vehicle/constants"

const STORAGE_KEY = "mf_applications"

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(applications) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications))
}

function seedDemoApplications(existing) {
  const demos = buildDemoApplications()
  const byId = new Map(existing.map((app) => [app.id, app]))
  let changed = existing.length === 0

  for (const demo of demos) {
    if (!byId.has(demo.id)) {
      byId.set(demo.id, demo)
      changed = true
    }
  }

  const merged = Array.from(byId.values())
  if (changed) {
    writeAll(merged)
  }

  return merged
}

export function listApplications() {
  return seedDemoApplications(readAll())
}

export function getApplication(id) {
  return listApplications().find((app) => app.id === id) ?? null
}

export function saveApplication(application) {
  const apps = listApplications()
  const index = apps.findIndex((app) => app.id === application.id)
  const next = {
    ...application,
    updatedAt: new Date().toISOString(),
  }

  if (index >= 0) {
    apps[index] = next
  } else {
    apps.unshift(next)
  }

  writeAll(apps)
  return next
}

export function createAndSaveApplication(loanType, applicantType) {
  const application =
    loanType === "hire-purchase"
      ? createVehicleApplication(loanType)
      : createApplication(loanType, applicantType)
  return saveApplication(application)
}

export function getApplicationByBorrowerId(borrowerId) {
  return listApplications().find((app) => app.borrowerId === borrowerId) ?? null
}
