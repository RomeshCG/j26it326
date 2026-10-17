import { useState, useEffect, useCallback, useRef } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  CheckCircle,
  X,
  ChevronRight,
  Clock,
  CheckSquare,
  Square,
  Shield,
  Loader2,
  AlertCircle,
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

import {
  fetchPendingAgentActions,
  fetchAgentActionById,
  approveAgentAction,
  rejectAgentAction,
} from "@/lib/api"

/** Allowlisted outputPayload keys treated as model evidence (Phase 10-ready). */
const ML_EVIDENCE_KEYS = [
  "anomaly_score",
  "is_anomaly",
  "top_factors",
  "severity",
  "severity_proba",
  "model_version",
]

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value.trim())
}

function getAgentBorder(agentId) {
  switch (agentId) {
    case "A1":
      return "border-l-purple-500"
    case "A2":
      return "border-l-blue-500"
    case "A3":
      return "border-l-red-500"
    case "A4":
      return "border-l-teal-500"
    default:
      return "border-l-muted-foreground"
  }
}

function getAgentPillClass(agentId) {
  switch (agentId) {
    case "A1":
      return "text-purple-400 border-purple-500/30"
    case "A2":
      return "text-blue-400 border-blue-500/30"
    case "A3":
      return "text-red-400 border-red-500/30"
    case "A4":
      return "text-teal-400 border-teal-500/30"
    default:
      return "text-muted-foreground border-border"
  }
}

function getRelativeWaiting(timestamp) {
  if (!timestamp) return "waiting"
  try {
    const diffMs = Date.now() - new Date(timestamp).getTime()
    const diffMin = Math.max(0, Math.round(diffMs / 60000))
    if (diffMin < 60) return `waiting ${diffMin}m`
    const diffHours = Math.round(diffMin / 60)
    if (diffHours < 48) return `waiting ${diffHours}h`
    return `waiting ${Math.round(diffHours / 24)}d`
  } catch {
    return "waiting"
  }
}

function agentLabel(item) {
  if (!item) return "Agent"
  const id = item.agentId || ""
  const name = item.agentName || ""
  if (id && name) return `${id} · ${name}`
  return name || id || "Agent"
}

function extractMlEvidence(outputPayload) {
  if (!outputPayload || typeof outputPayload !== "object" || Array.isArray(outputPayload)) {
    return null
  }
  const picked = {}
  for (const key of ML_EVIDENCE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(outputPayload, key) && outputPayload[key] != null) {
      picked[key] = outputPayload[key]
    }
  }
  return Object.keys(picked).length > 0 ? picked : null
}

/** A1 readiness package detection (cbsl_readiness_v1). */
function getA1ReadinessView(inputPayload) {
  if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
    return null
  }
  if (
    inputPayload.actionType !== "generate_cbsl_report" ||
    inputPayload.reportKind !== "cbsl_readiness_v1"
  ) {
    return null
  }
  const report =
    inputPayload.report && typeof inputPayload.report === "object" && !Array.isArray(inputPayload.report)
      ? inputPayload.report
      : null
  const gaps = Array.isArray(report?.dataGaps) ? report.dataGaps : []
  const blocking = gaps.filter((g) => g?.severity === "blocking")
  const warnings = gaps.filter((g) => g?.severity === "warning")
  const recommendations = Array.isArray(report?.recommendations)
    ? report.recommendations
    : []
  return {
    overallStatus: report?.overallStatus || "unknown",
    period: report?.period || null,
    disclaimer:
      typeof inputPayload.disclaimer === "string"
        ? inputPayload.disclaimer
        : typeof report?.disclaimer === "string"
          ? report.disclaimer
          : "Internal readiness assessment — not an official CBSL submission.",
    preparedByUserId:
      typeof inputPayload.preparedByUserId === "string"
        ? inputPayload.preparedByUserId
        : null,
    proposalHash:
      typeof inputPayload.proposalHash === "string" ? inputPayload.proposalHash : null,
    blockingGaps: blocking,
    warningGaps: warnings,
    recommendations,
  }
}

