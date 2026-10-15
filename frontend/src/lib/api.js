/**
 * API client and session management for IMFS MicroFlow ERP
 * Handles JWT bearer authentication, error normalization, and session caching.
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "")

// In-memory session verification cache (persists for the page load lifecycle)
let sessionVerified = false
let sessionUser = null

export function getApiBaseUrl() {
  return API_BASE_URL
}

export function clearSessionCache() {
  sessionVerified = false
  sessionUser = null
}

export function setSessionCache(userData) {
  sessionVerified = true
  sessionUser = userData
}

export function getCachedSession() {
  return sessionUser
}

/**
 * Decodes the JWT exp claim client-side (UX-only check, untrusted).
 * Performs NO network call and never throws.
 * Returns true ONLY if the token is a valid JWT with an expired exp claim.
 * Returns false for non-JWT strings (e.g. "fake-jwt-token", "xyz123invalid")
 * or tokens without an exp claim, letting the server handle validation.
 */
export function isJwtExpired(token) {
  if (!token || typeof token !== "string") return false
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return false
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    const payload = JSON.parse(jsonPayload)
    if (typeof payload.exp !== "number") return false
    return Date.now() >= payload.exp * 1000
  } catch {
    return false
  }
}

/**
 * Universal API fetch wrapper
 * @param {string} endpoint - API path (e.g. "/auth/login", "/auth/me")
 * @param {RequestInit} [options] - fetch options
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`
  const token = localStorage.getItem("mf_auth_token")

  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  }

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(url, {
      ...options,
      headers,
    })
  } catch (error) {
    // Network / server unreachable error - dynamic API_BASE_URL
    const errorMsg = `Unable to reach authentication server at ${API_BASE_URL}. Please verify the server is running.`
    const networkErr = new Error(errorMsg, { cause: error })
    networkErr.isNetworkError = true
    networkErr.apiUrl = API_BASE_URL
    throw networkErr
  }

  // Handle 401 Unauthorized
  // CRITICAL: The 401 handler must NOT run for /auth/login
  const isLoginCall = endpoint.includes("/auth/login")

  if (response.status === 401 && !isLoginCall) {
    clearSessionCache()
    localStorage.removeItem("mf_auth_token")
    localStorage.removeItem("mf_auth_role")
    localStorage.removeItem("mf_auth_branch")
    
    // Redirect to login with expired flag if not already on login
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login?expired=true"
    }
  }

  let data
  const contentType = response.headers.get("content-type")
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    const error = new Error(
      (data && typeof data === "object" && (data.error || data.message)) ||
      `Request failed with status ${response.status}`
    )
    error.status = response.status
    error.data = data
    const retryHeader = response.headers.get("retry-after")
    if (retryHeader) {
      const parsed = parseInt(retryHeader, 10)
      error.retryAfter = !isNaN(parsed) ? parsed : retryHeader
    }
    throw error
  }

  if (data && typeof data === "object") {
    data._status = response.status
  }

  return data
}

/**
 * Register and provision a new tenant institution
 * POST /auth/register-institution
 */
export async function registerInstitution(payload) {
  return await apiRequest("/auth/register-institution", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/**
 * Verify an institution domain with a one-time token
 * POST /auth/domains/verify
 */
export async function verifyDomainToken(token) {
  return await apiRequest("/auth/domains/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  })
}

/**
 * Real backend login
 * POST /auth/login
 */
export async function loginUser(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  
  if (data?.token) {
    localStorage.setItem("mf_auth_token", data.token)
  }
  
  if (data?.user) {
    setSessionCache(data.user)
  }
  
  return data
}

/**
 * M1 credit risk assessment
 * POST /api/risk/assess
 * @param {{ features: Record<string, unknown>, persist?: boolean, loanApplicationId?: string }} body
 */
export async function assessRisk(body) {
  return apiRequest("/api/risk/assess", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/**
 * Verify session with GET /auth/me ONCE per page load, cached in memory.
 * Does not re-fetch on every route change.
 */
export async function verifySessionOnce() {
  const token = localStorage.getItem("mf_auth_token")
  if (!token) {
    clearSessionCache()
    return null
  }

  // Check if mock auth is active
  if (import.meta.env.VITE_USE_MOCK_AUTH === "true") {
    sessionVerified = true
    return {
      userId: "mock-admin-id",
      email: "",
      fullName: "Mock Administrator",
      role: "admin",
      branch: "Head Office",
      capabilities: ["*"],
    }
  }

  // Return in-memory cached session if already verified during this page load
  if (sessionVerified && sessionUser) {
    return sessionUser
  }

  try {
    const profile = await apiRequest("/auth/me")
    // Real /auth/me shape: { userId, email, fullName, institutionId, role, capabilities }
    // Fallback if there is no branch returned
    const normalizedUser = {
      ...profile,
      branch: profile.branch || "Head Office",
    }
    sessionVerified = true
    sessionUser = normalizedUser
    return normalizedUser
  } catch (error) {
    clearSessionCache()
    throw error
  }
}

/**
 * Lists agent actions with optional filters and pagination
 * GET /api/tenant/agent-actions
 */
export async function fetchAgentActions(params = {}) {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      query.set(key, String(val))
    }
  }
  const queryString = query.toString()
  const endpoint = `/api/tenant/agent-actions${queryString ? `?${queryString}` : ""}`
  return await apiRequest(endpoint)
}

/**
 * Fetches single agent action detail with full payloads
 * GET /api/tenant/agent-actions/:id
 */
export async function fetchAgentActionById(id) {
  return await apiRequest(`/api/tenant/agent-actions/${encodeURIComponent(id)}`)
}

/**
 * Records human override for executed/notified Tier 1 or Tier 2 action
 * POST /api/tenant/agent-actions/:id/override
 */
export async function overrideAgentAction(id, reason) {
  return await apiRequest(`/api/tenant/agent-actions/${encodeURIComponent(id)}/override`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

/**
 * Lists all configured agent tier policies
 * GET /api/tenant/agent-policies
 */
export async function fetchAgentPolicies() {
  return await apiRequest("/api/tenant/agent-policies")
}

