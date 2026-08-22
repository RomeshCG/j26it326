import React, { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { 
  LayoutDashboard, 
  Wallet, 
  Users, 
  Activity, 
  Settings,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Loader2,
  ChevronRight
} from "lucide-react"

const formatLKR = (amount) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const SIDEBAR_NAV = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Payroll", path: "/payroll", icon: Wallet },
  { name: "Agent Activity Log", path: "/agent-log", icon: Activity },
  { name: "Tier Approvals", path: "/tier-approval", icon: CheckCircle },
  { name: "Settings", path: "/settings", icon: Settings },
]

const RECENT_STAFF_ACT = [
  { id: 1, text: "Payroll processed — Dec 2024", time: "2 hours ago" },
  { id: 2, text: "2 leave requests approved", time: "5 hours ago" },
  { id: 3, text: "1 new staff added — Kandy branch", time: "1 day ago" },
]

const AGENT_ACTIONS = [
  { id: 1, agent: "A2", name: "Agent 2", action: "Payroll journal entries posted to Finance", tier: "Tier 1", tierBadge: "Auto", status: "Completed", time: "2 mins ago", color: "bg-blue-500", tierColor: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { id: 2, agent: "A3", name: "Agent 3", action: "Unusual transaction flagged: LKR 450,000 disbursement outside business hours", tier: "Tier 3", tierBadge: "Awaiting Approval", status: "Pending Approval", time: "15 mins ago", color: "bg-amber-500", tierColor: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { id: 3, agent: "A1", name: "Agent 1", action: "Central Bank monthly report compiled", tier: "Tier 3", tierBadge: "Awaiting Approval", status: "Pending Approval", time: "1 hour ago", color: "bg-purple-500", tierColor: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { id: 4, agent: "A4", name: "Agent 4", action: "NLQ query answered: \"What is PAR30 for Kandy branch?\"", tier: "Tier 1", tierBadge: "Auto", status: "Completed", time: "1 hour ago", color: "bg-green-500", tierColor: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { id: 5, agent: "A3", name: "Agent 3", action: "Duplicate payment pattern detected — Kandy branch", tier: "Tier 2", tierBadge: "Notified", status: "Escalated", time: "3 hours ago", color: "bg-amber-500", tierColor: "bg-green-500/10 text-green-400 border-green-500/20" },
  { id: 6, agent: "A1", name: "Agent 1", action: "Daily system health check completed", tier: "Tier 1", tierBadge: "Auto", status: "Completed", time: "5 hours ago", color: "bg-purple-500", tierColor: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { id: 7, agent: "A4", name: "Agent 4", action: "Generated ad-hoc report for P&L", tier: "Tier 1", tierBadge: "Auto", status: "Completed", time: "1 day ago", color: "bg-green-500", tierColor: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { id: 8, agent: "A2", name: "Agent 2", action: "Reconciled daily collection accounts", tier: "Tier 2", tierBadge: "Notified", status: "Completed", time: "1 day ago", color: "bg-blue-500", tierColor: "bg-green-500/10 text-green-400 border-green-500/20" },
]

export default function ExecutiveDashboard() {
  const location = useLocation()
  
  const [nlqInput, setNlqInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [nlqResponse, setNlqResponse] = useState(null)
  
  const handleAsk = (questionText) => {
    const q = typeof questionText === 'string' ? questionText : nlqInput
    if (!q.trim()) return
    
    setNlqInput(q)
    setIsTyping(true)
    setNlqResponse(null)
    
    setTimeout(() => {
      let answer = "Based on current data, your institution is performing within expected parameters. For detailed analysis, please view the full reports."
      const lowerQ = q.toLowerCase()
      
      if (lowerQ.includes("par30")) {
        answer = "The current PAR30 across all branches is 4.2%, which is within the healthy threshold of under 5%. The Ampara branch has the highest PAR30 at 7.8%."
      } else if (lowerQ.includes("collection")) {
        answer = "This month's collection rate is 91.3%, up from 88.7% last month. The Kandy branch leads with 94.1%."
      } else if (lowerQ.includes("epf")) {
        answer = "A total of LKR 1.2M was paid in EPF this month across all branches."
      }
      
      setNlqResponse({ question: q, answer })
      setIsTyping(false)
      setNlqInput("")
    }, 1500)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleAsk()
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="px-8 py-6 border-b border-slate-800 bg-[#0A0A0A]/80 backdrop-blur-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 z-10">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              Good morning, Jane
            </h1>
            <div className="text-slate-400 mt-1 flex items-center gap-2">
              <span>Apex Microfinance</span>
              <span className="text-slate-600">•</span>
              <span>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-full text-green-400 text-sm font-medium shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            All agents active
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          
          {/* 4 Quadrants Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* Quadrant 1: Loan Portfolio */}
            <div className="bg-[#111111] border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-slate-700 transition-colors shadow-sm">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Wallet className="text-blue-400" size={20} />
                Loan Portfolio
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">Total Active Loans</div>
                  <div className="text-xl font-bold text-white">1,247</div>
                </div>
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">Total Disbursed</div>
                  <div className="text-xl font-bold text-white">{formatLKR(48300000)}</div>
                </div>
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">PAR30</div>
                  <div className="text-xl font-bold text-green-400">4.2%</div>
                </div>
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">Collection Rate</div>
                  <div className="text-xl font-bold text-white">91.3%</div>
                </div>
              </div>
              
              <div className="mt-auto">
                <div className="text-xs text-slate-400 mb-2">Portfolio by Product</div>
                <div className="h-6 w-full flex rounded-md overflow-hidden">
                  <div className="bg-blue-500 h-full w-[45%]" title="Group Loan: 45%"></div>
                  <div className="bg-emerald-500 h-full w-[30%]" title="Individual: 30%"></div>
                  <div className="bg-amber-500 h-full w-[15%]" title="Agri: 15%"></div>
                  <div className="bg-purple-500 h-full w-[10%]" title="SME: 10%"></div>
                </div>
                <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Group</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Individual</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Agri</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> SME</div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button className="text-blue-400 text-sm font-medium hover:text-blue-300 flex items-center gap-1 transition-colors">
                  View Full Report <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Quadrant 2: Finance Snapshot */}
            <div className="bg-[#111111] border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-slate-700 transition-colors shadow-sm">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <TrendingUp className="text-emerald-400" size={20} />
                Finance — December 2024
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">P&L This Month</div>
                  <div className="text-xl font-bold text-green-400">+{formatLKR(1250000)}</div>
                </div>
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">OSS</div>
                  <div className="text-xl font-bold text-green-400">112%</div>
                </div>
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">Cash Position</div>
                  <div className="text-xl font-bold text-white">{formatLKR(8400000)}</div>
                </div>
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">Accounts Payable</div>
                  <div className="text-xl font-bold text-white">{formatLKR(410000)}</div>
                </div>
              </div>
              
              <div className="mt-auto">
                <div className="text-xs text-slate-400 mb-2">P&L Trend (Last 6 Months)</div>
                <div className="h-12 w-full flex items-end gap-1 opacity-80">
                  <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
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
                <button className="text-emerald-400 text-sm font-medium hover:text-emerald-300 flex items-center gap-1 transition-colors">
                  View P&L Report <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Quadrant 3: HR Snapshot */}
            <div className="bg-[#111111] border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-slate-700 transition-colors shadow-sm">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Users className="text-purple-400" size={20} />
                Human Resources
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">Total Headcount</div>
                  <div className="text-xl font-bold text-white">42</div>
                </div>
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">Payroll This Month</div>
                  <div className="text-xl font-bold text-white">{formatLKR(2150000)}</div>
                </div>
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50 relative">
                  <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">2</div>
                  <div className="text-slate-400 text-xs mb-1">Leave Requests</div>
                  <div className="text-xl font-bold text-amber-400">Pending</div>
                </div>
                <div className="bg-[#161616] p-4 rounded-xl border border-slate-800/50">
                  <div className="text-slate-400 text-xs mb-1">New Joiners</div>
                  <div className="text-xl font-bold text-white">1</div>
                </div>
              </div>
              
              <div className="mt-auto">
                <div className="text-xs text-slate-400 mb-3">Recent HR Activity</div>
                <div className="space-y-3">
                  {RECENT_STAFF_ACT.map(act => (
                    <div key={act.id} className="flex items-start justify-between gap-4">
                      <div className="text-sm text-slate-300">{act.text}</div>
                      <div className="text-xs text-slate-500 whitespace-nowrap">{act.time}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <Link to="/payroll" className="text-purple-400 text-sm font-medium hover:text-purple-300 flex items-center gap-1 transition-colors">
                  View Payroll <ChevronRight size={16} />
                </Link>
              </div>
            </div>

            {/* Quadrant 4: Agent Activity Feed */}
            <div className="bg-[#111111] border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-slate-700 transition-colors shadow-sm ring-1 ring-blue-500/10">
              <h2 className="text-lg font-semibold text-white flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="text-blue-400" size={20} />
                  Agent Activity
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  <span className="text-xs text-blue-400 font-medium">Live Feed</span>
                </div>
              </h2>
              
              <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4 max-h-[300px] custom-scrollbar relative">
                {/* Connecting Line */}
                <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-800 z-0"></div>
                
                {AGENT_ACTIONS.map(action => (
                  <div key={action.id} className="relative z-10 flex gap-4">
                    <div className={`w-8 h-8 rounded-full ${action.color} flex items-center justify-center text-white font-bold text-xs shrink-0 ring-4 ring-[#111111] shadow-lg`}>
                      {action.agent}
                    </div>
                    <div className="flex-1 bg-[#161616] p-3 rounded-xl border border-slate-800/50">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="text-sm font-medium text-white">{action.name}</div>
                        <div className="text-xs text-slate-500">{action.time}</div>
                      </div>
                      <div className="text-sm text-slate-300 mb-2 leading-snug">{action.action}</div>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${action.tierColor}`}>
                          {action.tier} • {action.tierBadge}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          {action.status === "Completed" && <CheckCircle size={10} className="text-green-400" />}
                          {action.status === "Pending Approval" && <Clock size={10} className="text-amber-400" />}
                          {action.status === "Escalated" && <AlertCircle size={10} className="text-red-400" />}
                          {action.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-800/50 flex justify-end">
                <Link to="/agent-log" className="text-blue-400 text-sm font-medium hover:text-blue-300 flex items-center gap-1 transition-colors">
                  View Full Agent Log <ChevronRight size={16} />
                </Link>
              </div>
            </div>

          </div>

          {/* NLQ Interface */}
          <div className="bg-[#111111] border border-blue-500/20 rounded-2xl p-6 shadow-[0_0_30px_rgba(59,130,246,0.05)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
            
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4 relative z-10">
              <span className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-white text-xs font-bold">A4</span>
              Ask MicroFlow — Agent 4
            </h2>
            
            <div className="relative z-10 mb-4 flex gap-3">
              <input 
                type="text" 
                value={nlqInput}
                onChange={(e) => setNlqInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your institution... e.g. What is the PAR30 for the Kandy branch this month?"
                className="flex-1 bg-[#161616] border border-slate-700 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm sm:text-base shadow-inner"
              />
              <button 
                onClick={() => handleAsk(nlqInput)}
                disabled={!nlqInput.trim() || isTyping}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl px-6 flex items-center justify-center transition-colors cursor-pointer shadow-lg shadow-blue-500/20 disabled:shadow-none"
              >
                <Send size={20} />
              </button>
            </div>
            
            {!nlqResponse && !isTyping && (
              <div className="flex flex-wrap gap-2 relative z-10">
                <button onClick={() => handleAsk("What is this month's collection rate?")} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer">
                  "What is this month's collection rate?"
                </button>
                <button onClick={() => handleAsk("Which branch has the highest PAR30?")} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer">
                  "Which branch has the highest PAR30?"
                </button>
                <button onClick={() => handleAsk("How much was paid in EPF this month?")} className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer">
                  "How much was paid in EPF this month?"
                </button>
              </div>
            )}
            
            {isTyping && (
              <div className="mt-4 flex items-center gap-3 text-blue-400 bg-blue-500/5 p-4 rounded-xl border border-blue-500/10 animate-in fade-in relative z-10">
                <Loader2 className="animate-spin" size={20} />
                <span className="text-sm font-medium">Agent 4 is analysing data...</span>
              </div>
            )}
            
            {nlqResponse && !isTyping && (
              <div className="mt-4 bg-[#161616] p-5 rounded-xl border border-slate-700 animate-in slide-in-from-bottom-2 relative z-10">
                <div className="text-sm text-slate-400 mb-2 italic">"{nlqResponse.question}"</div>
                <div className="text-white text-base leading-relaxed mb-4">{nlqResponse.answer}</div>
                <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                  <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold">A4</div>
                  <div className="text-xs text-slate-500">Answered by Agent 4 — NLQ Interface</div>
                  <div className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20 ml-auto">
                    Tier 1 • Auto
                  </div>
                </div>
              </div>
            )}
            
          </div>
          
        </div>
      </div>
  )
}
