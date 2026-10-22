/**
 * M3 — API Client (live JWT edition)
 * ====================================
 * Connects frontend UI components to backend /api/m3 routes.
 *
 * Auth: reads the JWT Bearer token stored by M4 login flow
 *       (localStorage key "mf_auth_token") — same key used by api.js.
 *       No mock headers are sent in production.
 *
 * Offline: field collections are queued in localStorage when the network
 *          is unavailable and synced on reconnect.
 *
 * Error handling: all errors are normalised to { message, status } so UI
 *                 components can display them without extra parsing.
 */

import { getApiBaseUrl } from "./api.js"

// Derive M3 prefix from the same base URL used by the rest of the app
function getM3Base() {
  return `${getApiBaseUrl()}/api/m3`
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

function getAuthHeaders() {
  const token = localStorage.getItem("mf_auth_token")
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return headers
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function request(path, options = {}) {
  const url = `${getM3Base()}${path}`

  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    })
  } catch (err) {
    const networkErr = new Error(
      `Network error reaching ${url}: ${err.message}`
    )
    networkErr.isNetworkError = true
    throw networkErr
  }

  // Let the global auth layer in api.js handle 401s via redirect;
  // here we just parse and throw a meaningful error.
  if (response.status === 401) {
    localStorage.removeItem("mf_auth_token")
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login?expired=true"
    }
    throw new Error("Session expired — please log in again")
  }

  const contentType = response.headers.get("content-type") || ""
  let data
  if (contentType.includes("application/json")) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    const msg =
      (data && typeof data === "object" && (data.error || data.message)) ||
      `Request failed with status ${response.status}`
    const err = new Error(msg)
    err.status = response.status
    err.data = data
    throw err
  }

  // Backend M3 routes return { data: ... }
  return data && typeof data === "object" && "data" in data ? data.data : data
}

// ── Products & Borrowers ──────────────────────────────────────────────────────

export async function getProducts() {
  return request("/products")
}

export async function createProduct(data) {
  return request("/products", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getBorrowers(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/borrowers${qs ? `?${qs}` : ""}`)
}

export async function getBorrower(id) {
  return request(`/borrowers/${id}`)
}

export async function createBorrower(data) {
  return request("/borrowers", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateBorrower(id, data) {
  return request(`/borrowers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

// ── Applications & Approvals ──────────────────────────────────────────────────

export async function getApplications(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/applications${qs ? `?${qs}` : ""}`)
}

export async function getApplication(id) {
  return request(`/applications/${id}`)
}

export async function createApplication(data) {
  return request("/applications", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function submitApplication(id) {
  return request(`/applications/${id}/submit`, { method: "POST" })
}

export async function approveApplication(id, approvalData) {
  return request(`/applications/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(approvalData),
  })
}

export async function rejectApplication(id, rejectionReason) {
  return request(`/applications/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ rejectionReason }),
  })
}

/**
 * Request a risk assessment from M1's credit model for an application.
 * Calls POST /api/m3/applications/:id/risk-score which internally calls
 * M1's POST /api/risk/assess — M3 never reads M1's model weights directly.
 */
export async function requestRiskScore(id) {
  return request(`/applications/${id}/risk-score`, { method: "POST" })
}

/**
 * Pre-submission risk assessment directly from M1's model / contract.
 * Allows loan officers to see live M1 credit scores inline in the application form.
 */
export async function assessPreApplicationRisk(formData) {
  return request("/applications/assess-risk", {
    method: "POST",
    body: JSON.stringify(formData),
  })
}

// ── Loans & Disbursements ─────────────────────────────────────────────────────

export async function getLoans(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/loans${qs ? `?${qs}` : ""}`)
}

export async function getLoan(id) {
  return request(`/loans/${id}`)
}

export async function getLoanSchedule(id) {
  return request(`/loans/${id}/schedule`)
}

export async function disburseLoan(id, disburseData) {
  return request(`/loans/${id}/disburse`, {
    method: "POST",
    body: JSON.stringify(disburseData),
  })
}

// ── Field Collections & Offline Queue ─────────────────────────────────────────

const OFFLINE_COLLECTIONS_KEY = "imfs_offline_collections_v1"

export function getOfflineCollections() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_COLLECTIONS_KEY) || "[]")
  } catch {
    return []
  }
}

export function queueOfflineCollection(entry) {
  const queue = getOfflineCollections()
  const localId = `off-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
  const item = { ...entry, localId, queuedAt: new Date().toISOString() }
  queue.push(item)
  localStorage.setItem(OFFLINE_COLLECTIONS_KEY, JSON.stringify(queue))
  return item
}

export async function recordCollection(data) {
  try {
    return await request("/collections", {
      method: "POST",
      body: JSON.stringify(data),
    })
  } catch (err) {
    if (err.isNetworkError || err.status >= 500) {
      console.warn("[M3 Collection] Offline or server error — queuing locally:", err.message)
      const queued = queueOfflineCollection(data)
      return { ...queued, offline: true }
    }
    throw err
  }
}

export async function syncOfflineCollections() {
  const queue = getOfflineCollections()
  if (queue.length === 0) return { synced: 0, failed: 0, results: [] }

  const results = await request("/collections/sync", {
    method: "POST",
    body: JSON.stringify({ entries: queue }),
  })

  localStorage.removeItem(OFFLINE_COLLECTIONS_KEY)
  return results
}

// ── PAR & EWS ────────────────────────────────────────────────────────────────

export async function getParSummary() {
  return request("/par/summary")
}

export async function computePar() {
  return request("/par/compute", { method: "POST" })
}

export async function getEwsAlerts(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/ews/alerts${qs ? `?${qs}` : ""}`)
}

export async function getEwsAlert(id) {
  return request(`/ews/alerts/${id}`)
}

export async function acknowledgeEwsAlert(id) {
  return request(`/ews/alerts/${id}/acknowledge`, { method: "PATCH" })
}

export async function logIntervention(alertId, data) {
  return request(`/ews/alerts/${alertId}/interventions`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// ── Groups ────────────────────────────────────────────────────────────────────

export async function getGroups(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/groups${qs ? `?${qs}` : ""}`)
}

export async function getGroup(id) {
  return request(`/groups/${id}`)
}

export async function createGroup(data) {
  return request("/groups", {
    method: "POST",
    body: JSON.stringify(data),
  })
}
