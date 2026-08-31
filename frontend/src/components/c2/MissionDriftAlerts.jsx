import React from "react"
import {
    TrendingDown,
    AlertTriangle,
    Sparkles,
} from "lucide-react"

export default function MissionDriftAlerts() {
    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
            {/* ── 1. PAGE HEADER ── */}
            <header className="z-10 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border bg-background/80 px-8 py-6 backdrop-blur-md sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                        Mission Drift Alert
                    </h1>
                    <div className="mt-1 text-sm text-muted-foreground">
                        Monitor, explain and respond to changes in social performance.
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                        <AlertTriangle size={14} />
                        CRITICAL DRIFT DETECTED
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">

                {/* ── 2. MAIN MISSION DRIFT STATUS ── */}
                <section className="rounded-2xl border border-red-500/20 bg-card p-6 md:p-8 shadow-sm relative overflow-hidden">
                    {/* Subtle red ambient glow */}
                    <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-red-500/5 blur-3xl -z-10" />

                    <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                        <div className="flex-1">
                            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                                Mission Drift Index
                            </div>
                            <div className="flex items-end gap-3 mb-2 flex-wrap">
                                <span className="text-6xl sm:text-7xl font-bold tracking-tighter text-red-500">
                                    −18.4%
                                </span>
                                <div className="pb-2">
                                    <div className="flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                                        Critical Drift Detected
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-foreground/80 max-w-xl mt-4 leading-relaxed font-medium">
                                Social performance has declined beyond the institution's defined tolerance threshold over the last three months.
                            </p>
                        </div>

                        <div className="flex flex-row md:flex-col justify-start md:justify-center gap-8 md:gap-4 md:border-l border-border/50 md:pl-8 min-w-[200px]">
                            <div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                                    Threshold
                                </div>
                                <div className="text-lg font-bold text-foreground">−10.0%</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                                    3-Month Trend
                                </div>
                                <div className="flex items-center gap-1.5 text-red-500 font-semibold text-sm">
                                    <TrendingDown size={16} strokeWidth={2.5} />
                                    <span>Declining</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── 3. WHAT CHANGED? ── */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            WHAT CHANGED?
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Key social indicators contributing to the current mission drift.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                        {[
                            { name: "Female Borrower Ratio", current: "58.2%", change: "↓ 4.8%", status: "At Risk", statusColor: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
                            { name: "New-to-Banking Ratio", current: "31.4%", change: "↓ 6.2%", status: "Critical", statusColor: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
                            { name: "Poverty Proxy Score", current: "42.7", change: "↓ 8.1%", status: "Critical", statusColor: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
                            { name: "Client Dropout Rate", current: "12.6%", change: "↑ 3.9%", status: "Warning", statusColor: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
                            { name: "Average Loan Size", current: "LKR 84K", change: "↑ 14.2%", status: "Monitor", statusColor: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" }
                        ].map(ind => (
                            <div key={ind.name} className="flex flex-col rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="text-xs font-semibold text-muted-foreground leading-tight mb-3 flex-1">{ind.name}</div>
                                <div className="text-2xl font-bold text-foreground mb-1.5">{ind.current}</div>
                                <div className="flex items-center justify-between text-xs font-semibold">
                                    <span className="text-foreground/80">{ind.change}</span>
                                    <span className={`px-2 py-0.5 rounded border uppercase tracking-wider text-[10px] ${ind.statusColor} ${ind.bg} ${ind.border}`}>
                                        {ind.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch pt-2">

                    {/* ── 4. PRIMARY DRIVERS OF MISSION DRIFT ── */}
                    <section className="space-y-4 lg:col-span-3 flex flex-col">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">
                                PRIMARY DRIVERS OF MISSION DRIFT
                            </h2>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Indicators with the strongest influence on the current drift.
                            </p>
                        </div>
                        <div className="flex-1 rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
                            {[
                                { rank: "01", name: "New-to-Banking Ratio", change: "−6.2%", impact: "HIGH IMPACT", width: "90%", color: "bg-red-500" },
                                { rank: "02", name: "Poverty Outreach", change: "−8.1%", impact: "HIGH IMPACT", width: "85%", color: "bg-red-500" },
                                { rank: "03", name: "Female Borrower Ratio", change: "−4.8%", impact: "MEDIUM IMPACT", width: "50%", color: "bg-amber-500" },
                            ].map(driver => (
                                <div key={driver.rank} className="flex items-start gap-4">
                                    <div className="text-sm font-bold text-muted-foreground w-6 shrink-0 mt-0.5">{driver.rank}</div>
                                    <div className="flex-1 pt-0.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold text-foreground">{driver.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-foreground">{driver.change}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{driver.impact}</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-muted/30 h-1.5 rounded-full overflow-hidden">
                                            <div className={`h-full ${driver.color} rounded-full transition-all`} style={{ width: driver.width }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── 5. AI MISSION INSIGHT ── */}
                    <section className="space-y-4 lg:col-span-2 flex flex-col">
                        <div className="hidden lg:block lg:invisible">
                            <h2 className="text-lg font-semibold h-7">Spacer</h2>
                            <p className="text-sm mt-0.5">Spacer</p>
                        </div>
                        <div className="flex-1 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 shadow-sm relative overflow-hidden flex flex-col">
                            <div className="pointer-events-none absolute top-0 -right-8 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl -z-10" />

                            <div className="flex items-center justify-between gap-2 mb-5 relative z-10">
                                <h2 className="text-sm font-bold text-foreground flex items-center gap-2 tracking-wide">
                                    <Sparkles className="text-blue-500" size={16} />
                                    ✦ AI MISSION INSIGHT
                                </h2>
                                <span className="inline-flex rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    GENAI ANALYSIS
                                </span>
                            </div>

                            <p className="text-sm text-foreground/90 leading-relaxed relative z-10 mb-6 flex-1 font-medium">
                                "Mission drift is primarily driven by declining outreach to new-to-banking and low-income borrowers. Although the financial portfolio remains relatively stable, social outreach indicators have weakened consistently during the recent monitoring period."
                            </p>

                            <div className="relative z-10 mt-auto pt-5 border-t border-blue-500/10">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Recommended Focus</h3>
                                <ul className="space-y-2.5">
                                    {[
                                        "Increase new-to-banking borrower acquisition",
                                        "Review targeting of low-income borrower segments",
                                        "Strengthen female borrower outreach initiatives"
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/90 font-medium">
                                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </section>
                </div>

                {/* ── 6. CORRECTIVE ACTION PLAN ── */}
                <section className="space-y-4 pt-2">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            CORRECTIVE ACTION PLAN
                        </h2>
                    </div>

                    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/70 bg-muted/20">
                                    <th className="px-6 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Priority</th>
                                    <th className="px-6 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Recommended Action</th>
                                    <th className="px-6 py-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Expected Impact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {[
                                    { priority: "HIGH", action: "Increase new-to-banking outreach", impactLabel: "Improve social inclusion", pColor: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20" },
                                    { priority: "HIGH", action: "Review low-income borrower targeting", impactLabel: "Improve poverty outreach", pColor: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20" },
                                    { priority: "MEDIUM", action: "Strengthen female borrower campaigns", impactLabel: "Improve gender inclusion", pColor: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20" },
                                ].map((row, i) => (
                                    <tr key={i} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${row.pColor}`}>
                                                {row.priority}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-foreground whitespace-nowrap">
                                            {row.action}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground font-medium whitespace-nowrap">
                                            {row.impactLabel}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* ── 7. BOTTOM METADATA STRIP ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 mt-6 border-t border-border/50">
                    {[
                        { label: "Report Period", value: "01 Jun – 31 Aug 2026" },
                        { label: "Currency", value: "LKR" },
                        { label: "Branch", value: "All Branches" },
                        { label: "Transaction Count", value: "24,856" },
                    ].map(item => (
                        <div
                            key={item.label}
                            className="rounded-xl border border-border/50 bg-muted/20 px-5 py-3.5"
                        >
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                                {item.label}
                            </div>
                            <div className="text-sm font-semibold text-foreground">{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
