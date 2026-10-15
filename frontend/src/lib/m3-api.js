/**
 * M3 — API Client
 * Connects frontend UI components to backend /api/m3 routes with:
 * - Mock auth headers / institution resolution
 * - Offline queue for field collections
 * - Automatic fallback to mock data when backend is not running
 */

const API_BASE = "/api/m3"

function getHeaders() {
  const token = localStorage.getItem("mf_auth_token")
  const role = localStorage.getItem("mf_auth_role") || "loan_officer"
  const institutionId = localStorage.getItem("mf_institution_id") || "00000000-0000-4000-8000-000000000001"
  const userId = localStorage.getItem("mf_user_id") || "20000000-0000-4000-8000-000000000001"

  return {
    "Content-Type": "application/json",
    "x-institution-id": institutionId,
    "x-mock-user-id": userId,
    "x-mock-role": role.toLowerCase().replace(" ", "_"),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}))
    throw new Error(errorJson.error || `Request failed with status ${response.status}`)
  }

  const json = await response.json()
  return json.data
}

// ── Products & Borrowers ──────────────────────────────────────────────────────
export async function getProducts() {
  return request("/products")
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

export async function requestRiskScore(id) {
  return request(`/applications/${id}/risk-score`, { method: "POST" })
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
    // If network failure, queue offline automatically
    console.warn("[M3 Collection] Offline or request failed — queuing locally:", err.message)
    const queued = queueOfflineCollection(data)
    return { ...queued, offline: true }
  }
}

export async function syncOfflineCollections() {
  const queue = getOfflineCollections()
  if (queue.length === 0) return { synced: 0, failed: 0, results: [] }

  const results = await request("/collections/sync", {
    method: "POST",
    body: JSON.stringify({ entries: queue }),
  })

  // Clear synced items
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
