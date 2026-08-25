import React, { useState, useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { useStore } from "@/store"
import { 
  X, MessageSquarePlus, Sparkles, Send, 
  Copy, Check, MessageCircle
} from "lucide-react"

export default function AgentPanel() {
  const location = useLocation()
  
  // Zustand Store
  const agentPanelOpen = useStore(state => state.agentPanelOpen)
  const toggleAgentPanel = useStore(state => state.toggleAgentPanel)
  const nlqChatHistory = useStore(state => state.nlqChatHistory) || []
  const addNlqMessage = useStore(state => state.addNlqMessage)
  const archiveNlqChat = useStore(state => state.archiveNlqChat)
  const markAgentResponsesRead = useStore(state => state.markAgentResponsesRead)
  const unreadAgentResponses = useStore(state => state.unreadAgentResponses)

  // Local State
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showConfirmNew, setShowConfirmNew] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)

  // Subtitle logic
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

  // Suggestions logic
  const getSuggestions = (path) => {
    if (path.includes("/payroll")) {
      return [
        "What is the total net payroll this month?",
        "Which staff member has the highest EPF contribution?",
        "Has payroll been run this month?"
      ]
    }
    if (path.includes("/hr")) {
      return [
        "How many staff are currently on leave?",
        "Which branch has the most staff?",
        "Are there any pending leave requests?"
      ]
    }
    if (path.includes("/agent-log")) {
      return [
        "How many Tier 3 actions are awaiting approval?",
        "Which agent has been most active today?",
        "Have there been any human overrides this week?"
      ]
    }
    if (path.includes("/tier-approval")) {
      return [
        "What actions are pending my approval?",
        "How long has the oldest pending action been waiting?"
      ]
    }
    // Default / Dashboard
    return [
      "What is this month's collection rate?",
      "Which branch has the highest PAR30?",
      "How much was paid in EPF this month?",
      "How many Tier 3 actions are pending approval?"
    ]
  }

  const suggestions = getSuggestions(location.pathname)

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [nlqChatHistory, isTyping])

  // Mark read when open
  useEffect(() => {
    if (agentPanelOpen) {
      markAgentResponsesRead()
    }
  }, [agentPanelOpen, markAgentResponsesRead])

  // Handle Input Auto Resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 72)}px` // ~3 lines max
    }
  }, [inputValue])

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSend = (text) => {
    if (!text.trim()) return

    const userMessage = {
      id: Date.now().toString(),
      type: "user",
      text: text.trim(),
      timestamp: new Date().toISOString(),
      page: location.pathname
    }
    
    addNlqMessage(userMessage)
    setInputValue("")
    setIsTyping(true)

    // NLP Parsing
    setTimeout(() => {
      let responseText = ""
      const q = text.toLowerCase()
      
      if (q.includes("collection rate")) {
        responseText = "This month's collection rate is 91.3%, up from 88.7% last month. The Kandy branch leads with 94.1% while the Ampara branch is the lowest at 84.2%."
      } else if (q.includes("par30")) {
        responseText = "Current PAR30 across all branches is 4.2%, within the healthy threshold of under 5%. The Ampara branch has the highest PAR30 at 7.8%. This has been flagged to the Branch Manager."
      } else if (q.includes("epf")) {
        responseText = "Total EPF contributions this month: Employee EPF (8%) — LKR 99,800. Employer EPF (12%) — LKR 149,700. ETF (3%) — LKR 37,425. All figures auto-posted to Finance by Agent 2 after payroll run."
      } else if (q.includes("payroll")) {
        responseText = `December 2024 payroll has been processed. Total net payable: LKR 1,122,575 across 8 staff members. Payroll journal entries were automatically posted to Finance by Agent 2 on ${new Date().toLocaleDateString()}.`
      } else if (q.includes("leave")) {
        responseText = "Currently 1 staff member is on leave. There are 2 pending leave requests awaiting HR approval. Annual leave utilisation this month is 12% across all staff."
      } else if (q.includes("agent") || q.includes("tier")) {
        responseText = "There are currently 3 Tier 3 actions awaiting approval. Agent 3 has been the most active today with 4 anomaly detections. No human overrides have occurred in the past 7 days."
      } else if (q.includes("staff") || q.includes("headcount")) {
        responseText = "Total active staff: 10 across 3 branches. Colombo branch has the most staff with 4 members. There are 2 vacant positions currently open."
      } else if (q.includes("branch")) {
        responseText = "You have 3 active branches: Colombo, Kandy, and Ampara. Colombo branch has the highest loan portfolio at LKR 22.4M. Kandy branch has the best collection rate at 94.1%."
      } else if (q.includes("loan") || q.includes("portfolio")) {
        responseText = "Total active loans: 1,247. Total portfolio value: LKR 48.3M. Group loans account for 68% of the portfolio. 87 new loans were disbursed this month."
      } else {
        responseText = "I don't have specific data on that query right now. For detailed analysis please check the relevant module or contact your system administrator. You can also try rephrasing your question."
      }

      const agentMessage = {
        id: (Date.now() + 1).toString(),
        type: "agent",
        text: responseText,
        timestamp: new Date().toISOString(),
        page: location.pathname
      }

      addNlqMessage(agentMessage)
      setIsTyping(false)
    }, 1500)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend(inputValue)
    }
  }

  return (
    <>
      {/* Floating Action Button (Global) */}
      <div className="fixed bottom-6 right-6 z-[45]">
        <button
          onClick={toggleAgentPanel}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <MessageCircle size={24} />
          {unreadAgentResponses && !agentPanelOpen && (
            <span className="absolute -inset-1 animate-pulse rounded-full border-2 border-teal-500 opacity-70"></span>
          )}
        </button>
      </div>

      {/* Backdrop */}
      {agentPanelOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={toggleAgentPanel}
        />
      )}

      {/* Side Panel */}
      <div 
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-background shadow-2xl transition-transform duration-300 ease-out md:w-[45%] ${
          agentPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex flex-col border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-sm font-bold text-teal-600">
                A4
              </div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Agent 4 — NLQ Interface
              </h2>
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" title="Agent Online"></div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setShowConfirmNew(!showConfirmNew)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="New Chat"
                >
                  <MessageSquarePlus size={18} />
                </button>
                
                {/* Confirmation Popover */}
                {showConfirmNew && (
                  <div className="absolute right-0 top-10 w-64 rounded-lg border border-border bg-card p-3 shadow-lg z-50">
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      Start a new chat? Your current conversation will be saved to history.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setShowConfirmNew(false)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => {
                          archiveNlqChat()
                          setShowConfirmNew(false)
                        }}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-500"
                      >
                        New Chat
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={toggleAgentPanel}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            Currently viewing: <span className="text-foreground">{getPageName(location.pathname)}</span>
          </p>
        </div>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-muted/20 p-6 scroll-smooth"
        >
          {nlqChatHistory.length === 0 ? (
            // Welcome State
            <div className="flex h-full flex-col items-center justify-center text-center animate-in fade-in duration-500">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 shadow-inner">
                <Sparkles size={32} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-foreground">Agent 4 — NLQ Interface</h3>
              <p className="mb-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Ask me anything about your institution. I have access to loan data, financial records, staff information, and agent activity.
              </p>
              
              <div className="flex w-full max-w-md flex-col gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="rounded-xl border border-teal-500/30 bg-background px-4 py-3 text-sm font-medium text-teal-700 dark:text-teal-400 transition-all hover:bg-teal-600 hover:text-white dark:hover:text-white text-left shadow-sm"
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Chat History
            <div className="flex flex-col gap-6">
              {nlqChatHistory.map((msg) => {
                const isAgent = msg.type === "agent"
                
                if (!isAgent) {
                  return (
                    <div key={msg.id} className="flex justify-end animate-in slide-in-from-right-4 duration-300">
                      <div className="flex max-w-[85%] flex-col items-end">
                        <div 
                          className="px-4 py-3 text-sm shadow-sm"
                          style={{
                            background: "#1E3A5F",
                            color: "#F1F5F9",
                            borderRadius: "12px 12px 2px 12px"
                          }}
                        >
                          {msg.text}
                        </div>
                        <span className="mt-1.5 text-[10px] text-muted-foreground font-medium">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                }

                // Agent Message
                return (
                  <div key={msg.id} className="flex justify-start gap-3 animate-in slide-in-from-left-4 duration-300 group">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-xs font-bold text-teal-600 mt-1">
                      A4
                    </div>
                    <div className="flex max-w-[85%] flex-col items-start relative">
                      <div 
                        className="px-4 py-3 text-sm leading-relaxed relative pr-10"
                        style={{
                          background: "#1E293B",
                          border: "1px solid #334155",
                          color: "#F1F5F9",
                          borderRadius: "12px 12px 12px 2px"
                        }}
                      >
                        {msg.text}
                        
                        {/* Copy Button */}
                        <button 
                          onClick={() => copyToClipboard(msg.text, msg.id)}
                          className="absolute right-2 top-2 p-1.5 text-slate-400 opacity-0 transition-opacity hover:text-white group-hover:opacity-100 rounded-md hover:bg-slate-700"
                          title="Copy to clipboard"
                        >
                          {copiedId === msg.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-col text-[10px] text-muted-foreground font-medium gap-0.5">
                        <span>Answered by Agent 4 — Tier 1 — Auto — {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start gap-3 animate-in fade-in duration-300">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-xs font-bold text-teal-600 mt-1">
                    A4
                  </div>
                  <div 
                    className="flex items-center px-4 py-4"
                    style={{
                      background: "#1E293B",
                      border: "1px solid #334155",
                      borderRadius: "12px 12px 12px 2px"
                    }}
                  >
                    <div className="flex gap-1.5">
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" style={{ animationDelay: "0ms" }}></div>
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" style={{ animationDelay: "150ms" }}></div>
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-card p-4">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your institution..."
              className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
              rows={1}
              style={{ minHeight: "44px", maxHeight: "72px" }}
            />
            <button
              onClick={() => handleSend(inputValue)}
              disabled={!inputValue.trim() || isTyping}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white transition-all hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground font-medium">
            Agent 4 has access to your institution's live data.
          </p>
        </div>
      </div>
    </>
  )
}
