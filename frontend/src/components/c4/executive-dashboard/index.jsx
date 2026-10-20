import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"
import { useStore } from "@/store"
import { fetchAgentActions } from "@/lib/api"
import { toBackendRole } from "@/lib/roles"

/** Backend roles with agents:decide_tier3 (matches Tier Approvals / Graduated Trust). */
const TIER3_DECIDER_ROLES = ["admin", "executive", "branch_manager"]

const FEED_LIMIT = 8

const formatLKR = (amount) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Relative time — same approach as Agent Log (API `createdAt` only). */
function getRelativeTime(timestamp) {
  if (!timestamp) return "—"
  try {
    const diffMs = new Date(timestamp) - new Date()
    const diffSec = Math.round(diffMs / 1000)
    const diffMin = Math.round(diffSec / 60)
    const diffHours = Math.round(diffMin / 60)
    const diffDays = Math.round(diffHours / 24)

    if (Math.abs(diffMin) < 60) return `${Math.abs(diffMin)}m ago`
    if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)}h ago`
    if (Math.abs(diffDays) === 1) return "yesterday"
    return `${Math.abs(diffDays)}d ago`
  } catch {
    return String(timestamp)
  }
}

function getAgentColor(agentId) {
  switch (agentId) {
    case "A1":
      return "bg-purple-500"
    case "A2":
      return "bg-blue-500"
    case "A3":
      return "bg-red-500"
    case "A4":
      return "bg-teal-500"
    default:
      return "bg-slate-500"
  }
}

function formatStatusLabel(status) {
  if (!status) return "—"
  return String(status).replace(/_/g, " ")
}

function getTierLabel(tier) {
  switch (tier) {
    case 1:
      return "Auto-execute"
    case 2:
      return "Execute + notify"
    case 3:
      return "Human approval"
    case 4:
      return "Alert only"
    default:
      return "Unknown"
  }
}

function getTierBadgeClass(tier) {
  switch (tier) {
    case 1:
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
    case 2:
      return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
    case 3:
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
    case 4:
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

const RECENT_STAFF_ACT = [
  { id: 1, text: "Payroll processed — Dec 2024", time: "2 hours ago" },
  { id: 2, text: "2 leave requests approved", time: "5 hours ago" },
  { id: 3, text: "1 new staff added — Kandy branch", time: "1 day ago" },
]

export default function ExecutiveDashboard() {
  const openAgentPanel = useStore((state) => state.openAgentPanel)
  const currentUser = useStore((state) => state.currentUser)
  const userRole =
    currentUser?.backendRole || toBackendRole(currentUser?.role)
  const canDecideTier3 = TIER3_DECIDER_ROLES.includes(userRole)
  const [actions, setActions] = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedError, setFeedError] = useState(null)
  const feedReqIdRef = useRef(0)

  const applyFeedError = useCallback((err) => {
    setActions([])
    const status = err?.status
    if (status === 401) {
      setFeedError("Session expired. Sign in again to view agent activity.")
    } else if (status === 403) {
      setFeedError("You do not have permission to view agent actions.")
    } else {
      setFeedError(err?.message || "Failed to load agent activity.")
    }
  }, [])

  const loadAgentFeed = useCallback(async () => {
    const reqId = ++feedReqIdRef.current
    setFeedLoading(true)
    setFeedError(null)
    try {
      const res = await fetchAgentActions({ page: 1, limit: FEED_LIMIT })
      if (reqId !== feedReqIdRef.current) return
      setActions(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      if (reqId !== feedReqIdRef.current) return
      applyFeedError(err)
    } finally {
      if (reqId === feedReqIdRef.current) {
        setFeedLoading(false)
      }
    }
  }, [applyFeedError])

  // Mount-only fetch: avoid sync setState in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    const reqId = ++feedReqIdRef.current
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetchAgentActions({ page: 1, limit: FEED_LIMIT })
        if (cancelled || reqId !== feedReqIdRef.current) return
        setActions(Array.isArray(res?.data) ? res.data : [])
        setFeedError(null)
      } catch (err) {
        if (cancelled || reqId !== feedReqIdRef.current) return
        applyFeedError(err)
      } finally {
        if (!cancelled && reqId === feedReqIdRef.current) {
          setFeedLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyFeedError])

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="z-10 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border bg-background/80 px-8 py-6 backdrop-blur-md sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
            Good morning, Jane
          </h1>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <span>Apex Microfinance</span>
            <span className="text-muted-foreground/60">•</span>
            <span>
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400">
          <span className="size-2 animate-pulse rounded-full bg-green-500" />
          All agents active
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-border">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
              <Wallet className="text-blue-600 dark:text-blue-400" size={20} />
              Loan Portfolio
            </h2>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Total Active Loans
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  1,247
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Total Disbursed
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  {formatLKR(48300000)}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">PAR30</div>
                <div className="text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">
                  4.2%
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Collection Rate
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  91.3%
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="mb-2 text-xs text-muted-foreground">
                Portfolio by Product
              </div>
              <div className="flex h-6 w-full overflow-hidden rounded-md">
                <div className="h-full w-[45%] bg-blue-500" title="Group Loan: 45%" />
                <div className="h-full w-[30%] bg-emerald-500" title="Individual: 30%" />
                <div className="h-full w-[15%] bg-amber-500" title="Agri: 15%" />
                <div className="h-full w-[10%] bg-purple-500" title="SME: 10%" />
              </div>
              <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-blue-500" /> Group
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500" /> Individual
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-amber-500" /> Agri
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-purple-500" /> SME
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View Full Report <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
              <TrendingUp
                className="text-emerald-600 dark:text-emerald-400"
                size={20}
              />
              Finance — December 2024
            </h2>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  P&L This Month
                </div>
                <div className="text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">
                  +{formatLKR(1250000)}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">OSS</div>
                <div className="text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">
                  112%
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Cash Position
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  {formatLKR(8400000)}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Accounts Payable
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  {formatLKR(410000)}
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="mb-2 text-xs text-muted-foreground">
                P&L Trend (Last 6 Months)
              </div>
              <div className="flex h-12 w-full items-end gap-1 opacity-80">
                <svg
                  className="h-full w-full"
                  viewBox="0 0 100 30"
                  preserveAspectRatio="none"
                >
                  <polyline
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    points="0,20 20,15 40,25 60,10 80,15 100,5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polygon
                    fill="url(#gradient)"
                    points="0,30 0,20 20,15 40,25 60,10 80,15 100,5 100,30"
                    opacity="0.2"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                View P&L Report <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
              <Users className="text-purple-600 dark:text-purple-400" size={20} />
              Human Resources
            </h2>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Total Headcount
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  42
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Payroll This Month
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  {formatLKR(2150000)}
                </div>
              </div>
              <div className="relative rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="absolute -top-2 -right-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
                  2
                </div>
                <div className="mb-1 text-xs text-muted-foreground">
                  Leave Requests
                </div>
                <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                  Pending
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">New Joiners</div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  1
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="mb-3 text-xs text-muted-foreground">
                Recent HR Activity
              </div>
              <div className="space-y-3">
                {RECENT_STAFF_ACT.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-4"
                  >
                    <div className="text-sm text-foreground/80">{act.text}</div>
                    <div className="whitespace-nowrap text-xs text-muted-foreground">
                      {act.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Link
                to="/payroll"
                className="flex items-center gap-1 text-sm font-medium text-purple-600 transition-colors hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
              >
                View Payroll <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm ring-1 ring-blue-500/10 transition-colors">
            <h2 className="mb-4 flex items-center justify-between text-base font-semibold text-foreground">
              <div className="flex items-center gap-2">
                <Activity className="text-blue-600 dark:text-blue-400" size={20} />
                Agent Activity
              </div>
              <div className="flex items-center gap-1">
                {!feedLoading && !feedError && (
                  <>
                    <span className="size-2 animate-pulse rounded-full bg-blue-500" />
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      Live Feed
                    </span>
                  </>
                )}
                {feedLoading && (
                  <span className="text-xs font-medium text-muted-foreground">
                    Loading…
                  </span>
                )}
              </div>
            </h2>

            <div className="relative -mr-2 max-h-[300px] flex-1 space-y-4 overflow-y-auto pr-2">
              {feedLoading && (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Loading agent activity…
                </div>
              )}

              {!feedLoading && feedError && (
                <div className="flex h-40 flex-col items-center justify-center gap-3 px-2 text-center">
                  <p className="text-sm text-muted-foreground">{feedError}</p>
                  <button
                    type="button"
                    onClick={loadAgentFeed}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!feedLoading && !feedError && actions.length === 0 && (
                <div className="flex h-40 items-center justify-center px-2 text-center text-sm text-muted-foreground">
                  No agent actions recorded for this tenant yet.
                </div>
              )}

              {!feedLoading && !feedError && actions.length > 0 && (
                <>
                  <div className="absolute top-4 bottom-4 left-[15px] z-0 w-px bg-border" />

                  {actions.map((act) => {
                    const isPending =
                      act.status === "pending_approval" && act.tier === 3
                    const approvalLink =
                      isPending && canDecideTier3
                        ? `/tier-approval?action=${act.id}`
                        : null
                    const statusLabel = formatStatusLabel(act.status)

                    const card = (
                      <div className="flex-1 rounded-xl border border-border/60 bg-muted/50 p-3">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <div className="text-sm font-medium text-foreground">
                            {act.agentName || act.agentId || "—"}
                          </div>
                          <div
                            className="text-xs text-muted-foreground"
                            title={act.createdAt || undefined}
                          >
                            {getRelativeTime(act.createdAt)}
                          </div>
                        </div>
                        <div className="mb-2 text-sm leading-snug text-foreground/80">
                          {act.action || "—"}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div
                            className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${getTierBadgeClass(act.tier)}`}
                          >
                            Tier {act.tier} · {getTierLabel(act.tier)}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] capitalize text-muted-foreground">
                            {(act.status === "executed" ||
                              act.status === "notified") && (
                              <CheckCircle
                                size={10}
                                className="text-green-600 dark:text-green-400"
                              />
                            )}
                            {act.status === "pending_approval" && (
                              <Clock
                                size={10}
                                className="text-amber-600 dark:text-amber-400"
                              />
                            )}
                            {(act.status === "failed" ||
                              act.status === "rejected" ||
                              act.status === "alert_only") && (
                              <AlertCircle
                                size={10}
                                className="text-red-600 dark:text-red-400"
                              />
                            )}
                            {statusLabel}
                          </div>
                        </div>
                        {approvalLink && (
                          <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                            Click to review and approve →
                          </p>
                        )}
                      </div>
                    )

                    return (
                      <div key={act.id} className="relative z-10 flex gap-4">
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${getAgentColor(act.agentId)} text-xs font-bold text-white shadow-lg ring-4 ring-card`}
                        >
                          {act.agentId || "—"}
                        </div>
                        {approvalLink ? (
                          <Link
                            to={approvalLink}
                            className="flex-1 cursor-pointer transition-opacity hover:opacity-90"
                          >
                            {card}
                          </Link>
                        ) : (
                          <div className="flex-1">{card}</div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            <div className="mt-4 flex justify-between gap-3 border-t border-border/60 pt-4">
              <Link
                to="/graduated-trust"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Graduated Trust <ChevronRight size={16} />
              </Link>
              <Link
                to="/agent-log"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View Full Agent Log <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-card p-6 shadow-sm">
          <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-3xl" />

          <h2 className="relative z-10 mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
            <span className="flex size-6 items-center justify-center rounded bg-blue-500 text-xs font-bold text-white">
              A4
            </span>
            Ask MicroFlow — Agent 4
          </h2>
          <p className="relative z-10 mb-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Agent 4 answers grounded Graduated Trust questions via the shared Ask
            Agent 4 panel (tenant API). This dashboard no longer simulates
            PAR, collection, or EPF replies.
          </p>
          <button
            type="button"
            onClick={() => openAgentPanel()}
            className="relative z-10 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-500"
          >
            <MessageCircle size={18} />
            Open Ask Agent 4
            <Sparkles size={16} className="opacity-80" />
          </button>
        </div>
      </div>
    </div>
  )
}
