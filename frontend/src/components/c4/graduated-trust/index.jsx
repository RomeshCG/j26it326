import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Bot,
  Loader2,
  Pencil,
  Shield,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useStore } from "@/store"
import { toBackendRole } from "@/lib/roles"
import {
  fetchAgentPolicies,
  fetchPendingAgentActions,
  fetchOverrideRates,
  updateAgentPolicy,
} from "@/lib/api"

import { GOVERNANCE_TIERS } from "./mock-data"

const DECIDER_ROLES = ["admin", "executive", "branch_manager"]

function tierBadgeClass(tier) {
  switch (tier) {
    case 1:
      return "bg-blue-600 text-white"
    case 2:
      return "bg-green-600 text-white"
    case 3:
      return "bg-amber-500 text-amber-950"
    case 4:
      return "bg-red-600 text-white"
    default:
      return "bg-muted text-foreground"
  }
}

function formatRate(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—"
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`
}

function TierLadderCard({ tierDef }) {
  return (
    <div
      className={`rounded-xl border bg-card p-5 shadow-sm ${tierDef.borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tier {tierDef.tier}
          </p>
          <h3 className="mt-1 text-base font-semibold">{tierDef.label}</h3>
        </div>
        <Badge className={tierDef.badgeClass}>{tierDef.badge}</Badge>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {tierDef.description}
      </p>
    </div>
  )
}

