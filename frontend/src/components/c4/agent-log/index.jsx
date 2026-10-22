import React, { useState, useEffect, useCallback, useRef } from "react"
import { Link } from "react-router-dom"
import { 
  CheckCircle, 
  AlertTriangle, Clock, ChevronLeft, ChevronRight,
  ShieldAlert, Activity, Shield, RotateCcw, X, AlertCircle
} from "lucide-react"

import { 
  fetchAgentActions, 
  fetchAgentActionById, 
  overrideAgentAction, 
  fetchAgentPolicies 
} from "@/lib/api"
import { useStore } from "@/store"
import { toBackendRole } from "@/lib/roles"

const getTierStyle = (tier) => {
  switch (tier) {
    case 1: return "bg-blue-600 text-white border-blue-500"
    case 2: return "bg-green-600 text-white border-green-500"
    case 3: return "bg-amber-500 text-amber-950 border-amber-600"
    case 4: return "bg-red-600 text-white border-red-500"
    default: return "bg-muted-foreground text-foreground border-border"
  }
}

const getTierLabel = (tier) => {
  switch (tier) {
    case 1: return "Auto-execute"
    case 2: return "Execute + notify"
    case 3: return "Human approval"
    case 4: return "Alert only"
    default: return "Unknown"
  }
}

const getAgentBorder = (agentId) => {
  switch (agentId) {
    case "A1": return "border-l-purple-500"
    case "A2": return "border-l-blue-500"
    case "A3": return "border-l-red-500"
    case "A4": return "border-l-teal-500"
    default: return "border-l-slate-500"
  }
}

const getAgentColor = (agentId) => {
  switch (agentId) {
    case "A1": return "bg-purple-500"
    case "A2": return "bg-blue-500"
    case "A3": return "bg-red-500"
    case "A4": return "bg-teal-500"
    default: return "bg-slate-500"
  }
}

