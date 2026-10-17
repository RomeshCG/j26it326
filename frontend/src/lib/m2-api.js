import { apiRequest } from "./api"

/**
 * Fetch Finance Manager Dashboard data
 * GET /api/m2/dashboard/finance
 */
export async function fetchFinanceDashboard() {
  return await apiRequest("/api/m2/dashboard/finance")
}

/**
 * Fetch Mission Drift Dashboard data
 * GET /api/m2/dashboard/drift
 */
export async function fetchMissionDriftDashboard() {
  return await apiRequest("/api/m2/dashboard/drift")
}

/**
 * Fetch latest Mission Drift Index detail
 * GET /api/m2/mdi/latest
 */
export async function fetchLatestMdi() {
  return await apiRequest("/api/m2/mdi/latest")
}

/**
 * Fetch Mission Drift Index history
 * GET /api/m2/mdi
 */
export async function fetchMdiHistory() {
  return await apiRequest("/api/m2/mdi")
}

/**
 * Fetch Mission Drift Alerts
 * GET /api/m2/alerts
 */
export async function fetchMissionDriftAlerts(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return await apiRequest(`/api/m2/alerts${query}`)
}

/**
 * Acknowledge or resolve an alert
 * PATCH /api/m2/alerts/:id
 */
export async function updateAlertStatus(id, status) {
  return await apiRequest(`/api/m2/alerts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

/**
 * Fetch Monthly Financial KPIs
 * GET /api/m2/kpis
 */
export async function fetchFinancialKpis() {
  return await apiRequest("/api/m2/kpis")
}

/**
 * Fetch Monthly Social Indicators
 * GET /api/m2/social
 */
export async function fetchSocialIndicators() {
  return await apiRequest("/api/m2/social")
}

/**
 * Fetch Profit & Loss report
 * GET /api/m2/reports/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function fetchPAndLReport(from, to) {
  return await apiRequest(`/api/m2/reports/pnl?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
}

/**
 * Fetch Balance Sheet report
 * GET /api/m2/reports/balance-sheet?asOf=YYYY-MM-DD
 */
export async function fetchBalanceSheet(asOf) {
  return await apiRequest(`/api/m2/reports/balance-sheet?asOf=${encodeURIComponent(asOf)}`)
}
