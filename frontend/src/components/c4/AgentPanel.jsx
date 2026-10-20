import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useLocation } from "react-router-dom"
import { useStore } from "@/store"
import {
  getCachedSession,
  verifySessionOnce,
  queryNlq,
} from "@/lib/api"
import {
  X, MessageSquarePlus, Sparkles, Send,
  Copy, Check, MessageCircle
} from "lucide-react"

const SUGGESTIONS_BASE = [
  "How many A3 actions were recorded in the last 7 days?",
  "How many agent actions were recorded in the last 7 days?",
  "What is PAR30 in microfinance?",
  "What do Agents A1–A4 do in MicroFlow?",
]

const SUGGESTION_PENDING =
  "How many Tier 3 actions are awaiting approval?"

function sessionHasDecideTier3(session) {
  if (!session) return false
  const caps = session.capabilities
  if (Array.isArray(caps)) {
    if (caps.includes("*") || caps.includes("agents:decide_tier3")) return true
  }
  const role = session.role
  return role === "admin" || role === "executive" || role === "branch_manager"
}

function formatNlqError(err) {
  const status = err?.status
  if (err?.isNetworkError) {
    return "Cannot reach the MicroFlow API. Check that the backend is running and try again."
  }
  if (status === 401) {
    return "Your session expired. Please sign in again."
  }
  if (status === 403) {
    return (
      err?.message ||
      "You are not authorized for that Agent 4 query (server RBAC)."
    )
  }
  if (status === 422) {
    return (
      err?.message ||
      "The language model returned an invalid response. Please rephrase and try again."
    )
  }
  if (status === 503) {
    return "Agent 4’s language model is unavailable right now. Try again in a moment."
  }
  if (status === 400) {
    return err?.message || "Invalid question. Please try a clearer question."
  }
  return err?.message || "Something went wrong while contacting Agent 4."
}