const getRelativeTime = (timestamp) => {
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

export default function AgentLog() {
  const currentUser = useStore((state) => state.currentUser)
  const userRole = currentUser?.backendRole || toBackendRole(currentUser?.role)
  const canOverride = ["admin", "executive", "branch_manager"].includes(userRole)
  const reqIdRef = useRef(0)

  // Server-side query state
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const limit = 25

  // Filter state
  const [tierFilter, setTierFilter] = useState("")
  const [agentFilter, setAgentFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  // Policies cache for "Why this tier" lookup
  const [policies, setPolicies] = useState([])
  const [policyWarning, setPolicyWarning] = useState(null)

  // Expanded row details and payloads
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [actionPayloads, setActionPayloads] = useState({}) // { [id]: { loading, data, error } }

  // Human Override modal state
  const [overrideTarget, setOverrideTarget] = useState(null)
  const [overrideReason, setOverrideReason] = useState("")
  const [overrideSubmitting, setOverrideSubmitting] = useState(false)
  const [overrideError, setOverrideError] = useState(null)

  // 1. Fetch policies once on mount for "Why This Tier" panel
  useEffect(() => {
    let isMounted = true
    fetchAgentPolicies()
      .then((res) => {
        if (!isMounted) return
        setPolicies(res.data || [])
      })
      .catch(() => {
        if (!isMounted) return
        setPolicyWarning("Policy definitions could not be loaded. Linked policy verification may be limited.")
      })
    return () => {
      isMounted = false
    }
  }, [])

  // 2. Fetch actions on page or filter change
  const loadActions = useCallback(async () => {
    const currentReqId = ++reqIdRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetchAgentActions({
        page,
        limit,
        tier: tierFilter,
        agentId: agentFilter,
        status: statusFilter,
      })
      if (currentReqId !== reqIdRef.current) return
      setActions(res.data || [])
    } catch (err) {
      if (currentReqId !== reqIdRef.current) return
      setError(err.message || "Failed to load agent activity log")
    } finally {
      if (currentReqId === reqIdRef.current) {
        setLoading(false)
      }
    }
  }, [page, limit, tierFilter, agentFilter, statusFilter])

  useEffect(() => {
    loadActions()
  }, [loadActions])

  // Filter change handlers (resets page to 1)
  const handleTierChange = (e) => {
    setTierFilter(e.target.value)
    setPage(1)
  }

  const handleAgentChange = (e) => {
    setAgentFilter(e.target.value)
    setPage(1)
  }

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value)
    setPage(1)
  }

  const resetFilters = () => {
    setTierFilter("")
    setAgentFilter("")
    setStatusFilter("")
    setPage(1)
  }

  // Row expand / payload load handler
  const toggleRow = (id) => {
    const willExpand = !expandedRows.has(id)
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (willExpand) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
    if (willExpand && !actionPayloads[id]) {
      fetchPayload(id)
    }
  }

  const fetchPayload = async (id) => {
    setActionPayloads((prev) => ({
      ...prev,
      [id]: { loading: true, data: null, error: null },
    }))
    try {
      const res = await fetchAgentActionById(id)
      setActionPayloads((prev) => ({
        ...prev,
        [id]: { loading: false, data: res.data || res, error: null },
      }))
    } catch (err) {
      setActionPayloads((prev) => ({
        ...prev,
        [id]: { loading: false, data: null, error: err.message || "Failed to load action payloads" },
      }))
    }
  }

  // Human Override handler
  const openOverrideModal = (action) => {
    setOverrideTarget(action)
    setOverrideReason("")
    setOverrideError(null)
  }

  const closeOverrideModal = () => {
    setOverrideTarget(null)
    setOverrideReason("")
    setOverrideError(null)
  }

  const trimmedReason = overrideReason.trim()
  const isReasonValid = trimmedReason.length >= 10 && trimmedReason.length <= 1000

  const handleConfirmOverride = async () => {
    if (!isReasonValid || !overrideTarget) return
    setOverrideSubmitting(true)
    setOverrideError(null)
    try {
      await overrideAgentAction(overrideTarget.id, trimmedReason)
      setActionPayloads((prev) => {
        const next = { ...prev }
        delete next[overrideTarget.id]
        return next
      })
      closeOverrideModal()
      loadActions()
    } catch (err) {
      setOverrideError(err.message || "Failed to record human override")
    } finally {
      setOverrideSubmitting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground p-6 lg:p-8 font-sans">

      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
            Agent Activity Log
          </h1>
          <p className="text-muted-foreground text-sm">
            Audited execution log across all autonomous agent tiers and governance policies.
          </p>
        </div>
        </div>
        
      {/* Policy Warning Banner if policy list failed */}
      {policyWarning && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{policyWarning}</span>
            </div>
          )}

      {/* Main Filter Toolbar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Tier Filter */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Tier Level
            </label>
            <select
              value={tierFilter}
              onChange={handleTierChange}
              className="bg-background border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">All Tiers</option>
              <option value="1">Tier 1 (Auto)</option>
              <option value="2">Tier 2 (Notified)</option>
              <option value="3">Tier 3 (Pending Approval)</option>
              <option value="4">Tier 4 (Alert Only)</option>
            </select>
          </div>

          {/* Agent Filter */}
          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Agent
            </label>
            <select
              value={agentFilter}
              onChange={handleAgentChange}
              className="bg-background border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">All Agents</option>
              <option value="A1">A1 · Compliance</option>
              <option value="A2">A2 · Workflow</option>
              <option value="A3">A3 · Anomaly</option>
              <option value="A4">A4 · NLQ</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={handleStatusChange}
              className="bg-background border border-border text-foreground text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="running">running</option>
              <option value="pending_approval">pending_approval</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="executed">executed</option>
              <option value="notified">notified</option>
              <option value="alert_only">alert_only</option>
              <option value="failed">failed</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(tierFilter || agentFilter || statusFilter) && (
            <div className="flex flex-col justify-end self-end">
            <button 
                type="button"
              onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
                <RotateCcw className="size-3" />
                Reset filters
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-6">
        
        {/* Loading Indicator */}
        {loading && (
          <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading actions from tenant database...
          </div>
        )}

        {/* Error Banner */}
        {!loading && error && (
          <div className="p-6 text-center text-sm">
            <div className="flex flex-col items-center gap-2 text-red-500 mb-4">
              <AlertCircle className="size-6" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadActions}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-xs font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && actions.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Activity className="size-8 mx-auto mb-2 opacity-40" />
            No agent actions found matching the selected filters.
          </div>
        )}

        {/* Action Table */}
        {!loading && !error && actions.length > 0 && (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted border-b border-border text-muted-foreground font-medium">
                  <th className="p-3 pl-4">Timestamp / ID</th>
                  <th className="p-3">Agent</th>
                  <th className="p-3 min-w-[280px]">Action</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Override</th>
                  <th className="p-3 text-right pr-4">Details</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-border">
                {actions.map((act) => {
                  const isAwaiting = act.status === "pending_approval"
                  const isExpanded = expandedRows.has(act.id)
                  const payloadState = actionPayloads[act.id]
                  
                  return (
                    <React.Fragment key={act.id}>
                      <tr className={`
                        transition-colors
                        ${isAwaiting ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-muted/40"}
                        border-l-4 ${getAgentBorder(act.agentId)}
                      `}>
                        {/* Timestamp & ID */}
                        <td className="p-3 pl-4 whitespace-nowrap">
                          <div 
                            className="font-medium text-foreground cursor-help"
                            title={act.createdAt}
                          >
                            {getRelativeTime(act.createdAt)}
                          </div>
                          <div 
                            className="font-mono text-[10px] text-muted-foreground mt-0.5 cursor-help"
                            title={act.id}
                          >
                            {act.id.slice(0, 8)}
                          </div>
                        </td>

                        {/* Agent */}
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`size-5 rounded-full ${getAgentColor(act.agentId)} flex items-center justify-center text-[9px] font-bold text-white shadow-sm`}>
                              {act.agentId || "—"}
                            </span>
                            <span className="font-medium text-foreground/90">
                              {act.agentName}
                            </span>
                          </div>
                        </td>

                        {/* Action Description */}
                        <td className="p-3 text-foreground/90 leading-snug">
                          {act.action}
                        </td>

                        {/* Tier Badge */}
                        <td className="p-3 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getTierStyle(act.tier)}`}>
                            Tier {act.tier} · {getTierLabel(act.tier)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-medium">
                            {act.status === "executed" && <CheckCircle size={13} className="text-green-500" />}
                            {act.status === "notified" && <CheckCircle size={13} className="text-blue-500" />}
                            {act.status === "pending_approval" && <Clock size={13} className="text-amber-500" />}
                            {act.status === "alert_only" && <AlertTriangle size={13} className="text-red-500" />}
                            {act.status === "rejected" && <X size={13} className="text-red-500" />}
                            {act.status === "failed" && <AlertCircle size={13} className="text-red-500" />}
                            <span className="capitalize">{act.status.replace("_", " ")}</span>
                          </div>
                        </td>

                        {/* Override */}
                        <td className="p-3 text-center whitespace-nowrap">
                          {act.isOverride ? (
                            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-semibold text-[10px]">
                              Yes
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">No</span>
                          )}
                        </td>

                        {/* Actions / Expansion */}
                        <td className="p-3 text-right pr-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {isAwaiting && (
                              <Link
                                to={`/tier-approval?action=${act.id}`}
                                className="inline-flex items-center bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold px-2.5 py-1 rounded text-[11px] transition-colors"
                              >
                                Review
                            </Link>
                            )}
                            <button 
                              type="button"
                              onClick={() => toggleRow(act.id)}
                              className="text-primary hover:text-primary/80 font-medium underline-offset-4 hover:underline text-[11px] cursor-pointer"
                            >
                              {isExpanded ? "Hide" : "Details"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Row Detail */}
                      {isExpanded && (
                        <tr className="bg-muted/30 border-l-4 border-l-slate-700">
                          <td colSpan="7" className="p-4 sm:p-6">
                                <div className="space-y-4">
                              
                              {/* Metadata Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-background p-2.5 rounded-lg border border-border">
                                  <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">Confidence</div>
                                  <div className="font-semibold text-foreground mt-0.5">
                                    {act.confidence != null ? `${Number(act.confidence).toFixed(1)}%` : "—"}
                                  </div>
                                  </div>
                                <div className="bg-background p-2.5 rounded-lg border border-border">
                                  <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">Processing Time</div>
                                  <div className="font-mono text-foreground mt-0.5">
                                    {act.processingTimeMs != null ? `${act.processingTimeMs}ms` : "—"}
                                </div>
                                    </div>
                                <div className="bg-background p-2.5 rounded-lg border border-border">
                                  <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">Model / Prompt</div>
                                  <div className="font-mono text-[11px] text-foreground mt-0.5 truncate" title={`Model: ${act.modelVersion || "—"} | Prompt: ${act.promptVersion || "—"}`}>
                                    {act.modelVersion || "—"} / {act.promptVersion || "—"}
                                    </div>
                                  </div>
                                <div className="bg-background p-2.5 rounded-lg border border-border">
                                  <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">Tools Used</div>
                                  <div className="font-mono text-[11px] text-foreground mt-0.5 truncate" title={act.toolsUsed ? JSON.stringify(act.toolsUsed) : "—"}>
                                    {act.toolsUsed ? JSON.stringify(act.toolsUsed) : "—"}
                                  </div>
                                </div>
                              </div>

                              {/* Justification & Decision Details */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                  <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider mb-1">Agent Justification</div>
                                  <div className="bg-background p-3 rounded-lg border border-border leading-relaxed text-foreground text-xs">
                                    {act.reason || "No explicit justification recorded."}
                                    </div>
                                  </div>
                                {(act.approvedBy || act.decidedAt) && (
                                    <div>
                                    <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider mb-1">Decided by (user id)</div>
                                    <div className="bg-background p-3 rounded-lg border border-border leading-relaxed text-foreground text-xs">
                                      <div>{act.approvedBy || "—"}</div>
                                      {act.decidedAt && (
                                        <div className="text-[10px] text-muted-foreground mt-1" title={act.decidedAt}>
                                          Decided: {new Date(act.decidedAt).toLocaleString()}
                                        </div>
                                      )}
                                      </div>
                                    </div>
                                  )}
                                {act.decisionReason && (
                                  <div className={act.approvedBy || act.decidedAt ? "md:col-span-2" : ""}>
                                    <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider mb-1">Human Decision Reason</div>
                                    <div className="bg-background p-3 rounded-lg border border-amber-500/20 text-foreground leading-relaxed text-xs">
                                      {act.decisionReason}
                                </div>
                              </div>
                                )}
                            </div>

                              {/* WHY THIS TIER Panel */}
                              <div className="rounded-lg border border-border bg-card p-3.5 space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <Shield className="size-3.5 text-primary" />
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Why Tier {act.tier}?
                                  </span>
                                </div>
                                {act.policyId === null ? (
                                  <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded leading-relaxed">
                                    No policy was linked to this action; it was handled as Tier 4 (alert only).
                                  </div>
                                ) : (
                                  (() => {
                                    const linkedPolicy = policies.find((p) => p.id === act.policyId)
                                    if (!linkedPolicy) {
                                      return (
                                        <div className="text-xs text-muted-foreground">
                                          Linked Policy ID: <code className="font-mono">{act.policyId}</code> (not found in the policy list).
                                        </div>
                                      )
                                    }
                                    const isChanged = !linkedPolicy.isActive || linkedPolicy.tier !== act.tier
                                    return (
                                      <div className="space-y-1.5 text-xs">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-medium text-foreground">Action Type: <code>{linkedPolicy.actionType}</code></span>
                                          <span className="text-muted-foreground">— {linkedPolicy.description || "No description configured."}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                                          <span>Current Policy Tier: <strong className="text-foreground">Tier {linkedPolicy.tier}</strong></span>
                                          <span>Status: <strong className={linkedPolicy.isActive ? "text-green-500" : "text-red-500"}>{linkedPolicy.isActive ? "Active" : "Inactive"}</strong></span>
                                        </div>
                                        {isChanged && (
                                          <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded">
                                            The policy configuration may have changed since this action ran.
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()
                                )}
                              </div>

                              {/* Payloads Section (Plain Pretty-Printed Text) */}
                              <div className="space-y-2 pt-1">
                                <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                                  Raw Payloads (Loaded via Inspection API)
                                </div>
                                
                                {payloadState?.loading && (
                                  <div className="p-4 bg-background border border-border rounded-lg text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                    <div className="size-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    Loading payloads...
                                  </div>
                                )}

                                {payloadState?.error && (
                                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500 flex items-center justify-between">
                                    <span>{payloadState.error}</span>
                      <button 
                                      type="button"
                                      onClick={() => fetchPayload(act.id)}
                                      className="underline hover:text-red-400"
                      >
                                      Retry
                      </button>
                                  </div>
                                )}

                                {payloadState?.data && (
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    <div>
                                      <div className="text-[10px] text-muted-foreground font-mono mb-1">inputPayload</div>
                                      <pre className="text-xs font-mono bg-background p-3 rounded-lg border border-border overflow-x-auto max-h-48 whitespace-pre-wrap">
                                        {JSON.stringify(payloadState.data.inputPayload ?? {}, null, 2)}
                                      </pre>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-muted-foreground font-mono mb-1">outputPayload</div>
                                      <pre className="text-xs font-mono bg-background p-3 rounded-lg border border-border overflow-x-auto max-h-48 whitespace-pre-wrap">
                                        {JSON.stringify(payloadState.data.outputPayload ?? {}, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Human Override Action Button (Tier 1/2, executed/notified, isOverride false) */}
                              {(act.tier === 1 || act.tier === 2) &&
                               (act.status === "executed" || act.status === "notified") &&
                               !act.isOverride &&
                               canOverride && (
                                <div className="pt-2 border-t border-border flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => openOverrideModal(act)}
                                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                                  >
                                    <ShieldAlert className="size-3.5" />
                                    Human Override
                                  </button>
                                </div>
                              )}

                    </div>
                  </td>
                </tr>
              )}

                    </React.Fragment>
                  )
                })}
            </tbody>
          </table>
        </div>
        )}

        {/* Server Pagination Bar (Previous / Next with Page N, no total count) */}
        {!loading && !error && (
          <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">
              Page {page}
            </span>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
                  <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={actions.length < limit || loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                Next
                <ChevronRight className="size-3.5" />
                  </button>
            </div>
          </div>
        )}

      </div>

      {/* Human Override Modal */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-amber-500" />
                <h3 className="font-semibold text-base text-foreground">
                  Record Human Override
                </h3>
              </div>
              <button 
                type="button"
                onClick={closeOverrideModal}
                disabled={overrideSubmitting}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <div>Action: <strong className="text-foreground">{overrideTarget.action}</strong></div>
              <div>Action ID: <code className="font-mono text-[11px] text-foreground">{overrideTarget.id}</code></div>
              <div>Tier: <strong className="text-foreground">Tier {overrideTarget.tier}</strong> · Status: <strong className="text-foreground">{overrideTarget.status}</strong></div>
            </div>

            {/* Override Error Banner */}
            {overrideError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500">
                {overrideError}
          </div>
        )}

            {/* Justification Reason Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <label className="font-medium text-foreground">
                  Justification Reason <span className="text-red-500">*</span>
                </label>
                <span className={`font-mono text-[10px] ${isReasonValid ? "text-green-500" : "text-muted-foreground"}`}>
                  {trimmedReason.length} / 10 min (max 1000)
                </span>
              </div>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Enter justification explaining why this autonomous action is being overridden (10-1000 characters)..."
                rows={4}
                disabled={overrideSubmitting}
                className="w-full bg-background border border-border rounded-lg p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-amber-500 resize-none font-sans"
              />
      </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={closeOverrideModal}
                disabled={overrideSubmitting}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOverride}
                disabled={!isReasonValid || overrideSubmitting}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {overrideSubmitting && <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Confirm Override
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
