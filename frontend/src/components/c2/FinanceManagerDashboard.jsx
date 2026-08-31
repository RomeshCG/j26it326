import React from "react"
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Activity,
  FileText,
  Users
} from "lucide-react"
import { Link } from "react-router-dom"

export default function FinanceManagerDashboard() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      {/* 1. PAGE HEADER */}
      <header className="z-10 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border bg-background/80 px-8 py-6 backdrop-blur-md sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
            Finance Manager Dashboard
          </h1>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <span>Mission performance and financial health overview</span>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground">
          <span>Reporting Period: Aug 2024</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
        
        {/* 2. MDI HERO SECTION */}
        <section className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Mission Drift Index
              </h2>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-bold tracking-tighter text-foreground text-emerald-600 dark:text-emerald-400">
                  72.4
                </span>
                <div className="flex items-center gap-1 pb-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <TrendingUp size={20} />
                  <span>4.8% vs last month</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 min-w-[200px]">
              <div className="flex justify-between items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
                <span className="text-sm text-foreground">Status:</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> Healthy
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-1">
                <span className="text-xs text-muted-foreground">Threshold:</span>
                <span className="text-xs font-semibold text-foreground">65</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end relative z-10 border-t border-border/50 pt-4">
             <Link
                to="/social-performance"
                className="flex items-center gap-1 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                View MDI Drivers <ChevronRight size={16} />
              </Link>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 3. MDI 6-MONTH TREND CHART */}
          <div className="lg:col-span-2 flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
              <Activity className="text-emerald-600 dark:text-emerald-400" size={20} />
              Mission Drift Index Trend
            </h2>
            <div className="flex-1 mt-4 relative min-h-[200px]">
              {/* simple SVG Chart */}
              <div className="absolute inset-0 flex items-end">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Threshold line 65 -> approx y=50 */}
                  <line x1="0" y1="65" x2="100" y2="65" stroke="currentColor" strokeWidth="0.5" className="text-border" strokeDasharray="2,2" />
                  <text x="0" y="62" className="fill-muted-foreground text-[3px]">Threshold (65)</text>
                  
                  {/* Path for MDI scores (61, 64, 67, 69, 70, 72.4) mapping roughly to y values (higher score = lower y) */}
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    points="0,85 20,70 40,55 60,45 80,40 100,28"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Data points */}
                  <circle cx="0" cy="85" r="1.5" fill="#10b981" className="bg-emerald-500" />
                  <circle cx="20" cy="70" r="1.5" fill="#10b981" />
                  <circle cx="40" cy="55" r="1.5" fill="#10b981" />
                  <circle cx="60" cy="45" r="1.5" fill="#10b981" />
                  <circle cx="80" cy="40" r="1.5" fill="#10b981" />
                  <circle cx="100" cy="28" r="1.5" fill="#10b981" />
                </svg>
              </div>
              
              {/* X Axis labels */}
              <div className="absolute -bottom-6 left-0 w-full flex justify-between text-xs text-muted-foreground uppercase">
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
              </div>
            </div>
          </div>

          {/* 6. GENAI MISSION ANALYSIS PANEL */}
          <div className="flex flex-col rounded-2xl border border-blue-500/20 bg-card p-6 shadow-sm relative overflow-hidden">
            <div className="pointer-events-none absolute top-0 -right-4 h-48 w-48 rounded-full bg-blue-500/5 blur-3xl" />
            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground relative z-10">
              <Sparkles className="text-blue-500" size={18} />
              GenAI Mission Analysis
            </h2>
            <p className="text-xs text-muted-foreground mb-4 relative z-10">
              AI-generated interpretation of current performance
            </p>
            
            <div className="relative z-10 text-sm text-foreground/90 leading-relaxed mb-6 bg-muted/30 p-4 rounded-xl border border-border/50">
              "Financial performance remains stable, while social outreach has improved compared with the previous month. However, the Poverty Proxy Score has declined for two consecutive months, which may indicate an emerging mission drift risk."
            </div>
            
            <div className="space-y-3 mb-6 relative z-10">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Key Observations</h3>
              <div className="flex items-start gap-2 text-sm text-foreground/80">
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                <span>Portfolio quality is improving</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-foreground/80">
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                <span>New-to-banking ratio is increasing</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-foreground/80">
                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <span className="text-amber-700 dark:text-amber-400 font-medium">Poverty Proxy Score requires attention</span>
              </div>
            </div>
            
            <div className="mt-auto relative z-10 pt-4 border-t border-border">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Recommended Focus</h3>
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-3 py-2 rounded-lg border border-blue-500/20">
                Review branch-level outreach to financially vulnerable borrowers.
              </div>
            </div>
          </div>
        </div>

        {/* 4. FINANCIAL HEALTH KPI SECTION */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <PieChart className="text-blue-500" size={20} />
            Financial Health
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="text-xs text-muted-foreground mb-1">PAR30</div>
              <div className="text-2xl font-semibold text-foreground mb-3">4.2%</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <TrendingDown size={14} /> <span>0.6%</span> <span className="text-muted-foreground ml-1">vs last month</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="text-xs text-muted-foreground mb-1">OSS</div>
              <div className="text-2xl font-semibold text-foreground mb-3">118%</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={14} /> <span>2.1%</span> <span className="text-muted-foreground ml-1">vs last month</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="text-xs text-muted-foreground mb-1">OER</div>
              <div className="text-2xl font-semibold text-foreground mb-3">7.8%</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <TrendingDown size={14} /> <span>0.4%</span> <span className="text-muted-foreground ml-1">vs last month</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="text-xs text-muted-foreground mb-1">Portfolio Yield</div>
              <div className="text-2xl font-semibold text-foreground mb-3">12.6%</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={14} /> <span>0.8%</span> <span className="text-muted-foreground ml-1">vs last month</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. SOCIAL IMPACT INDICATORS */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="text-purple-500" size={20} />
            Social Impact
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm relative overflow-hidden">
              <div className="text-xs text-muted-foreground mb-1">Female Borrower Ratio</div>
              <div className="text-2xl font-semibold text-foreground mb-3">62.4%</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 relative z-10">
                <TrendingUp size={14} /> <span>2.3%</span>
              </div>
              <div className="absolute right-0 bottom-0 w-24 h-12 opacity-20 pointer-events-none">
                <svg viewBox="0 0 100 40" className="w-full h-full">
                  <polyline fill="none" stroke="#10b981" strokeWidth="3" points="0,30 30,25 60,15 100,5" />
                </svg>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm relative overflow-hidden">
              <div className="text-xs text-muted-foreground mb-1">New-to-Banking Ratio</div>
              <div className="text-2xl font-semibold text-foreground mb-3">38.2%</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 relative z-10">
                <TrendingUp size={14} /> <span>1.8%</span>
              </div>
              <div className="absolute right-0 bottom-0 w-24 h-12 opacity-20 pointer-events-none">
                <svg viewBox="0 0 100 40" className="w-full h-full">
                  <polyline fill="none" stroke="#10b981" strokeWidth="3" points="0,35 40,30 70,18 100,8" />
                </svg>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm relative overflow-hidden">
              <div className="text-xs text-muted-foreground mb-1">Poverty Proxy Score</div>
              <div className="text-2xl font-semibold text-foreground mb-3">71.5</div>
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 relative z-10">
                <TrendingDown size={14} /> <span>0.2%</span>
              </div>
              <div className="absolute right-0 bottom-0 w-24 h-12 opacity-20 pointer-events-none">
                <svg viewBox="0 0 100 40" className="w-full h-full">
                   <polyline fill="none" stroke="#f59e0b" strokeWidth="3" points="0,5 30,8 70,20 100,22" />
                </svg>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm relative overflow-hidden">
              <div className="text-xs text-muted-foreground mb-1">Client Dropout Rate</div>
              <div className="text-2xl font-semibold text-foreground mb-3">4.8%</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 relative z-10">
                <TrendingDown size={14} /> <span>0.7%</span>
              </div>
              <div className="absolute right-0 bottom-0 w-24 h-12 opacity-20 pointer-events-none">
                <svg viewBox="0 0 100 40" className="w-full h-full">
                   <polyline fill="none" stroke="#10b981" strokeWidth="3" points="0,10 40,15 70,25 100,35" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 8. QUICK ACTIONS */}
        <div className="flex flex-wrap gap-3 pt-6 border-t border-border/60">
          <Link
             to="/alerts"
             className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <AlertTriangle size={16} className="text-amber-500" />
            View Mission Drift Alerts
          </Link>
          <Link
             to="/social-performance"
             className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Users size={16} className="text-purple-500" />
            View Social Performance
          </Link>
          <Link
             to="/payroll"
             className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
             <FileText size={16} className="text-blue-500" />
             View P&L Report
          </Link>
        </div>

      </div>
    </div>
  )
}
