import React, { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { 
  Search, Filter, X, ChevronDown, CheckCircle, 
  AlertTriangle, Info, Clock, Download, ChevronLeft, ChevronRight,
  ShieldAlert, Activity, FileText, MessageSquare
} from "lucide-react"

import { APPROVAL_LINKS } from "@/components/c4/graduated-trust/mock-data"

// --- DUMMY DATA ---
const INITIAL_LOGS = [
  {
    id: "LOG-025",
    agent: "A1",
    agentName: "Compliance",
    action: "CBSL monthly report compiled — missing branch data detected in Kandy and Kurunegala (91% completeness)",
    tier: "Tier 3",
    tierBadge: "Pending Approval",
    status: "Awaiting Approval",
    outcome: "Report queued for approval",
    override: "No",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Core banking GL balances, Loan Portfolio snapshot as of Nov 30",
      confidence: "91%",
      processingTime: "450ms",
      tablesAffected: "None (Read-only)",
      overrideReason: null
    }
  },
  {
    id: "LOG-024",
    agent: "A2",
    agentName: "Workflow",
    action: "Payroll journal entries posted to Finance: Salaries Expense DR LKR 1,247,500",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    outcome: "Journal entries posted",
    override: "No",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Approved Payroll run ID #PR-2024-12",
      confidence: "100%",
      processingTime: "120ms",
      tablesAffected: "finance_journal, finance_ledger",
      overrideReason: null
    }
  },
  {
    id: "LOG-023",
    agent: "A3",
    agentName: "Anomaly",
    action: "Unusual disbursement detected: LKR 485,000 to borrower ID #4471, Ampara branch, 11:47 PM — flagged as outside normal operating hours",
    tier: "Tier 3",
    tierBadge: "Pending Approval",
    status: "Awaiting Approval",
    outcome: "Escalated to Finance Officer",
    override: "No",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Transaction stream window: 23:00-00:00",
      confidence: "87.4%",
      processingTime: "85ms",
      tablesAffected: "alerts_log, transaction_queue",
      overrideReason: null
    }
  },
  {
    id: "LOG-022",
    agent: "A4",
    agentName: "NLQ",
    action: "NLQ query answered for Finance Officer: \"What is total EPF liability this month?\"",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    outcome: "Query answered",
    override: "No",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Query: 'What is total EPF liability this month?' UserRole: Finance Officer",
      confidence: "95.1%",
      processingTime: "1200ms",
      tablesAffected: "None (Read-only)",
      overrideReason: null
    }
  },
  {
    id: "LOG-021",
    agent: "A3",
    agentName: "Anomaly",
    action: "Duplicate repayment pattern detected: borrower #3892 has 3 identical payments of LKR 12,500 within 48 hours",
    tier: "Tier 2",
    tierBadge: "Notified",
    status: "Completed",
    outcome: "Manager notified",
    override: "No",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Rolling 48h repayment log",
      confidence: "92.3%",
      processingTime: "110ms",
      tablesAffected: "notifications_queue",
      overrideReason: null
    }
  },
  {
    id: "LOG-020",
    agent: "A2",
    agentName: "Workflow",
    action: "Budget threshold alert: Kandy branch operational expenses exceeded monthly budget by 12% after payroll posting",
    tier: "Tier 2",
    tierBadge: "Notified",
    status: "Completed",
    outcome: "Branch Manager notified",
    override: "No",
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "GL Expense Accounts vs Budget Config",
      confidence: "100%",
      processingTime: "45ms",
      tablesAffected: "notifications_queue",
      overrideReason: null
    }
  },
  {
    id: "LOG-019",
    agent: "A1",
    agentName: "Compliance",
    action: "EPF/ETF compliance report auto-generated for Department of Labour submission",
    tier: "Tier 2",
    tierBadge: "Notified",
    status: "Completed",
    outcome: "HR Officer notified",
    override: "No",
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Payroll summary Dec 2024",
      confidence: "99.9%",
      processingTime: "320ms",
      tablesAffected: "documents_archive",
      overrideReason: null
    }
  },
  {
    id: "LOG-018",
    agent: "A3",
    agentName: "Anomaly",
    action: "Transaction anomaly: 14 micro-loans approved within 2 hours at Galle branch — volume spike 340% above baseline",
    tier: "Tier 4",
    tierBadge: "Alert Only",
    status: "Awaiting Approval",
    outcome: "Human decision required",
    override: "No",
    timestamp: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Loan origination events stream",
      confidence: "94.7%",
      processingTime: "150ms",
      tablesAffected: "alerts_log",
      overrideReason: null
    }
  },
  {
    id: "LOG-017",
    agent: "A2",
    agentName: "Workflow",
    action: "Loan disbursement event from C3: journal entry posted — Disbursements DR LKR 75,000, Loan Portfolio CR LKR 75,000",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    outcome: "Journal entries posted",
    override: "No",
    timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Disbursement Event #DSB-8839",
      confidence: "100%",
      processingTime: "60ms",
      tablesAffected: "finance_journal, finance_ledger",
      overrideReason: null
    }
  },
  {
    id: "LOG-016",
    agent: "A4",
    agentName: "NLQ",
    action: "NLQ query answered for Branch Manager: \"Which loan officers have the highest collection rate this week?\"",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    outcome: "Query answered",
    override: "No",
    timestamp: new Date(Date.now() - 74 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Query: 'Which loan officers have the highest collection rate this week?'",
      confidence: "96.4%",
      processingTime: "1450ms",
      tablesAffected: "None (Read-only)",
      overrideReason: null
    }
  },
  {
    id: "LOG-015",
    agent: "A3",
    agentName: "Anomaly",
    action: "Anomaly cleared: Transaction #8821 reviewed by Finance Officer, confirmed legitimate — previously flagged Tier 3 alert resolved",
    tier: "Tier 3",
    tierBadge: "Pending Approval",
    status: "Overridden",
    outcome: "Alert resolved",
    override: "Yes",
    timestamp: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "User interaction event on Alert #8821",
      confidence: "N/A",
      processingTime: "40ms",
      tablesAffected: "alerts_log, audit_trail",
      overrideReason: "Overridden by Nimal Perera, Finance Officer — Reason: Verified large loan approved by board"
    }
  },
  {
    id: "LOG-014",
    agent: "A1",
    agentName: "Compliance",
    action: "KYC profile completeness check: flagged 32 accounts missing updated NIC documents",
    tier: "Tier 2",
    tierBadge: "Notified",
    status: "Completed",
    outcome: "Compliance Officer notified",
    override: "No",
    timestamp: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Customer database scan",
      confidence: "100%",
      processingTime: "2100ms",
      tablesAffected: "notifications_queue",
      overrideReason: null
    }
  },
  {
    id: "LOG-013",
    agent: "A2",
    agentName: "Workflow",
    action: "Automated end-of-day reconciliation for all collection accounts",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    outcome: "Reconciliation successful",
    override: "No",
    timestamp: new Date(Date.now() - 120 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Daily transaction batches",
      confidence: "100%",
      processingTime: "4500ms",
      tablesAffected: "reconciliation_logs",
      overrideReason: null
    }
  },
  {
    id: "LOG-012",
    agent: "A4",
    agentName: "NLQ",
    action: "NLQ query answered: \"Show me PAR30 trends for the last 6 months across all branches\"",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    outcome: "Query answered",
    override: "No",
    timestamp: new Date(Date.now() - 122 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Query: 'Show me PAR30 trends...'",
      confidence: "91.8%",
      processingTime: "1850ms",
      tablesAffected: "None (Read-only)",
      overrideReason: null
    }
  },
  {
    id: "LOG-011",
    agent: "A3",
    agentName: "Anomaly",
    action: "Rapid consecutive logins detected from IP 112.134.x.x for user 'kamal_m' outside office hours",
    tier: "Tier 4",
    tierBadge: "Alert Only",
    status: "Escalated",
    outcome: "IT Admin notified",
    override: "No",
    timestamp: new Date(Date.now() - 125 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Auth logs stream",
      confidence: "98.1%",
      processingTime: "45ms",
      tablesAffected: "security_alerts",
      overrideReason: null
    }
  },
  {
    id: "LOG-010",
    agent: "A2",
    agentName: "Workflow",
    action: "Leave request auto-approved: Sick leave for 1 day (Balance: 12 days)",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    outcome: "Leave approved",
    override: "No",
    timestamp: new Date(Date.now() - 130 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Leave Request #LR-992",
      confidence: "100%",
      processingTime: "75ms",
      tablesAffected: "hr_leave_ledger",
      overrideReason: null
    }
  },
  {
    id: "LOG-009",
    agent: "A1",
    agentName: "Compliance",
    action: "Anti-Money Laundering (AML) check on incoming transfer of LKR 2.5M from unknown foreign entity",
    tier: "Tier 3",
    tierBadge: "Pending Approval",
    status: "Overridden",
    outcome: "Transfer held",
    override: "Yes",
    timestamp: new Date(Date.now() - 140 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Inbound SWIFT transfer data",
      confidence: "82.5%",
      processingTime: "300ms",
      tablesAffected: "compliance_holds",
      overrideReason: "Overridden by S. Fernando, Compliance Head — Reason: Sender verified against approved NGO registry."
    }
  },
  {
    id: "LOG-008",
    agent: "A2",
    agentName: "Workflow",
    action: "System backup initiated and synced to secondary cloud storage",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    outcome: "Backup successful",
    override: "No",
    timestamp: new Date(Date.now() - 144 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Cron trigger: 02:00 AM",
      confidence: "100%",
      processingTime: "145000ms",
      tablesAffected: "system_logs",
      overrideReason: null
    }
  },
  {
    id: "LOG-007",
    agent: "A4",
    agentName: "NLQ",
    action: "NLQ query answered: \"How many new group loans were opened this month?\"",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    outcome: "Query answered",
    override: "No",
    timestamp: new Date(Date.now() - 146 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Query: 'How many new group loans...'",
      confidence: "97.2%",
      processingTime: "950ms",
      tablesAffected: "None (Read-only)",
      overrideReason: null
    }
  },
  {
    id: "LOG-006",
    agent: "A3",
    agentName: "Anomaly",
    action: "Unusual expense claim: LKR 120,000 for 'Travel' by Field Officer, 400% above historical average",
    tier: "Tier 3",
    tierBadge: "Pending Approval",
    status: "Awaiting Approval",
    outcome: "Routed for manual review",
    override: "No",
    timestamp: new Date(Date.now() - 150 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Expense Claim #EXP-441",
      confidence: "89.5%",
      processingTime: "115ms",
      tablesAffected: "expense_queue",
      overrideReason: null
    }
  },
  {
    id: "LOG-005",
    agent: "A2",
    agentName: "Workflow",
    action: "Generated monthly statements for 1,245 active loan accounts and dispatched via SMS/Email",
    tier: "Tier 2",
    tierBadge: "Notified",
    status: "Completed",
    outcome: "Statements dispatched",
    override: "No",
    timestamp: new Date(Date.now() - 160 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Billing cycle: EOM",
      confidence: "100%",
      processingTime: "45000ms",
      tablesAffected: "communications_log",
      overrideReason: null
    }
  },
  {
    id: "LOG-004",
    agent: "A1",
    agentName: "Compliance",
    action: "Audit of interest rate configurations across all products against CBSL mandated caps",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    outcome: "100% compliant",
    override: "No",
    timestamp: new Date(Date.now() - 162 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Product config table",
      confidence: "100%",
      processingTime: "250ms",
      tablesAffected: "audit_logs",
      overrideReason: null
    }
  },
  {
    id: "LOG-003",
    agent: "A3",
    agentName: "Anomaly",
    action: "High risk correlation detected: 3 borrowers in identical group missed payments simultaneously",
    tier: "Tier 4",
    tierBadge: "Alert Only",
    status: "Escalated",
    outcome: "Credit Risk Manager notified",
    override: "No",
    timestamp: new Date(Date.now() - 165 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Collections stream",
      confidence: "93.4%",
      processingTime: "185ms",
      tablesAffected: "risk_alerts",
      overrideReason: null
    }
  },
  {
    id: "LOG-002",
    agent: "A4",
    agentName: "NLQ",
    action: "NLQ query answered: \"Generate a list of all branches with OSS below 100%\"",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Failed",
    outcome: "System timeout error",
    override: "No",
    timestamp: new Date(Date.now() - 166 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Query: 'Generate a list...'",
      confidence: "45.0%",
      processingTime: "15000ms",
      tablesAffected: "error_logs",
      overrideReason: null
    }
  },
  {
    id: "LOG-001",
    agent: "A2",
    agentName: "Workflow",
    action: "Provisioning run: Calculated and posted bad debt provisions for >90 days overdue accounts",
    tier: "Tier 3",
    tierBadge: "Pending Approval",
    status: "Overridden",
    outcome: "Provisions adjusted manually",
    override: "Yes",
    timestamp: new Date(Date.now() - 168 * 60 * 60 * 1000).toISOString(),
    details: {
      inputData: "Arrears > 90 days dataset",
      confidence: "99.0%",
      processingTime: "1200ms",
      tablesAffected: "finance_journal",
      overrideReason: "Overridden by Finance Director — Reason: Board decided to write off specific accounts instead of provisioning."
    }
  }
]

