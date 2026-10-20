import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Building2, Users, FileText, CheckCircle2, ShieldAlert } from "lucide-react"
import { useStore } from "@/store"
import { fetchPendingAgentActions } from "@/lib/api"
import { toBackendRole } from "@/lib/roles"

/** Backend roles with agents:decide_tier3 (matches Tier Approvals / Graduated Trust). */
const TIER3_DECIDER_ROLES = ["admin", "executive", "branch_manager"]

/** Honest placeholder for metrics with no tenant API wired to this dashboard. */
function UnavailableMetric({ detail = "Not connected" }) {
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-muted-foreground">-</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{detail}</div>
    </>
  )
}

export default function BranchManagerDashboard() {
  const currentUser = useStore((state) => state.currentUser)
  // Login and /auth/me do not return branch; mf_auth_branch / currentUser.branch are
  // frontend fallbacks (e.g. "Head Office"), not verified session identity.
  const branchLabel = "Your branch"
  const userRole =
    currentUser?.backendRole || toBackendRole(currentUser?.role)
  const canDecideTier3 = TIER3_DECIDER_ROLES.includes(userRole)

  const [pendingCount, setPendingCount] = useState(null)
  const [pendingError, setPendingError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!canDecideTier3) return undefined

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetchPendingAgentActions()
        if (cancelled) return
        const count =
          typeof res?.count === "number"
            ? res.count
            : Array.isArray(res?.data)
              ? res.data.length
              : 0
        setPendingCount(count)
        setPendingError(null)
      } catch (err) {
        if (cancelled) return
        setPendingCount(null)
        setPendingError(err?.message || "Failed to load pending approvals")
      }
    })()

    const onRefresh = () => {
      setRetryKey((k) => k + 1)
    }
    window.addEventListener("mf:tier3-pending-refresh", onRefresh)
    return () => {
      cancelled = true
      window.removeEventListener("mf:tier3-pending-refresh", onRefresh)
    }
  }, [canDecideTier3, retryKey])

  const pendingLoading =
    canDecideTier3 && pendingCount === null && !pendingError

  const handleRetry = () => {
    setPendingError(null)
    setPendingCount(null)
    setRetryKey((k) => k + 1)
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Role: Branch Manager
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs font-medium text-muted-foreground">{branchLabel}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Branch Operations Hub</h1>
          <p className="text-xs text-muted-foreground">
            Operational oversight, officer management, and portfolio performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="font-semibold">{branchLabel}</span>
          </div>
        </div>
      </div>

      {/* Notice Card */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-foreground">Branch Manager Workspace (M4 Graduated Trust)</p>
          <p className="text-muted-foreground leading-relaxed">
            Authenticated via backend JWT RBAC. Pending Tier 3 approvals below use the live tenant
            approval queue. Officer, loan, and repayment metrics are not connected yet.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Assigned Officers</span>
            <Users className="w-4 h-4" />
          </div>
          <UnavailableMetric />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Loans</span>
            <FileText className="w-4 h-4" />
          </div>
          <UnavailableMetric />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Pending Approvals</span>
            <ShieldAlert className="w-4 h-4" />
          </div>

          {!canDecideTier3 ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-muted-foreground">-</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Tier 3 approvals are not available for your role.
              </div>
            </>
          ) : pendingLoading ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-muted-foreground">…</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Loading Tier 3 queue…</div>
            </>
          ) : pendingError ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-muted-foreground">-</span>
              </div>
              <div className="text-[11px] text-destructive">{pendingError}</div>
              <button
                type="button"
                onClick={handleRetry}
                className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums">{pendingCount}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Tier 3
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {pendingCount === 0
                  ? "No actions awaiting approval"
                  : "Awaiting human approval"}
              </div>
              <Link
                to="/tier-approval"
                className="inline-flex text-[11px] font-medium text-primary underline-offset-2 hover:underline"
              >
                Review
              </Link>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Branch Repayment</span>
            <Building2 className="w-4 h-4" />
          </div>
          <UnavailableMetric />
        </div>
      </div>
    </div>
  )
}