function overallStatusLabel(status) {
  switch (status) {
    case "not_ready":
      return "Not ready"
    case "ready_with_warnings":
      return "Ready with warnings"
    case "evidence_complete_for_scoped_checks":
      return "Evidence complete (scoped checks only)"
    default:
      return String(status || "Unknown")
  }
}

function notifySidebarPendingRefresh() {
  window.dispatchEvent(new Event("mf:tier3-pending-refresh"))
}

function ApprovalSummaryCard({
  item,
  hasReviewed,
  onToggleReviewed,
  onApprove,
  onReject,
  decisionsEnabled,
}) {
  const confidence =
    item.confidence == null || item.confidence === ""
      ? "—"
      : typeof item.confidence === "number"
        ? `${item.confidence}%`
        : String(item.confidence)

  return (
    <Card className="rounded-xl border border-amber-500/30 bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardDescription className="text-xs uppercase tracking-wide">
          Agent prepared action awaiting human decision
        </CardDescription>
        <CardTitle className="text-lg font-semibold">{item.action || "Untitled action"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</dt>
            <dd className="mt-1 font-medium break-words">{item.action || "—"}</dd>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tier</dt>
            <dd className="mt-1">
              <Badge className="bg-amber-500 text-amber-950">Tier {item.tier ?? 3}</Badge>
            </dd>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Agent justification
            </dt>
            <dd className="mt-1 leading-relaxed">
              {item.reason || "No explicit justification recorded."}
            </dd>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Confidence
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{confidence}</dd>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Prepared by
            </dt>
            <dd className="mt-1 font-medium">{agentLabel(item)}</dd>
          </div>
        </dl>

        <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
          <button
            type="button"
            className="mt-0.5 cursor-pointer text-foreground"
            onClick={onToggleReviewed}
            disabled={!decisionsEnabled}
          >
            {hasReviewed ? (
              <CheckSquare size={20} className="text-primary" />
            ) : (
              <Square size={20} className="text-muted-foreground" />
            )}
          </button>
          <button
            type="button"
            className="cursor-pointer text-left text-sm disabled:opacity-50"
            onClick={onToggleReviewed}
            disabled={!decisionsEnabled}
          >
            <span className="font-medium">I have reviewed this agent action.</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Required before approve or reject.
            </span>
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            className="cursor-pointer"
            disabled={!decisionsEnabled || !hasReviewed}
            onClick={onApprove}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={!decisionsEnabled || !hasReviewed}
            onClick={onReject}
          >
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function TierApproval() {
  const [searchParams] = useSearchParams()
  const actionParam = searchParams.get("action")
  const detailReqIdRef = useRef(0)

  const [queue, setQueue] = useState([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)
  const [deepLinkNotice, setDeepLinkNotice] = useState(null)

  const [hasReviewed, setHasReviewed] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [approveReason, setApproveReason] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [decisionSubmitting, setDecisionSubmitting] = useState(false)
  const [decisionError, setDecisionError] = useState(null)
  const [actionState, setActionState] = useState({ type: null, message: null })

  const selectedListItem = queue.find((item) => item.id === selectedId) || null
  const displayItem = detail && detail.id === selectedId ? detail : selectedListItem

  const detailReady =
    Boolean(selectedId) &&
    !detailLoading &&
    !detailError &&
    detail &&
    detail.id === selectedId

  const isPending = detailReady && detail.status === "pending_approval"
  const decisionsEnabled = isPending && !decisionSubmitting && !actionState.type

  const trimmedApprove = approveReason.trim()
  const trimmedReject = rejectReason.trim()
  const approveReasonValid = trimmedApprove.length >= 10 && trimmedApprove.length <= 1000
  const rejectReasonValid = trimmedReject.length >= 10 && trimmedReject.length <= 1000

  const selectAction = useCallback((id) => {
    setSelectedId(id)
    setHasReviewed(false)
    setActionState({ type: null, message: null })
    setDecisionError(null)
    setShowApproveConfirm(false)
    setShowRejectModal(false)
    setApproveReason("")
    setRejectReason("")
    setDeepLinkNotice(null)
  }, [])

  const loadPending = useCallback(
    async ({ preferredId } = {}) => {
      setQueueLoading(true)
      setQueueError(null)
      try {
        const res = await fetchPendingAgentActions()
        const rows = Array.isArray(res?.data) ? res.data : []
        setQueue(rows)
        notifySidebarPendingRefresh()

        const prefer =
          preferredId && rows.some((r) => r.id === preferredId)
            ? preferredId
            : actionParam && rows.some((r) => r.id === actionParam)
              ? actionParam
              : rows[0]?.id || null

        if (prefer) {
          selectAction(prefer)
        } else if (actionParam && isUuid(actionParam)) {
          // Deep link not in pending list — GET :id resolves status / 404
          setSelectedId(actionParam)
          setHasReviewed(false)
          setActionState({ type: null, message: null })
          setDecisionError(null)
        } else {
          setSelectedId(null)
          setDetail(null)
          setDetailError(null)
          setDetailLoading(false)
          if (actionParam && !isUuid(actionParam)) {
            setDeepLinkNotice("The action link is invalid (expected a UUID).")
          }
        }

        return rows
      } catch (err) {
        setQueue([])
        setQueueError(err.message || "Failed to load pending approvals")
        setSelectedId(null)
        setDetail(null)
        return []
      } finally {
        setQueueLoading(false)
      }
    },
    [actionParam, selectAction]
  )

  useEffect(() => {
    loadPending()
  }, [loadPending])

  // Load full detail when selection changes (stale-response guarded)
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setDetailError(null)
      setDetailLoading(false)
      return
    }

    const reqId = ++detailReqIdRef.current
    setDetailLoading(true)
    setDetailError(null)
    setDeepLinkNotice(null)

    ;(async () => {
      try {
        const res = await fetchAgentActionById(selectedId)
        if (reqId !== detailReqIdRef.current) return
        const row = res?.data || res
        if (!row?.id) {
          setDetail(null)
          setDetailError("Action detail was empty")
          return
        }
        setDetail(row)

        if (row.status !== "pending_approval") {
          setDeepLinkNotice(
            `This action is no longer pending (status: ${row.status}). Open Agent Activity Log for history.`
          )
        }
      } catch (err) {
        if (reqId !== detailReqIdRef.current) return
        setDetail(null)
        if (err.status === 404) {
          setDetailError("Agent action not found")
          setDeepLinkNotice("No action matches this link.")
        } else {
          setDetailError(err.message || "Failed to load action detail")
        }
      } finally {
        if (reqId === detailReqIdRef.current) {
          setDetailLoading(false)
        }
      }
    })()
  }, [selectedId])

  const closeDecisionModals = () => {
    setShowApproveConfirm(false)
    setShowRejectModal(false)
    setApproveReason("")
    setRejectReason("")
    setDecisionError(null)
  }

  const afterDecisionSuccess = async (message, type) => {
    setActionState({ type, message })
    closeDecisionModals()
    setTimeout(async () => {
      setActionState({ type: null, message: null })
      await loadPending({ preferredId: null })
    }, 1800)
  }

  const handleConfirmApprove = async () => {
    if (!decisionsEnabled || !approveReasonValid || !selectedId) return
    setDecisionSubmitting(true)
    setDecisionError(null)
    try {
      const result = await approveAgentAction(selectedId, trimmedApprove)
      const status = result?.actionStatus || "approved"
      if (status === "failed") {
        await afterDecisionSuccess(
          `Approved, but handler execution failed${result?.error ? `: ${result.error}` : "."} Status: failed.`,
          "failed"
        )
      } else {
        await afterDecisionSuccess(
          `Action approved. Final status: ${status}.`,
          "success"
        )
      }
    } catch (err) {
      if (err.status === 409) {
        setDecisionError(err.message || "Conflict: action is no longer pending.")
        setShowApproveConfirm(false)
        await loadPending()
      } else {
        setDecisionError(err.message || "Failed to approve action")
      }
    } finally {
      setDecisionSubmitting(false)
    }
  }

  const handleConfirmReject = async () => {
    if (!decisionsEnabled || !rejectReasonValid || !selectedId) return
    setDecisionSubmitting(true)
    setDecisionError(null)
    try {
      await rejectAgentAction(selectedId, trimmedReject)
      await afterDecisionSuccess(
        "Action rejected. Decision reason recorded in the audit trail.",
        "rejected"
      )
    } catch (err) {
      if (err.status === 409) {
        setDecisionError(err.message || "Conflict: action is no longer pending.")
        setShowRejectModal(false)
        await loadPending()
      } else {
        setDecisionError(err.message || "Failed to reject action")
      }
    } finally {
      setDecisionSubmitting(false)
    }
  }

  const mlEvidence = detailReady ? extractMlEvidence(detail.outputPayload) : null
  const hasRowModelMeta =
    detailReady &&
    (detail.modelVersion ||
      detail.promptVersion ||
      detail.toolsUsed != null ||
      (detail.confidence != null && detail.confidence !== ""))

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Link to="/graduated-trust" className="transition-colors hover:text-foreground">
              Graduated Trust
            </Link>
            <ChevronRight size={12} />
            <Link to="/agent-log" className="transition-colors hover:text-foreground">
              Agent Activity Log
            </Link>
            <ChevronRight size={12} />
            <span className="text-amber-600 dark:text-amber-400">Tier Approval</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Tier 3: Human approval required
            </h1>
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
              {queueLoading ? "…" : `${queue.length} pending`}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            An AI agent has prepared the following action. Review the evidence, then approve or
            reject with a recorded reason.
          </p>
          {queueError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {queueError}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-border bg-background custom-scrollbar">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background p-4">
            <div className="text-sm font-semibold text-foreground">Pending Approvals</div>
            <div className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80">
              {queueLoading ? "…" : queue.length}
            </div>
          </div>

          <div className="flex flex-col space-y-1 p-2">
            {queueLoading && (
              <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading queue…
              </div>
            )}

            {!queueLoading &&
              queue.map((item) => {
                const isSelected = item.id === selectedId
                const borderLeftClass = getAgentBorder(item.agentId)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectAction(item.id)}
                    className={`w-full cursor-pointer rounded-xl border-b border-l-4 border-r border-t p-4 text-left transition-colors ${borderLeftClass} ${
                      isSelected
                        ? "border-border bg-card"
                        : "border-transparent bg-transparent hover:bg-muted/30"
                    }`}
                  >
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {agentLabel(item)}
                    </div>
                    <div className="mb-2 text-sm font-medium leading-snug text-foreground">
                      {item.action || "Untitled action"}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock size={12} /> {getRelativeWaiting(item.createdAt)}
                    </div>
                  </button>
                )
              })}

            {!queueLoading && queue.length === 0 && !queueError && (
              <div className="flex flex-col items-center p-6 text-center text-muted-foreground">
                <CheckCircle size={32} className="mb-3 opacity-20" />
                <div className="text-sm font-medium">Queue Empty</div>
              </div>
            )}
          </div>
        </aside>

        <div className="relative flex-1 overflow-y-auto bg-background p-6 custom-scrollbar lg:p-10">
          {actionState.type ? (
            <div className="flex h-full flex-col items-center justify-center animate-in zoom-in-95 duration-300">
              {actionState.type === "success" ? (
                <>
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
                    <CheckCircle size={40} className="text-green-500" />
                  </div>
                  <h2 className="mb-2 max-w-lg text-center text-2xl font-bold text-foreground">
                    {actionState.message}
                  </h2>
                  <p className="text-center text-sm text-muted-foreground">Refreshing queue…</p>
                </>
              ) : actionState.type === "failed" ? (
                <>
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
                    <AlertCircle size={40} className="text-amber-500" />
                  </div>
                  <h2 className="mb-2 max-w-lg text-center text-2xl font-bold text-foreground">
                    {actionState.message}
                  </h2>
                  <p className="text-center text-sm text-muted-foreground">Refreshing queue…</p>
                </>
              ) : (
                <>
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-red-500/20 bg-muted">
                    <X size={40} className="text-red-500" />
                  </div>
                  <h2 className="mb-2 max-w-lg text-center text-2xl font-bold text-foreground">
                    {actionState.message}
                  </h2>
                  <p className="text-center text-sm text-muted-foreground">Refreshing queue…</p>
                </>
              )}
            </div>
          ) : !selectedId && !queueLoading ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <CheckCircle size={64} className="mb-6 text-green-500/50" />
              <h2 className="mb-2 text-2xl font-bold text-foreground">No pending approvals</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                All Tier 3 actions have been reviewed.
              </p>
              <Link
                to="/agent-log"
                className="cursor-pointer text-sm font-medium text-blue-500 transition-colors hover:underline"
              >
                Return to Agent Activity Log
              </Link>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-8 pb-20 animate-in fade-in duration-300">
              {deepLinkNotice && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  {deepLinkNotice}{" "}
                  <Link to="/agent-log" className="font-medium underline underline-offset-2">
                    Open Agent Log
                  </Link>
                </div>
              )}

              {decisionError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                  {decisionError}
                </div>
              )}

              {detailLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading full evidence…
                </div>
              )}

              {detailError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                  {detailError}
                </div>
              )}

              {displayItem && (
                <ApprovalSummaryCard
                  item={displayItem}
                  hasReviewed={hasReviewed}
                  onToggleReviewed={() => setHasReviewed((v) => !v)}
                  onApprove={() => {
                    setDecisionError(null)
                    setShowApproveConfirm(true)
                  }}
                  onReject={() => {
                    setDecisionError(null)
                    setShowRejectModal(true)
                  }}
                  decisionsEnabled={decisionsEnabled}
                />
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield size={16} />
                Full review context
              </div>

              {detailReady && (
                <>
                  <div className="rounded-xl border border-border border-l-[3px] border-l-amber-500 bg-card p-8 shadow-sm">
                    <div className="mb-6 flex flex-wrap items-center gap-4">
                      <div
                        className={`rounded-full border bg-muted/40 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${getAgentPillClass(detail.agentId)}`}
                      >
                        {agentLabel(detail)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created{" "}
                        {detail.createdAt
                          ? new Date(detail.createdAt).toLocaleString()
                          : "—"}
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {String(detail.status || "").replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <h2 className="mb-4 text-2xl font-bold text-foreground">
                      {detail.action || "Untitled action"}
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {detail.reason || "No agent justification recorded."}
                    </p>
                    <div className="mt-4 font-mono text-[11px] text-muted-foreground">
                      ID: {detail.id}
                      {detail.policyId ? ` · Policy: ${detail.policyId}` : " · Policy: —"}
                    </div>
                  </div>

                  {(() => {
                    const a1 = getA1ReadinessView(detail.inputPayload)
                    if (!a1) return null
                    return (
                      <div className="space-y-4 rounded-xl border border-purple-500/30 bg-purple-500/5 p-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-purple-600 text-white">A1 readiness</Badge>
                          <Badge variant="outline" className="capitalize">
                            {overallStatusLabel(a1.overallStatus)}
                          </Badge>
                        </div>
                        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                          {a1.disclaimer}
                        </p>
                        <dl className="grid gap-3 text-sm sm:grid-cols-2">
                          <div className="rounded-lg border bg-card/80 p-3">
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              Reporting period
                            </dt>
                            <dd className="mt-1 font-mono text-xs">
                              {a1.period?.startIso
                                ? `${new Date(a1.period.startIso).toLocaleString()} → ${new Date(a1.period.endIso).toLocaleString()}`
                                : "—"}
                            </dd>
                          </div>
                          <div className="rounded-lg border bg-card/80 p-3">
                            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              Human preparer
                            </dt>
                            <dd className="mt-1 font-mono text-xs break-all">
                              {a1.preparedByUserId ||
                                "Not recorded (legacy package — approval should be denied server-side)"}
                            </dd>
                          </div>
                        </dl>
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-foreground">
                            Blocking gaps ({a1.blockingGaps.length})
                          </h4>
                          {a1.blockingGaps.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No blocking gaps.</p>
                          ) : (
                            <ul className="space-y-2 text-sm">
                              {a1.blockingGaps.map((g) => (
                                <li
                                  key={g.code || g.message}
                                  className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2"
                                >
                                  <div className="font-medium text-foreground">
                                    {g.code || "GAP"}
                                  </div>
                                  <div className="text-muted-foreground">{g.message}</div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {a1.warningGaps.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-sm font-semibold text-foreground">
                              Warnings ({a1.warningGaps.length})
                            </h4>
                            <ul className="space-y-2 text-sm">
                              {a1.warningGaps.map((g) => (
                                <li
                                  key={g.code || g.message}
                                  className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2"
                                >
                                  <div className="font-medium">{g.code || "WARN"}</div>
                                  <div className="text-muted-foreground">{g.message}</div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {a1.recommendations.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-sm font-semibold text-foreground">
                              Recommended next actions
                            </h4>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                              {a1.recommendations.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {a1.proposalHash && (
                          <p className="font-mono text-[10px] text-muted-foreground break-all">
                            proposalHash: {a1.proposalHash}
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  <div>
                    <h3 className="mb-4 text-lg font-bold text-foreground">Prepared inputs</h3>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {getA1ReadinessView(detail.inputPayload)
                        ? "Full raw readiness package (expandable evidence)."
                        : "Raw input payload from the agent (not model evidence)."}
                    </p>
                    <details
                      className="rounded-xl border border-border bg-muted/20"
                      open={!getA1ReadinessView(detail.inputPayload)}
                    >
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                        {getA1ReadinessView(detail.inputPayload)
                          ? "Show full report JSON"
                          : "Input payload"}
                      </summary>
                      <pre className="max-h-80 overflow-auto border-t border-border p-4 font-mono text-[11px] text-foreground">
                        {JSON.stringify(detail.inputPayload ?? {}, null, 2)}
                      </pre>
                    </details>
                  </div>

                  <div>
                    <h3 className="mb-4 text-lg font-bold text-foreground">Model evidence</h3>
                    {!hasRowModelMeta && !mlEvidence ? (
                      <p className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
                        No model evidence on this action yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {(hasRowModelMeta) && (
                          <dl className="grid gap-3 text-sm sm:grid-cols-2">
                            <div className="rounded-lg border bg-muted/30 p-3">
                              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Model / prompt
                              </dt>
                              <dd className="mt-1 font-mono text-xs">
                                {detail.modelVersion || "—"} / {detail.promptVersion || "—"}
                              </dd>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-3">
                              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                Tools used
                              </dt>
                              <dd className="mt-1 font-mono text-xs">
                                {detail.toolsUsed
                                  ? JSON.stringify(detail.toolsUsed)
                                  : "—"}
                              </dd>
                            </div>
                          </dl>
                        )}
                        {mlEvidence && (
                          <pre className="max-h-64 overflow-auto rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 font-mono text-[11px] text-foreground">
                            {JSON.stringify(mlEvidence, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-8">
                    <div className="mb-8 flex items-start gap-3">
                      <button
                        type="button"
                        className="mt-0.5 cursor-pointer text-foreground disabled:opacity-50"
                        disabled={!decisionsEnabled}
                        onClick={() => setHasReviewed((v) => !v)}
                      >
                        {hasReviewed ? (
                          <CheckSquare size={20} className="text-blue-500" />
                        ) : (
                          <Square size={20} className="text-muted-foreground" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="cursor-pointer text-left disabled:opacity-50"
                        disabled={!decisionsEnabled}
                        onClick={() => setHasReviewed((v) => !v)}
                      >
                        <div className="mb-1 text-sm font-medium text-foreground">
                          I confirm I have reviewed the agent&apos;s prepared action and the
                          supporting data above.
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Required before approve or reject.
                        </div>
                      </button>
                    </div>

                    <div className="mb-4 flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionError(null)
                          setShowApproveConfirm(true)
                        }}
                        disabled={!decisionsEnabled || !hasReviewed}
                        className="w-full cursor-pointer rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-600/10 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                      >
                        Approve action
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionError(null)
                          setShowRejectModal(true)
                        }}
                        disabled={!decisionsEnabled || !hasReviewed}
                        className="w-full cursor-pointer rounded-xl border border-red-500/50 bg-transparent px-6 py-4 text-base font-bold text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject this action
                      </button>
                    </div>

                    <div className="text-center text-xs text-muted-foreground">
                      All approval and rejection actions are permanently logged in the audit trail.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showApproveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95">
            <div className="space-y-4 p-6">
              <h2 className="text-xl font-bold text-foreground">Confirm Approval</h2>
              <p className="text-sm text-muted-foreground">
                Provide a decision reason (10–1000 characters). Approval executes the prepared
                handler and cannot be undone from this screen.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <label className="font-medium text-foreground">
                    Approval reason <span className="text-red-500">*</span>
                  </label>
                  <span
                    className={`font-mono text-[10px] ${approveReasonValid ? "text-green-500" : "text-muted-foreground"}`}
                  >
                    {trimmedApprove.length} / 10 min (max 1000)
                  </span>
                </div>
                <textarea
                  value={approveReason}
                  onChange={(e) => setApproveReason(e.target.value)}
                  disabled={decisionSubmitting}
                  rows={4}
                  placeholder="Why are you approving this action?"
                  className="w-full resize-none rounded-lg border border-border bg-muted p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
                />
              </div>
              {decisionError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-500">
                  {decisionError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeDecisionModals}
                  disabled={decisionSubmitting}
                  className="flex-1 cursor-pointer rounded-lg border border-border bg-transparent py-2.5 font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApprove}
                  disabled={decisionSubmitting || !approveReasonValid}
                  className="flex-1 cursor-pointer rounded-lg bg-blue-600 py-2.5 font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {decisionSubmitting ? "Submitting…" : "Confirm Approval"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95">
            <div className="space-y-4 p-6">
              <h2 className="text-xl font-bold text-foreground">Reject Action</h2>
              <p className="text-sm text-muted-foreground">
                Provide a reason for rejecting this action. This is stored as the human decision
                reason and logged in the audit trail.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <label className="font-medium text-foreground">
                    Rejection reason <span className="text-red-500">*</span>
                  </label>
                  <span
                    className={`font-mono text-[10px] ${rejectReasonValid ? "text-green-500" : "text-muted-foreground"}`}
                  >
                    {trimmedReject.length} / 10 min (max 1000)
                  </span>
                </div>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  disabled={decisionSubmitting}
                  rows={4}
                  placeholder="Reason for rejection (required)..."
                  className="w-full resize-none rounded-lg border border-border bg-muted p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-red-500 focus:outline-none"
                />
              </div>
              {decisionError && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-500">
                  {decisionError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeDecisionModals}
                  disabled={decisionSubmitting}
                  className="flex-1 cursor-pointer rounded-lg border border-border bg-transparent py-2.5 font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={decisionSubmitting || !rejectReasonValid}
                  className="flex-1 cursor-pointer rounded-lg bg-red-600 py-2.5 font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {decisionSubmitting ? "Submitting…" : "Submit Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