export default function AgentPanel() {
  const location = useLocation()

  const agentPanelOpen = useStore((state) => state.agentPanelOpen)
  const toggleAgentPanel = useStore((state) => state.toggleAgentPanel)
  const nlqChatHistoryRaw = useStore((state) => state.nlqChatHistory)
  const nlqChatHistory = useMemo(
    () => (Array.isArray(nlqChatHistoryRaw) ? nlqChatHistoryRaw : []),
    [nlqChatHistoryRaw]
  )
  const addNlqMessage = useStore((state) => state.addNlqMessage)
  const archiveNlqChat = useStore((state) => state.archiveNlqChat)
  const markAgentResponsesRead = useStore((state) => state.markAgentResponsesRead)
  const unreadAgentResponses = useStore((state) => state.unreadAgentResponses)
  /** Drives re-auth when logout / login / user switch updates the store. */
  const currentUser = useStore((state) => state.currentUser)
  const currentUserId = currentUser?.id ?? currentUser?.userId ?? null

  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showConfirmNew, setShowConfirmNew] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [session, setSession] = useState(() => getCachedSession())
  const [sessionReady, setSessionReady] = useState(() => !!getCachedSession())
  /** Footer status only: ready | thinking | unavailable (set on 503; not a health probe). */
  const [serviceUnavailable, setServiceUnavailable] = useState(false)

  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  const requestInFlightRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestInFlightRef.current = false
    }
  }, [])

  // Prefer verified /auth/me session (capabilities + role) over token-only checks.
  // Parent remounts this panel on user id change; effect only loads when a token+user exist.
  useEffect(() => {
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("mf_auth_token")
        : null
    if (!token || !currentUser) {
      return undefined
    }

    let cancelled = false
    verifySessionOnce()
      .then((user) => {
        if (cancelled || !mountedRef.current) return
        setSession(user)
        setSessionReady(true)
      })
      .catch(() => {
        if (cancelled || !mountedRef.current) return
        setSession(null)
        setSessionReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [currentUser, currentUserId])

  const hasAuthToken =
    typeof localStorage !== "undefined" &&
    Boolean(localStorage.getItem("mf_auth_token"))
  // currentUser from store flips on logout without waiting for local session state.
  const authenticated =
    Boolean(currentUser) && hasAuthToken && sessionReady && Boolean(session)

  const getPageName = (path) => {
    if (path.includes("/dashboard")) return "Dashboard"
    if (path.includes("/hr")) return "HR Management"
    if (path.includes("/payroll")) return "Payroll"
    if (path.includes("/agent-log")) return "Agent Activity Log"
    if (path.includes("/tier-approval")) return "Tier Approvals"
    if (path.includes("/settings")) return "Settings"
    if (path.includes("/loan-officer")) return "Loan Officer Workspace"
    return "MicroFlow Workspace"
  }

  const suggestions = sessionHasDecideTier3(session)
    ? [...SUGGESTIONS_BASE, SUGGESTION_PENDING]
    : SUGGESTIONS_BASE

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [nlqChatHistory, isTyping])

  useEffect(() => {
    if (agentPanelOpen) {
      markAgentResponsesRead()
    }
  }, [agentPanelOpen, markAgentResponsesRead])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 72)}px`
    }
  }, [inputValue])

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSend = useCallback(
    async (text) => {
      if (!text?.trim() || requestInFlightRef.current || !authenticated) return

      const question = text.trim()
      const userMessage = {
        id: `${Date.now()}-u`,
        type: "user",
        text: question,
        timestamp: new Date().toISOString(),
        page: location.pathname,
        source: "live_a4",
      }

      addNlqMessage(userMessage)
      setInputValue("")
      requestInFlightRef.current = true
      setServiceUnavailable(false)
      setIsTyping(true)

      try {
        const result = await queryNlq(question)
        if (!mountedRef.current) return

        let agentText
        let meta = null

        if (result?.kind === "knowledge" || (result?.supported === true && result?.dispatched === false && result?.disclaimer)) {
          const body =
            typeof result.answer === "string" && result.answer.trim()
              ? result.answer.trim()
              : "Agent 4 returned no educational answer."
          const disclaimer =
            typeof result.disclaimer === "string" && result.disclaimer.trim()
              ? result.disclaimer.trim()
              : "General educational information — not live institution data."
          agentText = `${body}\n\n${disclaimer}`
          meta = { kind: "knowledge" }
        } else if (result?.supported === false || result?.kind === "unsupported") {
          agentText =
            (typeof result?.message === "string" && result.message.trim()) ||
            "I'm sorry, but that question is outside my current scope, so I'm unable to help with it right now."
          meta = { kind: "unsupported", reason: result?.reason ?? null }
        } else if (
          result?.kind === "nlq" ||
          (result?.supported === true && result?.dispatched)
        ) {
          agentText =
            typeof result.answer === "string" && result.answer.trim()
              ? result.answer
              : "Agent 4 returned no answer text."
          const d = result.dispatch || {}
          meta = {
            kind: "nlq",
            tier: d.tier,
            actionStatus: d.actionStatus,
            actionId: d.actionId,
            isFallback: d.isFallback,
          }
        } else if (result?.supported === true && result?.dispatched === false) {
          agentText =
            result.reason ||
            "Agent 4 understood the question but did not create an action."
          meta = { kind: "no_dispatch" }
        } else {
          agentText =
            "Unexpected response from Agent 4. No answer was invented — please try again."
          meta = { kind: "unexpected" }
        }

        addNlqMessage({
          id: `${Date.now()}-a`,
          type: "agent",
          text: agentText,
          timestamp: new Date().toISOString(),
          page: location.pathname,
          source: "live_a4",
          meta,
        })
      } catch (err) {
        if (!mountedRef.current) return
        if (err?.status === 503) {
          setServiceUnavailable(true)
        }
        addNlqMessage({
          id: `${Date.now()}-e`,
          type: "agent",
          text: formatNlqError(err),
          timestamp: new Date().toISOString(),
          page: location.pathname,
          source: "live_a4",
          meta: { kind: "error", status: err?.status ?? null },
        })
      } finally {
        requestInFlightRef.current = false
        if (mountedRef.current) setIsTyping(false)
      }
    },
    [addNlqMessage, authenticated, location.pathname]
  )

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend(inputValue)
    }
  }

  const renderAgentMeta = (msg) => {
    const meta = msg.meta
    const time = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
    if (!meta || meta.kind === "error" || meta.kind === "unsupported") {
      return (
        <span>
          Agent 4 — {meta?.kind === "error" ? "Error" : meta?.kind === "unsupported" ? "Unsupported" : "Reply"} — {time}
        </span>
      )
    }
    if (meta.kind === "knowledge") {
      return (
        <span>
          Agent 4 — General education (not live institution data) — {time}
        </span>
      )
    }
    if ((meta.kind === "nlq" || meta.kind === "success") && meta.tier != null) {
      const status = meta.actionStatus ? String(meta.actionStatus) : "ok"
      const fallback = meta.isFallback ? " · fallback policy" : ""
      return (
        <span>
          Answered by Agent 4 — Tier {meta.tier} — {status}
          {fallback} — {time}
        </span>
      )
    }
    return <span>Agent 4 — {time}</span>
  }

  // Do not show FAB/panel without a verified session (avoids demo store / token-only false positives).
  if (!authenticated) {
    return null
  }

  const controlsDisabled = isTyping

  const footerStatus = isTyping
    ? "Agent 4 · Thinking…"
    : serviceUnavailable
      ? "Agent 4 · Currently unavailable"
      : "Agent 4 · Ready to assist"

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[45]">
        <button
          type="button"
          onClick={toggleAgentPanel}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Open Ask Agent 4"
        >
          <MessageCircle size={24} />
          {unreadAgentResponses && !agentPanelOpen && (
            <span className="absolute -inset-1 animate-pulse rounded-full border-2 border-teal-500 opacity-70"></span>
          )}
        </button>
      </div>

      {agentPanelOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={toggleAgentPanel}
        />
      )}

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-background shadow-2xl transition-transform duration-300 ease-out md:w-[45%] ${
          agentPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-sm font-bold text-teal-600">
                A4
              </div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Agent 4 — NLQ Interface
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowConfirmNew(!showConfirmNew)}
                  disabled={controlsDisabled}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  title="New Chat"
                >
                  <MessageSquarePlus size={18} />
                </button>

                {showConfirmNew && (
                  <div className="absolute right-0 top-10 z-50 w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
                    <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                      Start a new chat? Your current conversation will be saved to history.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowConfirmNew(false)}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          archiveNlqChat()
                          setShowConfirmNew(false)
                        }}
                        className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500"
                      >
                        New Chat
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={toggleAgentPanel}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Currently viewing:{" "}
            <span className="text-foreground">{getPageName(location.pathname)}</span>
          </p>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-muted/20 p-6 scroll-smooth"
        >
          {nlqChatHistory.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center animate-in fade-in duration-500">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 shadow-inner">
                <Sparkles size={32} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-foreground">
                Agent 4 — NLQ Interface
              </h3>
              <p className="mb-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Ask about agent activity in your institution. v1 answers grounded
                Graduated Trust activity counts when authorized, plus general
                microfinance education. Educational replies are not live institution
                data and never invent loan, PAR, payroll, or ledger figures.
              </p>

              <div className="flex w-full max-w-md flex-col gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => handleSend(s)}
                    className="rounded-xl border border-teal-500/30 bg-background px-4 py-3 text-left text-sm font-medium text-teal-700 shadow-sm transition-all hover:bg-teal-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-400 dark:hover:text-white"
                  >
                    &quot;{s}&quot;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {nlqChatHistory.map((msg) => {
                const isAgent = msg.type === "agent"

                if (!isAgent) {
                  return (
                    <div
                      key={msg.id}
                      className="flex justify-end animate-in slide-in-from-right-4 duration-300"
                    >
                      <div className="flex max-w-[85%] flex-col items-end">
                        <div
                          className="px-4 py-3 text-sm shadow-sm"
                          style={{
                            background: "#1E3A5F",
                            color: "#F1F5F9",
                            borderRadius: "12px 12px 2px 12px",
                          }}
                        >
                          {msg.text}
                        </div>
                        <span className="mt-1.5 text-[10px] font-medium text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={msg.id}
                    className="group flex justify-start gap-3 animate-in slide-in-from-left-4 duration-300"
                  >
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-xs font-bold text-teal-600">
                      A4
                    </div>
                    <div className="relative flex max-w-[85%] flex-col items-start">
                      <div
                        className="relative px-4 py-3 pr-10 text-sm leading-relaxed"
                        style={{
                          background: "#1E293B",
                          border: "1px solid #334155",
                          color: "#F1F5F9",
                          borderRadius: "12px 12px 12px 2px",
                        }}
                      >
                        {msg.text}

                        <button
                          type="button"
                          onClick={() => copyToClipboard(msg.text, msg.id)}
                          className="absolute top-2 right-2 rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-700 hover:text-white group-hover:opacity-100"
                          title="Copy to clipboard"
                        >
                          {copiedId === msg.id ? (
                            <Check size={14} className="text-green-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] font-medium text-muted-foreground">
                        {renderAgentMeta(msg)}
                      </div>
                    </div>
                  </div>
                )
              })}

              {isTyping && (
                <div className="flex justify-start gap-3 animate-in fade-in duration-300">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-xs font-bold text-teal-600">
                    A4
                  </div>
                  <div
                    className="flex items-center px-4 py-4"
                    style={{
                      background: "#1E293B",
                      border: "1px solid #334155",
                      borderRadius: "12px 12px 12px 2px",
                    }}
                  >
                    <div className="flex gap-1.5">
                      <div
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500"
                        style={{ animationDelay: "0ms" }}
                      ></div>
                      <div
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500"
                        style={{ animationDelay: "150ms" }}
                      ></div>
                      <div
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500"
                        style={{ animationDelay: "300ms" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about agent activity in your institution…"
              disabled={controlsDisabled}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
              rows={1}
              style={{ minHeight: "44px", maxHeight: "72px" }}
            />
            <button
              type="button"
              onClick={() => handleSend(inputValue)}
              disabled={!inputValue.trim() || controlsDisabled}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white transition-all hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] font-medium text-muted-foreground tracking-wide">
            {footerStatus}
          </p>
        </div>
      </div>
    </>
  )
}