// Helpers for styling
const getAgentColor = (agent) => {
  switch (agent) {
    case "A1": return "bg-purple-500"
    case "A2": return "bg-blue-500"
    case "A3": return "bg-red-500"
    case "A4": return "bg-teal-500"
    default: return "bg-muted-foreground"
  }
}

const getTierStyle = (tier) => {
  switch (tier) {
    case "Tier 1": return "bg-blue-600 text-white border-blue-500"
    case "Tier 2": return "bg-green-600 text-white border-green-500"
    case "Tier 3": return "bg-amber-400 text-slate-900 border-amber-500"
    case "Tier 4": return "bg-red-600 text-white border-red-500"
    default: return "bg-muted-foreground text-foreground border-border"
  }
}

const getAgentBorder = (agent) => {
  switch (agent) {
    case "A1": return "border-l-purple-500"
    case "A2": return "border-l-blue-500"
    case "A3": return "border-l-red-500"
    case "A4": return "border-l-teal-500"
    default: return "border-l-slate-500"
  }
}

// Format relative time (basic implementation)
const getRelativeTime = (timestamp) => {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const daysDifference = Math.round((new Date(timestamp) - new Date()) / (1000 * 60 * 60 * 24))
  const hoursDifference = Math.round((new Date(timestamp) - new Date()) / (1000 * 60 * 60))
  const minutesDifference = Math.round((new Date(timestamp) - new Date()) / (1000 * 60))
  
  if (Math.abs(minutesDifference) < 60) return `${Math.abs(minutesDifference)} mins ago`
  if (Math.abs(hoursDifference) < 24) return `${Math.abs(hoursDifference)} hours ago`
  if (Math.abs(daysDifference) === 1) return `yesterday`
  return `${Math.abs(daysDifference)} days ago`
}

