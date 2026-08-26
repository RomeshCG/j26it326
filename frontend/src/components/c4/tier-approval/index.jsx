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
      message: `Action approved and executed. ${selectedItem?.type === 'report' ? 'Report submitted' : 'Action taken'} at ${new Date().toLocaleTimeString()}.`
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

  const getAgentBorder = (bg) => {
    if (!bg) return 'border-l-muted-foreground';
    if (bg.includes('purple')) return 'border-l-purple-500';
    if (bg.includes('red')) return 'border-l-red-500';
    if (bg.includes('blue')) return 'border-l-blue-500';
    if (bg.includes('teal')) return 'border-l-teal-500';
    return 'border-l-muted-foreground';
  };

  const getAgentTextColor = (bg) => {
    if (!bg) return 'text-muted-foreground';
    if (bg.includes('purple')) return 'text-purple-400 border-purple-500/30';
    if (bg.includes('red')) return 'text-red-400 border-red-500/30';
    if (bg.includes('blue')) return 'text-blue-400 border-blue-500/30';
    if (bg.includes('teal')) return 'text-teal-400 border-teal-500/30';
    return 'text-muted-foreground';
  };

  const getRiskTextColor = (level) => {
    if (!level) return 'text-muted-foreground';
    if (level.includes('Low') || level.includes('None')) return 'text-green-500';
    if (level.includes('Medium') || level.includes('Rare')) return 'text-amber-500';
    if (level.includes('High')) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const getRiskDotColor = (level) => {
    if (!level) return 'bg-muted-foreground';
    if (level.includes('Low') || level.includes('None')) return 'bg-green-500';
    if (level.includes('Medium') || level.includes('Rare')) return 'bg-amber-500';
    if (level.includes('High')) return 'bg-red-500';
    return 'bg-muted-foreground';
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans">
      
      {/* Header */}
      <header className="px-8 py-6 bg-background shrink-0 border-b border-border">
        <div className="flex items-center text-xs text-muted-foreground mb-3">
          <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
          <ChevronRight size={12} className="mx-2" />
          <Link to="/agent-log" className="hover:text-foreground transition-colors">Agent Activity Log</Link>
          <ChevronRight size={12} className="mx-2" />
          <span className="text-amber-400">Tier Approval</span>
        </div>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Tier 3 Action — Awaiting Your Approval</h1>
          <div className="border border-amber-500 text-amber-500 px-3 py-1 text-xs font-bold flex items-center gap-1.5 rounded-full bg-amber-500/10">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Tier 3 — Pending Approval
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">An AI agent has prepared the following action. Review the full context before approving or rejecting.</p>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar Queue */}
        <aside className="w-80 border-r border-border bg-background flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 flex items-center justify-between sticky top-0 bg-background z-10 border-b border-border">
            <div className="font-semibold text-foreground text-sm">Pending Approvals</div>
            <div className="bg-muted text-foreground/80 text-xs px-2 py-0.5 font-medium rounded-full">{queue.length}</div>
          </div>
          
          <div className="p-2 flex flex-col space-y-1">
            {queue.map(item => {
              const isSelected = item.id === selectedId
              const borderLeftClass = getAgentBorder(item.agentColor)
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left p-4 cursor-pointer transition-colors border-l-4 ${borderLeftClass} rounded-xl border-t border-r border-b ${
                    isSelected 
                      ? 'bg-card border-border' 
                      : 'bg-transparent border-transparent hover:bg-muted/30'
                  }`}
                >
                  <div className="text-[10px] uppercase text-muted-foreground mb-1 tracking-wider font-semibold">
                    {item.agentName}
                  </div>
                  <div className="font-medium text-sm text-foreground mb-2 leading-snug">{item.title}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
              <CheckCircle size={64} className="mb-6 text-green-500/50" />
              <h2 className="text-2xl font-bold text-foreground mb-2">No pending approvals</h2>
              <p className="text-muted-foreground mb-6 text-sm">All Tier 3 actions have been reviewed.</p>
              <Link to="/agent-log" className="text-blue-500 hover:underline transition-colors cursor-pointer text-sm font-medium">
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
                  <p className="text-muted-foreground text-center text-sm">Loading next item in queue...</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                    <X size={40} className="text-red-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2 text-center">{actionState.message}</h2>
                  <p className="text-muted-foreground text-center text-sm">Loading next item in queue...</p>
                </>
              )}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-300 pb-20">
              
              {/* Section 1: Summary Card */}
              <div className="bg-card border border-border border-l-[3px] border-l-amber-500 p-8 shadow-sm rounded-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`px-2.5 py-0.5 border ${getAgentTextColor(selectedItem.agentColor)} text-[11px] font-bold uppercase tracking-wide rounded-full bg-muted/40`}>
                    {selectedItem.agentName}
                  </div>
                  <div className="text-xs text-muted-foreground">Prepared {selectedItem.preparedTime}</div>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-6">{selectedItem.title}</h2>
                <div className="space-y-3">
                  <div className="flex gap-3 items-start p-1">
                    <ChevronRight className="text-green-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-sm text-foreground font-medium">{selectedItem.approveConsequence}</p>
                  </div>
                  <div className="flex gap-3 items-start p-1">
                    <X className="text-red-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-sm text-muted-foreground">{selectedItem.rejectConsequence}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: What Agent Prepared */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4">What the Agent Prepared</h3>
                <div className="w-full">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="border-t border-b border-border py-3 text-[11px] uppercase text-muted-foreground tracking-wider font-semibold w-1/2">Field</th>
                        <th className="border-t border-b border-border py-3 text-[11px] uppercase text-muted-foreground tracking-wider font-semibold text-right w-1/2">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItem.data.map((row, idx) => (
                        <tr key={idx} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                          <td className="py-4 pr-4 text-foreground font-medium">{row.field}</td>
                          <td className="py-4 pl-4 text-foreground font-mono text-right">{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground italic">Data sourced automatically.</div>
                    <button 
                      onClick={() => setShowPreviewModal(true)}
                      className="text-foreground border border-border hover:border-blue-500 hover:text-blue-400 px-4 py-2 text-sm font-medium transition-colors cursor-pointer rounded-lg bg-card"
                    >
                      Preview Full Report
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 3: Agent Reasoning */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-6">Agent Reasoning Timeline</h3>
                
                <div className="relative pl-6 mb-8">
                  <div className="absolute top-0 bottom-0 left-0 w-px bg-border"></div>
                  <div className="space-y-6">
                    {selectedItem.timeline.map((step, idx) => {
                      const isCompleted = idx < selectedItem.timeline.length - 1;
                      return (
                        <div key={idx} className="relative flex items-center justify-between">
                          <div className={`absolute -left-[29px] w-3 h-3 rounded-full border-2 border-background ${isCompleted ? 'bg-green-500' : 'bg-transparent border-muted-foreground'} `}></div>
                          <div className="text-sm text-foreground pr-4">{step.step}</div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{step.time}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex border-t border-b border-border py-4 divide-x divide-border bg-card/30 rounded-xl p-4">
                  <div className="flex-1 px-4 first:pl-0">
                    <div className="text-foreground font-mono text-lg mb-1">2,847</div>
                    <div className="text-muted-foreground text-[11px] uppercase tracking-wider">Records Processed</div>
                  </div>
                  <div className="flex-1 px-4">
                    <div className="text-green-500 font-mono text-lg mb-1">0</div>
                    <div className="text-muted-foreground text-[11px] uppercase tracking-wider">Validation Errors</div>
                  </div>
                  <div className="flex-1 px-4">
                    <div className="text-foreground font-mono text-lg mb-1">100%</div>
                    <div className="text-muted-foreground text-[11px] uppercase tracking-wider">Data Completeness</div>
                  </div>
                  <div className="flex-1 px-4 last:pr-0">
                    <div className="text-foreground font-mono text-lg mb-1">06:00 AM</div>
                    <div className="text-muted-foreground text-[11px] uppercase tracking-wider">Last Refresh</div>
                  </div>
                </div>
              </div>

              {/* Section 4: Risk Assessment */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4">Risk Assessment</h3>
                <div className="w-full">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="border-t border-b border-border py-3 text-[11px] uppercase text-muted-foreground tracking-wider font-semibold">Risk Factor</th>
                        <th className="border-t border-b border-border py-3 text-[11px] uppercase text-muted-foreground tracking-wider font-semibold">Assessment</th>
                        <th className="border-t border-b border-border py-3 text-[11px] uppercase text-muted-foreground tracking-wider font-semibold">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/40">
                        <td className="py-4 pr-4 text-foreground font-medium">Data Accuracy Risk</td>
                        <td className="py-4 pr-4 font-bold flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full ${getRiskDotColor(selectedItem.risk.accuracy.level)}`}></span>
                           <span className={getRiskTextColor(selectedItem.risk.accuracy.level)}>{selectedItem.risk.accuracy.level}</span>
                        </td>
                        <td className="py-4 text-muted-foreground text-xs leading-relaxed">{selectedItem.risk.accuracy.desc}</td>
                      </tr>
                      <tr className="border-b border-border/40">
                        <td className="py-4 pr-4 text-foreground font-medium">Compliance Risk</td>
                        <td className="py-4 pr-4 font-bold flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full ${getRiskDotColor(selectedItem.risk.compliance.level)}`}></span>
                           <span className={getRiskTextColor(selectedItem.risk.compliance.level)}>{selectedItem.risk.compliance.level}</span>
                        </td>
                        <td className="py-4 text-muted-foreground text-xs leading-relaxed">{selectedItem.risk.compliance.desc}</td>
                      </tr>
                      <tr className="border-b border-border/40">
                        <td className="py-4 pr-4 text-foreground font-medium">Timing Risk</td>
                        <td className="py-4 pr-4 font-bold flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full ${getRiskDotColor(selectedItem.risk.timing.level)}`}></span>
                           <span className={getRiskTextColor(selectedItem.risk.timing.level)}>{selectedItem.risk.timing.level}</span>
                        </td>
                        <td className="py-4 text-muted-foreground text-xs leading-relaxed">{selectedItem.risk.timing.desc}</td>
                      </tr>
                      <tr className="border-b border-border/40">
                        <td className="py-4 pr-4 text-foreground font-medium">Override History</td>
                        <td className="py-4 pr-4 font-bold flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full ${getRiskDotColor(selectedItem.risk.override.level)}`}></span>
                           <span className={getRiskTextColor(selectedItem.risk.override.level)}>{selectedItem.risk.override.level}</span>
                        </td>
                        <td className="py-4 text-muted-foreground text-xs leading-relaxed">{selectedItem.risk.override.desc}</td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <div className="border-t border-border pt-4 mt-6 flex items-center justify-between">
                    <div className="text-muted-foreground text-sm font-semibold uppercase tracking-wider">Overall Assessment</div>
                    <div className={`font-bold text-lg ${getRiskTextColor(selectedItem.risk.overall.level)}`}>{selectedItem.risk.overall.level}</div>
                  </div>
                </div>
              </div>

              {/* Section 5: Approval Action */}
              <div className="pt-8 border-t border-border">
                <div className="mb-8 flex items-start gap-3">
                  <div 
                    className="mt-0.5 cursor-pointer text-foreground"
                    onClick={() => setHasReviewed(!hasReviewed)}
                  >
                    {hasReviewed ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} className="text-muted-foreground" />}
                  </div>
                  <div className="cursor-pointer" onClick={() => setHasReviewed(!hasReviewed)}>
                    <div className="text-foreground mb-1 font-medium text-sm">I confirm I have reviewed the agent's prepared action and the supporting data above.</div>
                    <div className="text-xs text-muted-foreground">This confirmation is required before approval can be granted.</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mb-4">
                  <button 
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={!hasReviewed}
                    className="w-full py-4 px-6 bg-blue-600 text-white font-bold text-base hover:bg-blue-500 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors rounded-xl shadow-lg shadow-blue-600/10 cursor-pointer"
                  >
                    Approve — {selectedItem.type === 'report' ? 'Submit Central Bank Report' : 'Execute Action'}
                  </button>
                  <button 
                    onClick={() => setShowRejectModal(true)}
                    className="w-full py-4 px-6 bg-transparent border border-red-500/50 text-red-400 font-bold text-base hover:bg-red-500/10 hover:border-red-500 transition-colors rounded-xl cursor-pointer"
                  >
                    Reject this action
                  </button>
                </div>
                
                <div className="text-center text-xs text-muted-foreground">
                  All approval and rejection actions are permanently logged in the audit trail.
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-foreground">Document Preview</h2>
              <button onClick={() => setShowPreviewModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto bg-slate-50 text-slate-900 font-serif">
              <div className="text-center mb-8 border-b-2 border-slate-300 pb-4">
                <h1 className="text-xl font-bold mb-1">CENTRAL BANK OF SRI LANKA</h1>
                <h2 className="text-md font-semibold text-slate-600">MONTHLY REPORTING FORM - MICROFINANCE INSTITUTIONS</h2>
                <div className="mt-4 text-sm font-sans text-left text-slate-600">Institution: Apex Microfinance Ltd<br/>Period: November 2024</div>
              </div>
              <table className="w-full text-sm font-sans border-collapse border border-slate-300">
                <tbody>
                  {selectedItem?.data.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="p-3 bg-slate-100 font-semibold border-r border-slate-300 w-1/2">{row.field}</td>
                      <td className="p-3 text-right">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-12 pt-4 border-t border-slate-300 text-xs text-slate-500 font-sans flex justify-between">
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
              <h2 className="text-xl font-bold text-foreground mb-2">Confirm Approval</h2>
              <p className="text-muted-foreground text-sm mb-6">Are you sure you want to approve this action? This will execute immediately and cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowApproveConfirm(false)} className="flex-1 py-2.5 bg-transparent border border-border text-foreground hover:bg-muted transition-colors font-medium rounded-lg cursor-pointer">Cancel</button>
                <button onClick={handleApprove} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white transition-colors font-bold rounded-lg cursor-pointer">Confirm Approval</button>
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
                className="w-full bg-muted border border-border p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500 transition-all mb-6 min-h-[100px] text-sm rounded-lg resize-none"
              ></textarea>
              <div className="flex gap-3">
                <button onClick={() => setShowRejectModal(false)} className="flex-1 py-2.5 bg-transparent border border-border text-foreground hover:bg-muted transition-colors font-medium rounded-lg cursor-pointer">Cancel</button>
                <button 
                  onClick={handleReject} 
                  disabled={!rejectReason.trim()}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:hover:bg-red-600 transition-colors font-bold rounded-lg disabled:cursor-not-allowed cursor-pointer"
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
