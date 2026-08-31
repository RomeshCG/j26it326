import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Loader2,
  Send,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"

const formatLKR = (amount) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const RECENT_STAFF_ACT = [
  { id: 1, text: "Payroll processed — Dec 2024", time: "2 hours ago" },
  { id: 2, text: "2 leave requests approved", time: "5 hours ago" },
  { id: 3, text: "1 new staff added — Kandy branch", time: "1 day ago" },
]

const AGENT_ACTIONS = [
  {
    id: 1,
    agent: "A2",
    name: "Agent 2",
    action: "Payroll journal entries posted to Finance",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    time: "2 mins ago",
    color: "bg-blue-500",
    tierColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: 2,
    agent: "A3",
    name: "Agent 3",
    action:
      "Unusual transaction flagged: LKR 450,000 disbursement outside business hours",
    tier: "Tier 3",
    tierBadge: "Awaiting Approval",
    status: "Pending Approval",
    time: "15 mins ago",
    color: "bg-amber-500",
    tierColor:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  {
    id: 3,
    agent: "A1",
    name: "Agent 1",
    action: "Central Bank monthly report compiled",
    tier: "Tier 3",
    tierBadge: "Awaiting Approval",
    status: "Pending Approval",
    time: "1 hour ago",
    color: "bg-purple-500",
    tierColor:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  {
    id: 4,
    agent: "A4",
    name: "Agent 4",
    action: 'NLQ query answered: "What is PAR30 for Kandy branch?"',
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    time: "1 hour ago",
    color: "bg-green-500",
    tierColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: 5,
    agent: "A3",
    name: "Agent 3",
    action: "Duplicate payment pattern detected — Kandy branch",
    tier: "Tier 2",
    tierBadge: "Notified",
    status: "Escalated",
    time: "3 hours ago",
    color: "bg-amber-500",
    tierColor:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  },
  {
    id: 6,
    agent: "A1",
    name: "Agent 1",
    action: "Daily system health check completed",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    time: "5 hours ago",
    color: "bg-purple-500",
    tierColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: 7,
    agent: "A4",
    name: "Agent 4",
    action: "Generated ad-hoc report for P&L",
    tier: "Tier 1",
    tierBadge: "Auto",
    status: "Completed",
    time: "1 day ago",
    color: "bg-green-500",
    tierColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: 8,
    agent: "A2",
    name: "Agent 2",
    action: "Reconciled daily collection accounts",
    tier: "Tier 2",
    tierBadge: "Notified",
    status: "Completed",
    time: "1 day ago",
    color: "bg-blue-500",
    tierColor:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  },
]

export default function ExecutiveDashboard() {
  const [nlqInput, setNlqInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [nlqResponse, setNlqResponse] = useState(null)

  const handleAsk = (questionText) => {
    const q = typeof questionText === "string" ? questionText : nlqInput
    if (!q.trim()) return

    setNlqInput(q)
    setIsTyping(true)
    setNlqResponse(null)

    setTimeout(() => {
      let answer =
        "Based on current data, your institution is performing within expected parameters. For detailed analysis, please view the full reports."
      const lowerQ = q.toLowerCase()

      if (lowerQ.includes("par30")) {
        answer =
          "The current PAR30 across all branches is 4.2%, which is within the healthy threshold of under 5%. The Ampara branch has the highest PAR30 at 7.8%."
      } else if (lowerQ.includes("collection")) {
        answer =
          "This month's collection rate is 91.3%, up from 88.7% last month. The Kandy branch leads with 94.1%."
      } else if (lowerQ.includes("epf")) {
        answer =
          "A total of LKR 1.2M was paid in EPF this month across all branches."
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
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="z-10 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border bg-background/80 px-8 py-6 backdrop-blur-md sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
            Good morning, Jane
          </h1>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <span>Apex Microfinance</span>
            <span className="text-muted-foreground/60">•</span>
            <span>
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400">
          <span className="size-2 animate-pulse rounded-full bg-green-500" />
          All agents active
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-border">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
              <Wallet className="text-blue-600 dark:text-blue-400" size={20} />
              Loan Portfolio
            </h2>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Total Active Loans
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  1,247
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Total Disbursed
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  {formatLKR(48300000)}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">PAR30</div>
                <div className="text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">
                  4.2%
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Collection Rate
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  91.3%
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="mb-2 text-xs text-muted-foreground">
                Portfolio by Product
              </div>
              <div className="flex h-6 w-full overflow-hidden rounded-md">
                <div className="h-full w-[45%] bg-blue-500" title="Group Loan: 45%" />
                <div className="h-full w-[30%] bg-emerald-500" title="Individual: 30%" />
                <div className="h-full w-[15%] bg-amber-500" title="Agri: 15%" />
                <div className="h-full w-[10%] bg-purple-500" title="SME: 10%" />
              </div>
              <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-blue-500" /> Group
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500" /> Individual
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-amber-500" /> Agri
                </div>
                <div className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-purple-500" /> SME
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View Full Report <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
              <TrendingUp
                className="text-emerald-600 dark:text-emerald-400"
                size={20}
              />
              Finance — December 2024
            </h2>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  P&L This Month
                </div>
                <div className="text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">
                  +{formatLKR(1250000)}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">OSS</div>
                <div className="text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">
                  112%
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Cash Position
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  {formatLKR(8400000)}
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Accounts Payable
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  {formatLKR(410000)}
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="mb-2 text-xs text-muted-foreground">
                P&L Trend (Last 6 Months)
              </div>
              <div className="flex h-12 w-full items-end gap-1 opacity-80">
                <svg
                  className="h-full w-full"
                  viewBox="0 0 100 30"
                  preserveAspectRatio="none"
                >
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
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                View P&L Report <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
              <Users className="text-purple-600 dark:text-purple-400" size={20} />
              Human Resources
            </h2>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Total Headcount
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  42
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  Payroll This Month
                </div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  {formatLKR(2150000)}
                </div>
              </div>
              <div className="relative rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="absolute -top-2 -right-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
                  2
                </div>
                <div className="mb-1 text-xs text-muted-foreground">
                  Leave Requests
                </div>
                <div className="text-xl font-semibold text-amber-600 dark:text-amber-400">
                  Pending
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/50 p-4">
                <div className="mb-1 text-xs text-muted-foreground">New Joiners</div>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  1
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="mb-3 text-xs text-muted-foreground">
                Recent HR Activity
              </div>
              <div className="space-y-3">
                {RECENT_STAFF_ACT.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-4"
                  >
                    <div className="text-sm text-foreground/80">{act.text}</div>
                    <div className="whitespace-nowrap text-xs text-muted-foreground">
                      {act.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Link
                to="/payroll"
                className="flex items-center gap-1 text-sm font-medium text-purple-600 transition-colors hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
              >
                View Payroll <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm ring-1 ring-blue-500/10 transition-colors">
            <h2 className="mb-4 flex items-center justify-between text-base font-semibold text-foreground">
              <div className="flex items-center gap-2">
                <Activity className="text-blue-600 dark:text-blue-400" size={20} />
                Agent Activity
              </div>
              <div className="flex items-center gap-1">
                <span className="size-2 animate-pulse rounded-full bg-blue-500" />
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Live Feed
                </span>
              </div>
            </h2>

            <div className="relative -mr-2 max-h-[300px] flex-1 space-y-4 overflow-y-auto pr-2">
              <div className="absolute top-4 bottom-4 left-[15px] z-0 w-px bg-border" />

              {AGENT_ACTIONS.map((action) => (
                <div key={action.id} className="relative z-10 flex gap-4">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${action.color} text-xs font-bold text-foreground shadow-lg ring-4 ring-card`}
                  >
                    {action.agent}
                  </div>
                  <div className="flex-1 rounded-xl border border-border/60 bg-muted/50 p-3">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">
                        {action.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {action.time}
                      </div>
                    </div>
                    <div className="mb-2 text-sm leading-snug text-foreground/80">
                      {action.action}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${action.tierColor}`}
                      >
                        {action.tier} • {action.tierBadge}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {action.status === "Completed" && (
                          <CheckCircle
                            size={10}
                            className="text-green-600 dark:text-green-400"
                          />
                        )}
                        {action.status === "Pending Approval" && (
                          <Clock
                            size={10}
                            className="text-amber-600 dark:text-amber-400"
                          />
                        )}
                        {action.status === "Escalated" && (
                          <AlertCircle
                            size={10}
                            className="text-red-600 dark:text-red-400"
                          />
                        )}
                        {action.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end border-t border-border/60 pt-4">
              <Link
                to="/agent-log"
                className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View Full Agent Log <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-card p-6 shadow-sm">
          <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-3xl" />

          <h2 className="relative z-10 mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
            <span className="flex size-6 items-center justify-center rounded bg-blue-500 text-xs font-bold text-white">
              A4
            </span>
            Ask MicroFlow — Agent 4
          </h2>

          <div className="relative z-10 mb-4 flex gap-3">
            <input
              type="text"
              value={nlqInput}
              onChange={(e) => setNlqInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your institution... e.g. What is the PAR30 for the Kandy branch this month?"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-4 text-sm text-foreground shadow-inner transition-all placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none sm:text-base"
            />
            <button
              type="button"
              onClick={() => handleAsk(nlqInput)}
              disabled={!nlqInput.trim() || isTyping}
              className="flex items-center justify-center rounded-xl bg-primary px-6 text-primary-foreground transition-colors hover:bg-primary/80 disabled:bg-muted disabled:text-muted-foreground"
            >
              <Send size={20} />
            </button>
          </div>

          {!nlqResponse && !isTyping && (
            <div className="relative z-10 flex flex-wrap gap-2">
              {[
                "What is this month's collection rate?",
                "Which branch has the highest PAR30?",
                "How much was paid in EPF this month?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleAsk(suggestion)}
                  className="cursor-pointer rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-muted"
                >
                  &quot;{suggestion}&quot;
                </button>
              ))}
            </div>
          )}

          {isTyping && (
            <div className="relative z-10 mt-4 flex animate-in fade-in items-center gap-3 rounded-xl border border-blue-500/10 bg-blue-500/5 p-4 text-blue-600 dark:text-blue-400">
              <Loader2 className="animate-spin" size={20} />
              <span className="text-sm font-medium">
                Agent 4 is analysing data...
              </span>
            </div>
          )}

          {nlqResponse && !isTyping && (
            <div className="relative z-10 mt-4 animate-in slide-in-from-bottom-2 rounded-xl border border-border bg-muted/50 p-5">
              <div className="mb-2 text-sm text-muted-foreground italic">
                &quot;{nlqResponse.question}&quot;
              </div>
              <div className="mb-4 text-base leading-relaxed text-foreground">
                {nlqResponse.answer}
              </div>
              <div className="flex items-center gap-2 border-t border-border pt-3">
                <div className="flex size-5 items-center justify-center rounded bg-blue-500 text-[10px] font-bold text-white">
                  A4
                </div>
                <div className="text-xs text-muted-foreground">
                  Answered by Agent 4 — NLQ Interface
                </div>
                <div className="ml-auto rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
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
