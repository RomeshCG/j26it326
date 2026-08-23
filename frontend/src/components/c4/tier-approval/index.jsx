import React, { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { 
  CheckCircle, AlertTriangle, X, ShieldAlert, ChevronRight,
  FileText, Clock, AlertCircle, Info, Database,
  CheckSquare, Square, Activity
} from "lucide-react"

// --- DUMMY DATA ---
const INITIAL_PENDING = [
  {
    id: 1,
    agent: "A1",
    agentName: "Agent 1 — Compliance",
    agentColor: "bg-purple-500",
    title: "Central Bank Monthly Report — November 2024",
    timeWaiting: "waiting 2 hours",
    preparedTime: "09:14 AM",
    approveConsequence: "Approving this will submit the November 2024 regulatory report to the Central Bank of Sri Lanka reporting portal and mark it as filed in MicroFlow.",
    rejectConsequence: "Rejecting this will discard the prepared report. Agent 1 will not recompile until next month end.",
    type: "report",
    data: [
      { field: "Reporting Period", value: "November 2024" },
      { field: "Total Loan Portfolio", value: "LKR 48,340,000" },
      { field: "Number of Active Borrowers", value: "1,247" },
      { field: "PAR30", value: "4.2%" },
      { field: "PAR90", value: "1.8%" },
      { field: "New Loans Disbursed", value: "87" },
      { field: "Total Disbursements", value: "LKR 6,750,000" },
      { field: "Write-offs", value: "LKR 0" },
      { field: "Operational Self-Sufficiency", value: "112.4%" }
    ],
    timeline: [
      { step: "Month-end trigger detected", time: "December 1, 2024 at 00:01 AM" },
      { step: "Transaction data pulled from Finance module — 2,847 records processed", time: "00:02 AM" },
      { step: "Loan portfolio data pulled from C3 — 1,247 active loans", time: "00:03 AM" },
      { step: "CBSL report template loaded — Version 4.2 (current)", time: "00:03 AM" },
      { step: "Data mapped to template fields — 23 fields populated automatically", time: "00:05 AM" },
      { step: "Validation checks passed — 0 errors, 0 warnings", time: "00:06 AM" },
      { step: "Report compiled and queued for human approval — awaiting review", time: "00:06 AM" }
    ],
    risk: {
      accuracy: { level: "Low", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", desc: "All figures cross-validated against source transactions" },
      compliance: { level: "Low", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", desc: "Report format matches current CBSL template v4.2" },
      timing: { level: "Low", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", desc: "Report is within the 5-day submission window" },
      override: { level: "None", color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", desc: "This action type has never been overridden previously" },
      overall: { level: "Low Risk — safe to approve", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" }
    }
  },
  {
    id: 2,
    agent: "A3",
    agentName: "Agent 3 — Anomaly",
    agentColor: "bg-red-500",
    title: "Unusual Transaction Escalation — Ampara Branch",
    timeWaiting: "waiting 5 hours",
    preparedTime: "06:22 AM",
    approveConsequence: "Approving this will freeze the associated borrower account and notify the Branch Manager for manual investigation.",
    rejectConsequence: "Rejecting this will clear the anomaly alert and allow the transaction to proceed normally.",
    type: "escalation",
    data: [
      { field: "Transaction ID", value: "TXN-99824" },
      { field: "Branch", value: "Ampara" },
      { field: "Amount", value: "LKR 485,000" },
      { field: "Time", value: "11:47 PM" },
      { field: "Flag Reason", value: "Outside normal operating hours & 300% above average" }
    ],
    timeline: [
      { step: "Transaction received in stream", time: "11:47 PM" },
      { step: "Baseline deviation detected (>300%)", time: "11:47 PM" },
      { step: "Time-of-day rule triggered (Outside 06:00-20:00)", time: "11:47 PM" },
      { step: "Risk score calculated (92/100)", time: "11:48 PM" },
      { step: "Escalated to Tier 3 human review due to high risk", time: "11:48 PM" }
    ],
    risk: {
      accuracy: { level: "High", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", desc: "Transaction pattern severely deviates from historical baseline" },
      compliance: { level: "Medium", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", desc: "Potential AML flag requires manual KYC review" },
      timing: { level: "High", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", desc: "Immediate action recommended to prevent fund extraction" },
      override: { level: "Rare", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", desc: "Similar alerts have been overridden 5% of the time" },
      overall: { level: "High Risk — requires manual investigation", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" }
    }
  },
  {
    id: 3,
    agent: "A1",
    agentName: "Agent 1 — Compliance",
    agentColor: "bg-purple-500",
    title: "EPF/ETF Compliance Report",
    timeWaiting: "waiting 1 day",
    preparedTime: "Yesterday 08:30 AM",
    approveConsequence: "Approving this will dispatch the EPF/ETF returns to the Department of Labour.",
    rejectConsequence: "Rejecting this will discard the report and notify HR.",
    type: "report",
    data: [
      { field: "Reporting Month", value: "November 2024" },
      { field: "Total EPF (Employee)", value: "LKR 185,000" },
      { field: "Total EPF (Employer)", value: "LKR 277,500" },
      { field: "Total ETF", value: "LKR 69,375" },
      { field: "Total Remittance", value: "LKR 531,875" }
    ],
    timeline: [
      { step: "Payroll finalisation event detected", time: "Yesterday 08:25 AM" },
      { step: "EPF/ETF totals aggregated from HR module", time: "Yesterday 08:27 AM" },
      { step: "Dept of Labour Form C template populated", time: "Yesterday 08:29 AM" },
      { step: "Queued for human approval", time: "Yesterday 08:30 AM" }
    ],
    risk: {
      accuracy: { level: "Low", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", desc: "Figures match finalized payroll run" },
      compliance: { level: "Low", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", desc: "Standard statutory formatting applied" },
      timing: { level: "Medium", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", desc: "Due in 3 days. Action needed soon." },
      override: { level: "None", color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border", desc: "Never overridden" },
      overall: { level: "Low Risk — safe to approve", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" }
    }
  }
]

export default function TierApproval() {
  const [queue, setQueue] = useState(INITIAL_PENDING)
  const [selectedId, setSelectedId] = useState(INITIAL_PENDING[0]?.id || null)
  
  const [hasReviewed, setHasReviewed] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  
  const [actionState, setActionState] = useState({ type: null, message: null }) // 'success' | 'rejected'

  const selectedItem = queue.find(item => item.id === selectedId)

  // Sync count to localstorage for prototype dashboard badge
  useEffect(() => {
    localStorage.setItem("mf_tier3_count", queue.length.toString())
    window.dispatchEvent(new Event('storage'))
  }, [queue])

  // Reset checkboxes and states when selection changes
  useEffect(() => {
    setHasReviewed(false)
    setActionState({ type: null, message: null })
  }, [selectedId])

  const handleApprove = () => {
    setActionState({
      type: "success",
      message: `Action approved and executed. ${selectedItem.type === 'report' ? 'Report submitted' : 'Action taken'} at ${new Date().toLocaleTimeString()}.`
    })
    setShowApproveConfirm(false)
    setTimeout(() => removeCurrentAndNext(), 2500)
  }

  const handleReject = () => {
    if (!rejectReason.trim()) return
    setActionState({
      type: "rejected",
      message: "Action rejected. Agent has been notified. Reason logged in audit trail."
    })
    setShowRejectModal(false)
    setRejectReason("")
    setTimeout(() => removeCurrentAndNext(), 2500)
  }
  
  const removeCurrentAndNext = () => {
    const newQueue = queue.filter(q => q.id !== selectedId)
    setQueue(newQueue)
    if (newQueue.length > 0) {
      setSelectedId(newQueue[0].id)
    } else {
      setSelectedId(null)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans">
      
      {/* Header */}
      <header className="px-8 py-6 border-b border-border bg-card shrink-0">
        <div className="flex items-center text-xs text-muted-foreground mb-3">
          <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          <ChevronRight size={12} className="mx-2" />
          <Link to="/agent-log" className="hover:text-foreground transition-colors">Agent Activity Log</Link>
          <ChevronRight size={12} className="mx-2" />
          <span className="text-amber-400">Tier Approval</span>
        </div>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Tier 3 Action — Awaiting Your Approval</h1>
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(245,158,11,0.15)] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Tier 3 — Pending Approval
          </div>
        </div>
        <p className="text-muted-foreground mt-2">An AI agent has prepared the following action. Review the full context before approving or rejecting.</p>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar Queue */}
        <aside className="w-80 border-r border-border bg-muted/40 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-muted/40 z-10">
            <div className="font-semibold text-foreground">Pending Approvals</div>
            <div className="bg-muted text-foreground/80 text-xs px-2 py-0.5 rounded-full font-medium">{queue.length}</div>
          </div>
          
          <div className="p-3 space-y-2">
            {queue.map(item => {
              const isSelected = item.id === selectedId
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? "bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20" 
                      : "bg-muted border-border hover:border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-5 h-5 rounded-full ${item.agentColor} flex items-center justify-center text-[9px] font-bold text-foreground shrink-0`}>
                      {item.agent}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground truncate">{item.agentName}</span>
                  </div>
                  <div className="font-medium text-sm text-foreground mb-2 leading-snug">{item.title}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
                    <Clock size={12} /> {item.timeWaiting}
                  </div>
                </button>
              )
            })}
            
            {queue.length === 0 && (
              <div className="p-6 text-center text-muted-foreground flex flex-col items-center">
                <CheckCircle size={32} className="mb-3 opacity-20" />
                <div className="text-sm font-medium">Queue Empty</div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Detail Content */}
        <div className="flex-1 overflow-y-auto bg-background p-6 lg:p-10 custom-scrollbar relative">
          
          {!selectedItem ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <ShieldAlert size={48} className="mb-4 text-green-500/20" />
              <h2 className="text-xl font-bold text-foreground mb-2">All Tier 3 actions reviewed.</h2>
              <p className="text-muted-foreground mb-6">No pending approvals in your queue.</p>
              <Link to="/agent-log" className="bg-muted hover:bg-muted text-foreground border border-border px-6 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                Return to Agent Activity Log
              </Link>
            </div>
          ) : actionState.type ? (
            <div className="h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
              {actionState.type === 'success' ? (
                <>
                  <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle size={40} className="text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2 text-center">{actionState.message}</h2>
                  <p className="text-muted-foreground text-center">Loading next item in queue...</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                    <X size={40} className="text-muted-foreground" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2 text-center">{actionState.message}</h2>
                  <p className="text-muted-foreground text-center">Loading next item in queue...</p>
                </>
              )}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
              
              {/* Section 1: Summary Card */}
              <div className="bg-card rounded-2xl border border-border border-l-4 border-l-amber-500 p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none"></div>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className={`w-8 h-8 rounded-full ${selectedItem.agentColor} flex items-center justify-center text-xs font-bold text-foreground shadow-lg`}>
                    {selectedItem.agent}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground/80">{selectedItem.agentName}</div>
                    <div className="text-xs text-muted-foreground">Prepared {selectedItem.preparedTime}</div>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-foreground mb-6 relative z-10">{selectedItem.title}</h2>
                <div className="space-y-3 relative z-10">
                  <div className="flex gap-3 items-start bg-green-500/5 p-4 rounded-xl border border-green-500/10">
                    <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-green-50 font-medium leading-relaxed">{selectedItem.approveConsequence}</p>
                  </div>
                  <div className="flex gap-3 items-start bg-muted/30 p-4 rounded-xl border border-border">
                    <X className="text-muted-foreground shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-foreground/80 leading-relaxed">{selectedItem.rejectConsequence}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: What Agent Prepared */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="text-blue-400" size={20} />
                  What {selectedItem.agent} prepared
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-slate-800/50">
                      {selectedItem.data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4 text-muted-foreground w-1/3 bg-muted font-medium border-r border-border/50">{row.field}</td>
                          <td className="p-4 text-foreground font-mono">{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-4 bg-muted border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5"><Database size={14} /> Data sourced automatically. Last sync: today at 06:00 AM.</div>
                    <button 
                      onClick={() => setShowPreviewModal(true)}
                      className="text-blue-400 hover:text-blue-300 font-medium underline underline-offset-4 cursor-pointer"
                    >
                      Preview Full Report
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 3: Agent Reasoning */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <Activity className="text-purple-400" size={20} />
                  Agent reasoning and data sources
                </h3>
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  
                  <div className="relative space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
                    {selectedItem.timeline.map((step, idx) => (
                      <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-border bg-background text-muted-foreground shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow z-10">
                          <CheckCircle size={12} className="text-blue-500" />
                        </div>
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-muted p-4 rounded-xl border border-border/50 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-muted-foreground">{step.time}</span>
                          </div>
                          <div className="text-sm font-medium text-foreground leading-snug">{step.step}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-background p-3 rounded-lg border border-border/50">
                      <div className="text-muted-foreground text-[10px] uppercase font-bold mb-1">Records Processed</div>
                      <div className="text-foreground font-mono text-sm">2,847</div>
                    </div>
                    <div className="bg-background p-3 rounded-lg border border-border/50">
                      <div className="text-muted-foreground text-[10px] uppercase font-bold mb-1">Validation Errors</div>
                      <div className="text-green-400 font-mono text-sm">0</div>
                    </div>
                    <div className="bg-background p-3 rounded-lg border border-border/50">
                      <div className="text-muted-foreground text-[10px] uppercase font-bold mb-1">Completeness</div>
                      <div className="text-foreground font-mono text-sm">100%</div>
                    </div>
                    <div className="bg-background p-3 rounded-lg border border-border/50">
                      <div className="text-muted-foreground text-[10px] uppercase font-bold mb-1">Data Refresh</div>
                      <div className="text-foreground/80 font-mono text-sm">06:00 AM</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Risk Assessment */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <ShieldAlert className="text-amber-400" size={20} />
                  Risk of approving this action
                </h3>
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className={`p-4 rounded-xl border ${selectedItem.risk.accuracy.bg} ${selectedItem.risk.accuracy.border}`}>
                      <div className="text-muted-foreground text-xs font-bold uppercase mb-1">Data Accuracy Risk</div>
                      <div className={`font-bold mb-1 ${selectedItem.risk.accuracy.color}`}>{selectedItem.risk.accuracy.level}</div>
                      <div className="text-xs text-foreground/80">{selectedItem.risk.accuracy.desc}</div>
                    </div>
                    <div className={`p-4 rounded-xl border ${selectedItem.risk.compliance.bg} ${selectedItem.risk.compliance.border}`}>
                      <div className="text-muted-foreground text-xs font-bold uppercase mb-1">Compliance Risk</div>
                      <div className={`font-bold mb-1 ${selectedItem.risk.compliance.color}`}>{selectedItem.risk.compliance.level}</div>
                      <div className="text-xs text-foreground/80">{selectedItem.risk.compliance.desc}</div>
                    </div>
                    <div className={`p-4 rounded-xl border ${selectedItem.risk.timing.bg} ${selectedItem.risk.timing.border}`}>
                      <div className="text-muted-foreground text-xs font-bold uppercase mb-1">Timing Risk</div>
                      <div className={`font-bold mb-1 ${selectedItem.risk.timing.color}`}>{selectedItem.risk.timing.level}</div>
                      <div className="text-xs text-foreground/80">{selectedItem.risk.timing.desc}</div>
                    </div>
                    <div className={`p-4 rounded-xl border ${selectedItem.risk.override.bg} ${selectedItem.risk.override.border}`}>
                      <div className="text-muted-foreground text-xs font-bold uppercase mb-1">Override History</div>
                      <div className={`font-bold mb-1 ${selectedItem.risk.override.color}`}>{selectedItem.risk.override.level}</div>
                      <div className="text-xs text-foreground/80">{selectedItem.risk.override.desc}</div>
                    </div>
                  </div>
                  <div className={`p-5 rounded-xl border flex items-center justify-between ${selectedItem.risk.overall.bg} ${selectedItem.risk.overall.border}`}>
                    <div className="font-bold text-foreground/80">Overall Assessment</div>
                    <div className={`font-bold text-lg ${selectedItem.risk.overall.color}`}>{selectedItem.risk.overall.level}</div>
                  </div>
                </div>
              </div>

              {/* Section 5: Approval Action */}
              <div className="bg-card border border-border rounded-xl p-6 shadow-lg mb-20">
                <div 
                  className="flex items-start gap-3 p-4 bg-muted border border-border rounded-xl mb-6 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setHasReviewed(!hasReviewed)}
                >
                  <div className="mt-0.5 text-blue-500 shrink-0">
                    {hasReviewed ? <CheckSquare size={20} /> : <Square size={20} />}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground mb-1">I have reviewed the agent's prepared action and the supporting data above.</div>
                    <div className="text-xs text-muted-foreground">This confirmation is required before approval can be granted.</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 py-4 px-6 rounded-xl border-2 border-red-500/50 text-red-400 font-bold hover:bg-red-500/10 hover:border-red-500 transition-all cursor-pointer text-center"
                  >
                    Reject this action
                  </button>
                  <button 
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={!hasReviewed}
                    className="flex-1 py-4 px-6 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 disabled:opacity-30 disabled:hover:bg-green-600 transition-all cursor-pointer text-center shadow-lg shadow-green-600/20 disabled:shadow-none"
                  >
                    Approve — {selectedItem.type === 'report' ? 'Submit Central Bank Report' : 'Execute Action'}
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-foreground">Document Preview</h2>
              <button onClick={() => setShowPreviewModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto bg-slate-50 text-slate-900 font-serif">
              <div className="text-center mb-8 border-b-2 border-slate-300 pb-4">
                <h1 className="text-xl font-bold mb-1">CENTRAL BANK OF SRI LANKA</h1>
                <h2 className="text-md font-semibold text-muted-foreground">MONTHLY REPORTING FORM - MICROFINANCE INSTITUTIONS</h2>
                <div className="mt-4 text-sm font-sans text-left text-muted-foreground">Institution: Apex Microfinance Ltd<br/>Period: November 2024</div>
              </div>
              <table className="w-full text-sm font-sans border-collapse border border-slate-300">
                <tbody>
                  {selectedItem.data.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="p-3 bg-slate-100 font-semibold border-r border-slate-300 w-1/2">{row.field}</td>
                      <td className="p-3 text-right">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-12 pt-4 border-t border-slate-300 text-xs text-muted-foreground font-sans flex justify-between">
                <div>Generated by MicroFlow Automated Compliance System</div>
                <div>Status: DRAFT - PENDING APPROVAL</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirm Modal */}
      {showApproveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <AlertTriangle size={24} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Confirm Approval</h2>
              <p className="text-muted-foreground text-sm mb-6">Are you sure you want to approve this action? This will execute immediately and cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowApproveConfirm(false)} className="flex-1 py-2.5 rounded-lg border border-border text-foreground/80 hover:bg-muted transition-colors font-medium">Cancel</button>
                <button onClick={handleApprove} className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors font-bold shadow-lg shadow-green-600/20">Confirm Approval</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-2">Reject Action</h2>
              <p className="text-muted-foreground text-sm mb-4">Please provide a reason for rejecting this action. This will be logged in the audit trail.</p>
              <textarea 
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (required)..."
                className="w-full bg-muted border border-border rounded-lg p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all mb-6 min-h-[100px] text-sm"
              ></textarea>
              <div className="flex gap-3">
                <button onClick={() => setShowRejectModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-foreground/80 hover:bg-muted transition-colors font-medium">Cancel</button>
                <button 
                  onClick={handleReject} 
                  disabled={!rejectReason.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:hover:bg-red-600 transition-colors font-bold shadow-lg shadow-red-600/20 disabled:shadow-none"
                >
                  Submit Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