export default function AgentLog() {
  const [logs] = useState(INITIAL_LOGS)
  const [search, setSearch] = useState("")
  const [agentFilter, setAgentFilter] = useState("All")
  const [tierFilter, setTierFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Stats calculation
  const stats = useMemo(() => {
    const today = new Date()
    const todayLogs = logs.filter(l => new Date(l.timestamp).getDate() === today.getDate())
    return {
      totalToday: todayLogs.length,
      awaiting: logs.filter(l => l.status === "Awaiting Approval").length,
      autoCompleted: logs.filter(l => l.status === "Completed" && l.tier === "Tier 1").length,
      overrides: logs.filter(l => l.override === "Yes").length
    }
  }, [logs])

  // Filtering
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = log.action.toLowerCase().includes(search.toLowerCase()) || 
                          log.agentName.toLowerCase().includes(search.toLowerCase()) ||
                          log.agent.toLowerCase().includes(search.toLowerCase())
      const matchAgent = agentFilter === "All" || log.agent === agentFilter
      const matchTier = tierFilter === "All" || log.tier === tierFilter
      const matchStatus = statusFilter === "All" || log.status === statusFilter
      return matchSearch && matchAgent && matchTier && matchStatus
    })
  }, [logs, search, agentFilter, tierFilter, statusFilter])

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const toggleRow = (id) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpandedRows(newSet)
  }

  const resetFilters = () => {
    setSearch("")
    setAgentFilter("All")
    setTierFilter("All")
    setStatusFilter("All")
    setCurrentPage(1)
  }

  const handleExport = () => {
    setIsExporting(true)
    setShowToast(true)
    setTimeout(() => {
      setIsExporting(false)
      setTimeout(() => setShowToast(false), 3000)
    }, 1500)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground p-6 lg:p-8 font-sans custom-scrollbar">
      
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 bg-muted border border-blue-500/30 text-foreground px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50 animate-in slide-in-from-top-5">
          <Download className="text-blue-400 animate-bounce" size={20} />
          <div className="text-sm font-medium">Exporting Agent Log...</div>
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">Agent Activity Log</h1>
          <p className="text-muted-foreground text-sm">Complete audit trail of all autonomous agent actions and decisions.</p>
        </div>
        
        <div className="relative group">
          <button 
            disabled={isExporting}
            className="flex items-center gap-2 bg-muted hover:bg-muted disabled:opacity-50 text-foreground text-sm font-medium px-4 py-2.5 rounded-lg transition-colors border border-border cursor-pointer"
          >
            {isExporting ? <Activity className="animate-pulse" size={16} /> : <Download size={16} />}
            {isExporting ? "Exporting..." : "Export"}
            <ChevronDown size={14} className="ml-1 text-muted-foreground" />
          </button>
          {!isExporting && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-muted border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
              <button onClick={handleExport} className="w-full text-left px-4 py-2.5 text-sm text-foreground/80 hover:bg-muted hover:text-foreground first:rounded-t-lg transition-colors cursor-pointer">Export as CSV</button>
              <button onClick={handleExport} className="w-full text-left px-4 py-2.5 text-sm text-foreground/80 hover:bg-muted hover:text-foreground last:rounded-b-lg transition-colors cursor-pointer">Export as PDF</button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
          <div className="text-muted-foreground text-xs font-medium mb-1">Total Actions Today</div>
          <div className="text-2xl font-bold text-foreground">{stats.totalToday}</div>
        </div>
        <div className={`bg-card border ${stats.awaiting > 0 ? 'border-amber-500/30 ring-1 ring-amber-500/20' : 'border-border'} rounded-xl p-4 shadow-sm flex flex-col transition-all`}>
          <div className="text-muted-foreground text-xs font-medium mb-1 flex items-center justify-between">
            Awaiting Approval
            {stats.awaiting > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
          </div>
          <div className={`text-2xl font-bold ${stats.awaiting > 0 ? 'text-amber-400' : 'text-foreground'}`}>{stats.awaiting}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
          <div className="text-muted-foreground text-xs font-medium mb-1">Auto-Completed</div>
          <div className="text-2xl font-bold text-green-400">{stats.autoCompleted}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
          <div className="text-muted-foreground text-xs font-medium mb-1">Human Overrides</div>
          <div className="text-2xl font-bold text-foreground">{stats.overrides}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Search actions or agents..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full bg-muted border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <div className="text-xs text-muted-foreground uppercase font-bold mr-1 shrink-0">Agent</div>
            {["All", "A1", "A2", "A3", "A4"].map(agent => (
              <button 
                key={agent}
                onClick={() => { setAgentFilter(agent); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  agentFilter === agent 
                    ? "bg-accent text-foreground" 
                    : "bg-muted text-muted-foreground hover:bg-muted border border-border"
                }`}
              >
                {agent === "All" ? "All Agents" : agent === "A1" ? "A1 (Compliance)" : agent === "A2" ? "A2 (Workflow)" : agent === "A3" ? "A3 (Anomaly)" : "A4 (NLQ)"}
              </button>
            ))}
          </div>

        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/50 pt-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <div className="text-xs text-muted-foreground uppercase font-bold mr-1 shrink-0">Tier</div>
            {["All", "Tier 1", "Tier 2", "Tier 3", "Tier 4"].map(tier => {
              const isActive = tierFilter === tier
              let activeClass = "bg-accent text-foreground"
              if (isActive && tier !== "All") {
                if (tier === "Tier 1") activeClass = "bg-blue-600 border-blue-500 text-white"
                if (tier === "Tier 2") activeClass = "bg-green-600 border-green-500 text-white"
                if (tier === "Tier 3") activeClass = "bg-amber-500 border-amber-400 text-slate-900"
                if (tier === "Tier 4") activeClass = "bg-red-600 border-red-500 text-white"
              }
              return (
                <button 
                  key={tier}
                  onClick={() => { setTierFilter(tier); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors cursor-pointer ${
                    isActive 
                      ? activeClass 
                      : "bg-muted text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {tier}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="appearance-none bg-muted border border-border text-foreground text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Awaiting Approval">Awaiting Approval</option>
              <option value="Escalated">Escalated</option>
              <option value="Overridden">Overridden</option>
              <option value="Failed">Failed</option>
            </select>

            <button 
              onClick={resetFilters}
              className="text-muted-foreground hover:text-foreground text-sm font-medium flex items-center gap-1 transition-colors cursor-pointer px-2"
            >
              <X size={16} /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-muted border-b border-border text-muted-foreground font-medium">
                <th className="p-4 pl-6">Timestamp</th>
                <th className="p-4">Agent</th>
                <th className="p-4 min-w-[300px] max-w-[500px]">Action Taken</th>
                <th className="p-4">Tier Level</th>
                <th className="p-4">Outcome</th>
                <th className="p-4 text-center">Override</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => {
                  const isAwaiting = log.status === "Awaiting Approval"
                  const isExpanded = expandedRows.has(log.id)
                  
                  return (
                    <React.Fragment key={log.id}>
                      <tr className={`
                        transition-colors group
                        ${isAwaiting ? "bg-amber-500/5" : "bg-background hover:bg-muted/40"}
                        border-l-4 ${getAgentBorder(log.agent)}
                      `}>
                        <td className="p-4 pl-5">
                          <div className="text-foreground font-medium" title={new Date(log.timestamp).toLocaleString()}>
                            {getRelativeTime(log.timestamp)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{log.id}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full ${getAgentColor(log.agent)} flex items-center justify-center text-[10px] font-bold text-foreground shadow-sm ring-2 ring-card`}>
                              {log.agent}
                            </span>
                            <span className="text-foreground/80 font-medium">{log.agentName}</span>
                          </div>
                        </td>
                        <td className="p-4 text-foreground/80 whitespace-normal min-w-[300px] max-w-[500px] leading-snug">
                          {log.action}
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-3 py-1.5 rounded text-xs font-bold border shadow-sm ${getTierStyle(log.tier)} whitespace-nowrap`}>
                            {log.tier} — {log.tierBadge}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-foreground/80">
                            {log.status === "Completed" && <CheckCircle size={14} className="text-green-400" />}
                            {log.status === "Awaiting Approval" && <Clock size={14} className="text-amber-400" />}
                            {(log.status === "Escalated" || log.status === "Failed") && <AlertTriangle size={14} className="text-red-400" />}
                            {log.status === "Overridden" && <ShieldAlert size={14} className="text-blue-400" />}
                            {log.outcome}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {log.override === "Yes" ? (
                            <div className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-xs font-semibold group/tooltip relative cursor-help">
                              Yes
                              <Info size={12} />
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-muted border border-border rounded shadow-xl text-xs text-left text-foreground opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-20 whitespace-normal">
                                {log.details.overrideReason}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs font-medium">No</span>
                          )}
                        </td>
                        <td className="p-4 text-right pr-6">
                          {isAwaiting ? (
                            <Link
                              to={`/tier-approval?action=${APPROVAL_LINKS[log.id] || "cbsl-report"}`}
                              className="inline-flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
                            >
                              Review & Approve
                            </Link>
                          ) : (
                            <button 
                              onClick={() => toggleRow(log.id)}
                              className="text-blue-400 hover:text-blue-300 text-xs font-semibold underline-offset-4 hover:underline transition-all cursor-pointer"
                            >
                              {isExpanded ? "Hide Details" : "View Details"}
                            </button>
                          )}
                        </td>
                      </tr>
                      
                      {/* Expanded Row Detail */}
                      {isExpanded && (
                        <tr className="bg-muted border-l-4 border-l-slate-800">
                          <td colSpan="7" className="p-0">
                            <div className="p-6 text-sm animate-in slide-in-from-top-2">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <div>
                                    <div className="text-muted-foreground font-medium mb-1 text-xs uppercase tracking-wider">Full Action Detail</div>
                                    <div className="text-foreground bg-background p-3 rounded-lg border border-border leading-relaxed">{log.action}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground font-medium mb-1 text-xs uppercase tracking-wider">Input Data Evaluated</div>
                                    <div className="text-foreground/80 font-mono text-xs bg-background p-3 rounded-lg border border-border">{log.details.inputData}</div>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-background p-3 rounded-lg border border-border">
                                      <div className="text-muted-foreground font-medium mb-1 text-xs uppercase tracking-wider">Confidence Score</div>
                                      <div className="text-foreground font-bold">{log.details.confidence}</div>
                                    </div>
                                    <div className="bg-background p-3 rounded-lg border border-border">
                                      <div className="text-muted-foreground font-medium mb-1 text-xs uppercase tracking-wider">Processing Time</div>
                                      <div className="text-foreground font-mono">{log.details.processingTime}</div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground font-medium mb-1 text-xs uppercase tracking-wider">Database Tables Affected</div>
                                    <div className="text-foreground/80 bg-background p-3 rounded-lg border border-border font-mono text-xs">
                                      {log.details.tablesAffected}
                                    </div>
                                  </div>
                                  {log.details.overrideReason && (
                                    <div>
                                      <div className="text-amber-500/80 font-medium mb-1 text-xs uppercase tracking-wider">Human Override Log</div>
                                      <div className="text-amber-200 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 leading-relaxed">
                                        {log.details.overrideReason}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Filter size={32} className="mb-3 opacity-50" />
                      <div className="text-base font-medium text-muted-foreground mb-1">No agent actions match your filters</div>
                      <div className="text-sm mb-4">Try adjusting your search or removing some filters.</div>
                      <button 
                        onClick={resetFilters}
                        className="bg-muted hover:bg-muted text-foreground border border-border px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {filteredLogs.length > 0 && (
          <div className="bg-muted p-4 border-t border-border flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Showing <span className="text-foreground font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-foreground font-medium">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> of <span className="text-foreground font-medium">{filteredLogs.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors cursor-pointer ${
                      currentPage === i + 1 
                        ? "bg-blue-600 text-white border-blue-500 border" 
                        : "bg-card border border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