function PolicyEditModal({ policy, onClose, onSaved }) {
  const [tier, setTier] = useState(policy.tier)
  const [description, setDescription] = useState(policy.description || "")
  const [isActive, setIsActive] = useState(Boolean(policy.isActive))
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const tierChanged = Number(tier) !== Number(policy.tier)
  const trimmedReason = reason.trim()
  const reasonValid = trimmedReason.length >= 10 && trimmedReason.length <= 1000
  const descTrimmed = description.trim()
  const descOk = descTrimmed.length <= 500

  const canSubmit =
    descOk &&
    (!tierChanged || reasonValid) &&
    (tierChanged ||
      isActive !== Boolean(policy.isActive) ||
      descTrimmed !== (policy.description || "").trim())

  const handleSave = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)

    const body = {}
    if (tierChanged) {
      body.tier = Number(tier)
      body.reason = trimmedReason
    }
    if (isActive !== Boolean(policy.isActive)) {
      body.isActive = isActive
    }
    if (descTrimmed !== (policy.description || "").trim()) {
      body.description = descTrimmed.length ? descTrimmed : null
    }

    if (Object.keys(body).length === 0) {
      setError("No changes detected")
      setSubmitting(false)
      return
    }

    try {
      const res = await updateAgentPolicy(policy.id, body)
      onSaved(res?.policy || { ...policy, ...body })
      onClose()
    } catch (err) {
      setError(err.message || "Failed to update policy")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Edit policy</h2>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {policy.actionType}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(Number(e.target.value))}
              disabled={submitting}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>
                  Tier {t}
                </option>
              ))}
            </select>
            {tierChanged && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Changing the tier changes how this agent action is governed for
                future dispatches.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-lg border border-border bg-background p-2.5 text-sm text-foreground"
            />
            <p className="text-[10px] text-muted-foreground">
              {descTrimmed.length} / 500
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={submitting}
              className="size-4"
            />
            <span>Policy is active</span>
          </label>

          {tierChanged && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <label className="font-medium text-foreground">
                  Justification reason <span className="text-red-500">*</span>
                </label>
                <span
                  className={`font-mono text-[10px] ${reasonValid ? "text-green-500" : "text-muted-foreground"}`}
                >
                  {trimmedReason.length} / 10 min (max 1000)
                </span>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
                rows={3}
                placeholder="Why is this tier changing? (required)"
                className="w-full resize-none rounded-lg border border-border bg-background p-2.5 text-sm text-foreground"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-500">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 cursor-pointer rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || !canSubmit}
            className="flex-1 cursor-pointer rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GraduatedTrust() {
  const currentUser = useStore((state) => state.currentUser)
  const userRole = currentUser?.backendRole || toBackendRole(currentUser?.role)
  const canDecide = DECIDER_ROLES.includes(userRole)
  const canManage = userRole === "admin"

  const [policies, setPolicies] = useState([])
  const [policiesLoading, setPoliciesLoading] = useState(true)
  const [policiesError, setPoliciesError] = useState(null)

  const [pendingCount, setPendingCount] = useState(null)
  const [pendingError, setPendingError] = useState(null)

  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState(null)

  const [editingPolicy, setEditingPolicy] = useState(null)

  const loadPolicies = useCallback(async () => {
    setPoliciesLoading(true)
    setPoliciesError(null)
    try {
      const res = await fetchAgentPolicies()
      setPolicies(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      setPolicies([])
      setPoliciesError(err.message || "Failed to load policies")
    } finally {
      setPoliciesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPolicies()
  }, [loadPolicies])

  useEffect(() => {
    if (!canDecide) {
      setPendingCount(null)
      setPendingError(null)
      setMetrics(null)
      setMetricsError(null)
      setMetricsLoading(false)
      return
    }

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
        setPendingError(err.message || "Failed to load pending count")
      }
    })()

    ;(async () => {
      setMetricsLoading(true)
      setMetricsError(null)
      try {
        const res = await fetchOverrideRates()
        if (cancelled) return
        setMetrics(res?.data || null)
      } catch (err) {
        if (cancelled) return
        setMetrics(null)
        if (err.status === 403) {
          setMetricsError("Metrics are not available for your role.")
        } else {
          setMetricsError(err.message || "Failed to load override metrics")
        }
      } finally {
        if (!cancelled) setMetricsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canDecide])

  const tier3 = metrics?.tiers?.tier3
  const overallOverride = metrics?.overallOverrideRate

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Component 4 · AI governance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Graduated Trust Architecture
          </h1>
          <p className="text-sm text-muted-foreground">
            Four tiers of autonomy define how AI agents act across your institution
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <Link to="/agent-log">Agent activity log</Link>
          </Button>
          {canDecide && typeof pendingCount === "number" && pendingCount > 0 && (
            <Button asChild size="sm" className="cursor-pointer">
              <Link to="/tier-approval">
                {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {canDecide && pendingError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Pending count unavailable: {pendingError}
        </div>
      )}

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base font-semibold">
                AI action governance
              </CardTitle>
              <CardDescription>
                Higher-risk actions require more human oversight
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
          {GOVERNANCE_TIERS.map((tier) => (
            <TierLadderCard key={tier.tier} tierDef={tier} />
          ))}
        </CardContent>
      </Card>

      {canDecide && (
        <Card className="rounded-xl border bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">
              Governance metrics
            </CardTitle>
            <CardDescription>
              Override and Tier 3 approval rates (default last 30 days)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {metricsLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading metrics…
              </div>
            )}
            {metricsError && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                {metricsError}
              </div>
            )}
            {!metricsLoading && !metricsError && metrics && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Actions in range
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {metrics.totalActions ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Overall override rate
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatRate(overallOverride)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Tier 3 approval rate
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatRate(tier3?.approvalRate)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {tier3?.approved ?? 0} approved / {tier3?.decided ?? 0} decided
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Tier 3 reject rate
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatRate(tier3?.overrideRate)}
                  </p>
                  {metrics.capped && (
                    <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                      Metrics capped (large sample)
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">
            Action type policies
          </CardTitle>
          <CardDescription>
            Live tier assignments from the tenant policy table
            {canManage ? ". Admins can edit tier, description, and active state." : "."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          {policiesLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading policies…
            </div>
          )}
          {policiesError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {policiesError}
            </div>
          )}
          {!policiesLoading && !policiesError && policies.length === 0 && (
            <p className="text-sm text-muted-foreground">No policies configured.</p>
          )}
          {!policiesLoading && !policiesError && policies.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Action type
                    </th>
                    <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Agent
                    </th>
                    <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Tier
                    </th>
                    <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Active
                    </th>
                    <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Description
                    </th>
                    {canManage && (
                      <th className="py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Edit
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {policies.map((policy) => (
                    <tr
                      key={policy.id}
                      className="border-b border-border/40 hover:bg-muted/20"
                    >
                      <td className="py-3 pr-3 font-mono text-xs text-foreground">
                        {policy.actionType}
                      </td>
                      <td className="py-3 pr-3 text-xs text-foreground">
                        {policy.agentId || "—"}
                        {policy.agentName ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {policy.agentName}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge className={tierBadgeClass(policy.tier)}>
                          Tier {policy.tier}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        {policy.isActive ? (
                          <span className="text-green-600 dark:text-green-400">Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </td>
                      <td className="max-w-xs py-3 pr-3 text-xs text-muted-foreground">
                        {policy.description || "—"}
                      </td>
                      {canManage && (
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => setEditingPolicy(policy)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                          >
                            <Pencil className="size-3" />
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                Demonstrate graduated trust in action
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open the Tier 3 approval queue to review prepared agent actions
                with full audit logging.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0 cursor-pointer">
            <Link to="/tier-approval">
              Open Tier Approvals
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {editingPolicy && (
        <PolicyEditModal
          policy={editingPolicy}
          onClose={() => setEditingPolicy(null)}
          onSaved={(updated) => {
            setPolicies((prev) =>
              prev.map((p) =>
                p.id === editingPolicy.id
                  ? {
                      ...p,
                      ...updated,
                      tier: updated.tier ?? p.tier,
                      isActive:
                        updated.isActive !== undefined ? updated.isActive : p.isActive,
                      description:
                        updated.description !== undefined
                          ? updated.description
                          : p.description,
                    }
                  : p
              )
            )
            setEditingPolicy(null)
          }}
        />
      )}
    </div>
  )
}
