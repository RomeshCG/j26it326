import { Building2, Users, FileText, CheckCircle2, ShieldAlert } from "lucide-react"
import { useStore } from "@/store"

export default function BranchManagerDashboard() {
  const currentUser = useStore((state) => state.currentUser)
  const branchName = localStorage.getItem("mf_auth_branch") || currentUser?.branch || "Head Office"

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Role: Branch Manager
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs font-medium text-muted-foreground">{branchName}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Branch Operations Hub</h1>
          <p className="text-xs text-muted-foreground">
            Operational oversight, officer management, and portfolio performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-xs">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="font-semibold">{branchName}</span>
          </div>
        </div>
      </div>

      {/* Notice Card */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-foreground">Branch Manager Workspace (M4 Graduated Trust)</p>
          <p className="text-muted-foreground leading-relaxed">
            Authenticated via backend JWT RBAC. Dedicated branch management workflows, tier escalations, and officer assignment modules are scheduled for Phase 7 implementation. All metrics below are placeholder data.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards (Clearly Labelled Placeholder Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Assigned Officers</span>
            <Users className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">8</span>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">(Placeholder)</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Active in branch portfolio</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Loans</span>
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">142</span>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">(Placeholder)</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Disbursed and monitored</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Pending Approvals</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">3</span>
            <span className="text-[10px] text-amber-500 uppercase font-semibold">(Placeholder)</span>
          </div>
          <div className="text-[11px] text-amber-500 font-medium">Tier-2 referrals</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Branch Repayment</span>
            <Building2 className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">98.4%</span>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">(Placeholder)</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Current monthly cycle</div>
        </div>
      </div>
    </div>
  )
}
