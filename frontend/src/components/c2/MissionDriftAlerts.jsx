import React, { useState } from "react"
import {
    TrendingDown,
    TrendingUp,
    AlertTriangle,
    Sparkles,
    CheckCircle2,
    Clock,
    ChevronDown,
    X,
    RefreshCw,
    ShieldAlert,
} from "lucide-react"

// ─────────────────────────────────────────────
// MOCK DATA  (replace with API responses later)
// ─────────────────────────────────────────────
const currentAlert = {
    mdi: 48.6,
    threshold: 60.0,
    change: -8.7,
    status: "Mission Drift Detected",
    date: "August 2026",
}

const contributors = [
    {
        name: "Poverty Proxy Score",
        current: 64.8,
        previous: 70.7,
        change: -8.3,
        impact: "High",
        unit: "",
        contributionPct: 92,
    },
    {
        name: "Client Dropout Rate",
        current: 6.1,
        previous: 5.4,
        change: 13.0,
        impact: "High",
        unit: "%",
        contributionPct: 80,
    },
    {
        name: "Female Borrower Ratio",
        current: 58.9,
        previous: 61.2,
        change: -3.8,
        impact: "Medium",
        unit: "%",
        contributionPct: 52,
    },
    {
        name: "New-to-Banking Ratio",
        current: 34.5,
        previous: 36.1,
        change: -4.4,
        impact: "Medium",
        unit: "%",
        contributionPct: 44,
    },
    {
        name: "PAR30",
        current: 5.6,
        previous: 4.9,
        change: 14.3,
        impact: "Low",
        unit: "%",
        contributionPct: 24,
    },
]

const alertHistory = [
    {
        date: "August 2026",
        mdi: 48.6,
        trigger: "Poverty Proxy + Dropout Rate",
        severity: "High",
        action: "Branch outreach review",
        status: "Open",
    },
    {
        date: "July 2026",
        mdi: 55.2,
        trigger: "Client Dropout Rate",
        severity: "Medium",
        action: "Retention strategy review",
        status: "Resolved",
    },
    {
        date: "May 2026",
        mdi: 58.7,
        trigger: "Female Borrower Ratio",
        severity: "Medium",
        action: "Community outreach campaign",
        status: "Resolved",
    },
    {
        date: "March 2026",
        mdi: 59.4,
        trigger: "New-to-Banking Ratio",
        severity: "Low",
        action: "Branch acquisition review",
        status: "Resolved",
    },
]

// ─────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────
function ImpactBadge({ impact }) {
    const styles = {
        High: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
        Medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        Low: "bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/25",
    }
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[impact] || ""}`}
        >
            {impact}
        </span>
    )
}

function StatusBadge({ status }) {
    const styles = {
        Open: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        "In Progress": "bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/25",
        Resolved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    }
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] || ""}`}
        >
            {status}
        </span>
    )
}

function SeverityBadge({ severity }) {
    const styles = {
        High: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
        Medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        Low: "bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/25",
    }
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[severity] || ""}`}
        >
            {severity}
        </span>
    )
}

// ─────────────────────────────────────────────
// ALERT DETAIL MODAL
// ─────────────────────────────────────────────
function AlertDetailModal({ onClose }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-y-auto max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="text-amber-500" size={20} />
                        <h2 className="text-base font-semibold text-foreground">Alert Details — August 2026</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* MDI vs Threshold */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                            <div className="text-xs text-muted-foreground mb-1">Current MDI</div>
                            <div className="text-3xl font-bold text-amber-500">{currentAlert.mdi}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                            <div className="text-xs text-muted-foreground mb-1">Threshold</div>
                            <div className="text-3xl font-bold text-foreground">{currentAlert.threshold}</div>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                            <div className="text-xs text-muted-foreground mb-1">Monthly Change</div>
                            <div className="text-3xl font-bold text-red-500">{currentAlert.change}%</div>
                        </div>
                    </div>

                    {/* Triggering Indicators */}
                    <div>
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">Triggering Indicators</h3>
                        <div className="space-y-3">
                            {contributors.map((c) => (
                                <div key={c.name} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-2.5">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-foreground">{c.name}</span>
                                        <ImpactBadge impact={c.impact} />
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-muted-foreground">{c.previous}{c.unit} → <span className="font-semibold text-foreground">{c.current}{c.unit}</span></span>
                                        <span className={`flex items-center gap-1 font-semibold ${c.change < 0 ? "text-red-500" : "text-amber-500"}`}>
                                            {c.change < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                                            {Math.abs(c.change)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* GenAI Recommendation */}
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="text-blue-500" size={16} />
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">GenAI Recommendation</h3>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                            Priority should be given to reviewing branch-level outreach and retention strategies for financially vulnerable borrowers. Monitor corrective actions closely.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="rounded-full border border-border bg-muted/50 px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────
export default function MissionDriftAlerts() {
    const [period, setPeriod] = useState("August 2026")
    const [showModal, setShowModal] = useState(false)
    const [reviewed, setReviewed] = useState(false)

    // Compute threshold fill percentage for the scale bar
    const mdiPct = Math.min(100, (currentAlert.mdi / 100) * 100)
    const thresholdPct = Math.min(100, (currentAlert.threshold / 100) * 100)

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
            {/* ── PAGE HEADER ── */}
            <header className="z-10 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border bg-background/80 px-8 py-6 backdrop-blur-md sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                        Mission Drift Alerts
                    </h1>
                    <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                        <span>Monitor MDI threshold breaches and identify the indicators driving mission drift.</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground">
                        <ChevronDown size={14} className="text-muted-foreground" />
                        <select
                            className="bg-transparent border-none outline-none text-sm font-medium text-foreground cursor-pointer"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            aria-label="reporting-period-selector"
                        >
                            <option>August 2026</option>
                            <option>July 2026</option>
                            <option>June 2026</option>
                        </select>
                    </div>
                    <button
                        className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        title="Refresh"
                        aria-label="refresh-alerts"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">

                {/* ── CURRENT ALERT / HERO ── */}
                <section className="flex flex-col rounded-2xl border border-amber-500/30 bg-card p-6 shadow-sm overflow-hidden relative">
                    {/* Ambient glow */}
                    <div className="pointer-events-none absolute top-0 right-0 h-72 w-72 translate-x-1/3 -translate-y-1/3 rounded-full bg-amber-500/10 blur-3xl" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 -translate-x-1/3 translate-y-1/3 rounded-full bg-red-500/8 blur-3xl" />

                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        {/* Left — status + MDI */}
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                <AlertTriangle size={13} />
                                {currentAlert.status}
                            </div>
                            <div className="flex items-end gap-3">
                                <span className="text-6xl font-bold tracking-tighter text-amber-500">
                                    {currentAlert.mdi}
                                </span>
                                <div className="pb-2 flex flex-col gap-0.5">
                                    <span className="text-sm text-muted-foreground font-medium">MDI Score</span>
                                    <span className="flex items-center gap-1 text-sm font-medium text-red-500">
                                        <TrendingDown size={16} />
                                        {Math.abs(currentAlert.change)}% vs previous month
                                    </span>
                                </div>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                Alert Date: {currentAlert.date}
                            </div>
                        </div>

                        {/* Right — MDI vs Threshold cards */}
                        <div className="flex gap-3 flex-wrap">
                            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-center min-w-[100px]">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Current MDI</div>
                                <div className="text-3xl font-bold text-amber-500">{currentAlert.mdi}</div>
                                <div className="mt-1 text-[10px] text-red-500 font-semibold uppercase tracking-wide">Below Threshold</div>
                            </div>
                            <div className="flex items-center text-muted-foreground text-sm font-medium px-1">vs</div>
                            <div className="rounded-xl border border-border bg-muted/30 px-5 py-4 text-center min-w-[100px]">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Threshold</div>
                                <div className="text-3xl font-bold text-foreground">{currentAlert.threshold}</div>
                                <div className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wide">Required Min</div>
                            </div>
                        </div>
                    </div>

                    {/* ── MDI THRESHOLD VISUALIZATION ── */}
                    <div className="relative z-10 mt-8 space-y-2">
                        <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                            <span>Healthy Zone</span>
                            <span>Watch Zone</span>
                            <span>Drift Zone</span>
                        </div>

                        {/* Background zones */}
                        <div className="relative h-3 w-full rounded-full overflow-hidden flex">
                            <div className="h-full bg-emerald-500/20 flex-[40]" />
                            <div className="h-full bg-amber-500/20 flex-[25]" />
                            <div className="h-full bg-red-500/20 flex-[35]" />
                        </div>

                        {/* Progress bar */}
                        <div className="relative h-2 w-full rounded-full bg-muted/40 -mt-1">
                            <div
                                className="absolute left-0 top-0 h-full rounded-full bg-amber-500"
                                style={{ width: `${mdiPct}%` }}
                            />
                            {/* Threshold marker */}
                            <div
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                                style={{ left: `${thresholdPct}%` }}
                            >
                                <div className="w-0.5 h-5 bg-foreground/50 -mt-4" />
                            </div>
                        </div>

                        {/* Labels */}
                        <div className="relative h-5 w-full text-xs">
                            <span
                                className="absolute -translate-x-1/2 text-amber-500 font-semibold"
                                style={{ left: `${mdiPct}%` }}
                            >
                                {currentAlert.mdi}
                            </span>
                            <span
                                className="absolute -translate-x-1/2 text-muted-foreground"
                                style={{ left: `${thresholdPct}%` }}
                            >
                                {currentAlert.threshold} (threshold)
                            </span>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="relative z-10 mt-6 flex items-center gap-3 border-t border-border/50 pt-4">
                        <button
                            id="view-alert-details-btn"
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-600 active:scale-[0.98]"
                        >
                            <AlertTriangle size={15} />
                            View Alert Details
                        </button>
                        <button
                            id="mark-as-reviewed-btn"
                            onClick={() => setReviewed(true)}
                            disabled={reviewed}
                            className={`flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium transition-colors ${reviewed ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 cursor-default" : "bg-card text-foreground hover:bg-muted"}`}
                        >
                            <CheckCircle2 size={15} className={reviewed ? "text-emerald-500" : ""} />
                            {reviewed ? "Marked as Reviewed" : "Mark as Reviewed"}
                        </button>
                    </div>
                </section>

                {/* ── DRIFT CONTRIBUTORS SECTION ── */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <AlertTriangle className="text-amber-500" size={20} />
                            Drift Contributors
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Indicators contributing to the current mission drift alert
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {contributors.map((c) => {
                            const isNegative = c.change < 0
                            const isWorsening =
                                (c.name === "Client Dropout Rate" || c.name === "PAR30") ? !isNegative : isNegative
                            return (
                                <div
                                    key={c.name}
                                    className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3"
                                >
                                    {/* Name + Impact */}
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-sm font-semibold text-foreground leading-tight">{c.name}</span>
                                        <ImpactBadge impact={c.impact} />
                                    </div>

                                    {/* Values */}
                                    <div className="flex items-end gap-2">
                                        <span className="text-2xl font-bold text-foreground">
                                            {c.current}{c.unit}
                                        </span>
                                        <span className="pb-0.5 text-xs text-muted-foreground">
                                            prev: {c.previous}{c.unit}
                                        </span>
                                    </div>

                                    {/* Change badge */}
                                    <div className={`flex items-center gap-1 text-sm font-semibold ${isWorsening ? "text-red-500" : "text-emerald-500"}`}>
                                        {isWorsening ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
                                        {isNegative ? "↓" : "↑"} {Math.abs(c.change)}%
                                    </div>

                                    {/* Contribution bar */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
                                            <span>Drift Contribution</span>
                                            <span>{c.contributionPct}%</span>
                                        </div>
                                        <div className="h-1.5 w-full rounded-full bg-muted/40">
                                            <div
                                                className={`h-full rounded-full ${c.impact === "High" ? "bg-red-500" : c.impact === "Medium" ? "bg-amber-500" : "bg-blue-500"}`}
                                                style={{ width: `${c.contributionPct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* ── CONTRIBUTION / IMPACT VISUALIZATION ── */}
                <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                    <div>
                        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                            Drift Contribution Overview
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Relative contribution of each indicator to the current mission drift alert
                        </p>
                    </div>

                    <div className="space-y-3">
                        {contributors.map((c) => (
                            <div key={c.name} className="flex items-center gap-4">
                                <span className="w-44 shrink-0 text-sm text-foreground font-medium truncate">{c.name}</span>
                                <div className="flex-1 h-2 rounded-full bg-muted/40">
                                    <div
                                        className={`h-full rounded-full transition-all ${c.impact === "High" ? "bg-red-500" : c.impact === "Medium" ? "bg-amber-500" : "bg-blue-500"}`}
                                        style={{ width: `${c.contributionPct}%` }}
                                    />
                                </div>
                                <ImpactBadge impact={c.impact} />
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── GENAI RECOMMENDED ACTION ── */}
                <section className="rounded-2xl border border-blue-500/20 bg-card p-6 shadow-sm relative overflow-hidden">
                    <div className="pointer-events-none absolute top-0 -right-4 h-48 w-48 rounded-full bg-blue-500/5 blur-3xl" />

                    <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground relative z-10">
                        <Sparkles className="text-blue-500" size={18} />
                        GenAI Recommended Action
                    </h2>
                    <p className="text-xs text-muted-foreground mb-5 relative z-10">
                        AI-generated recommendation based on current MDI drivers
                    </p>

                    {/* Narrative */}
                    <div className="relative z-10 text-sm text-foreground/90 leading-relaxed mb-6 bg-muted/30 p-4 rounded-xl border border-border/50">
                        "Mission drift appears to be primarily associated with declining poverty outreach and increasing client dropout. Priority should be given to reviewing branch-level outreach and retention strategies for financially vulnerable borrowers."
                    </div>

                    {/* Recommended Actions list */}
                    <div className="relative z-10 space-y-3 mb-6">
                        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Recommended Actions</h3>
                        {[
                            "Review branches with declining Poverty Proxy Scores.",
                            "Investigate reasons for increased client dropout.",
                            "Prioritize outreach to financially vulnerable borrowers.",
                            "Monitor the MDI again after corrective actions.",
                        ].map((action, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                                <CheckCircle2 className="text-blue-500 shrink-0 mt-0.5" size={16} />
                                <span>{action}</span>
                            </div>
                        ))}
                    </div>

                    <div className="relative z-10 mt-auto pt-4 border-t border-border">
                        <span className="text-xs text-muted-foreground italic">Generated from current MDI indicators</span>
                    </div>
                </section>

                {/* ── ALERT HISTORY ── */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <Clock size={20} className="text-muted-foreground" />
                            Alert History
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Previous mission drift alerts and recorded management actions
                        </p>
                    </div>

                    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-x-auto">
                        <table className="w-full text-sm" aria-label="alert-history-table">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">MDI</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trigger</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Severity</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action Taken</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {alertHistory.map((row, i) => (
                                    <tr
                                        key={i}
                                        className={`transition-colors hover:bg-muted/30 ${i === 0 ? "bg-amber-500/5" : ""}`}
                                    >
                                        <td className="px-5 py-4 font-medium text-foreground whitespace-nowrap">{row.date}</td>
                                        <td className="px-5 py-4">
                                            <span className={`font-bold ${row.mdi < 60 ? "text-amber-500" : "text-foreground"}`}>{row.mdi}</span>
                                        </td>
                                        <td className="px-5 py-4 text-muted-foreground">{row.trigger}</td>
                                        <td className="px-5 py-4"><SeverityBadge severity={row.severity} /></td>
                                        <td className="px-5 py-4 text-muted-foreground">{row.action}</td>
                                        <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

            </div>

            {/* ── MODAL ── */}
            {showModal && <AlertDetailModal onClose={() => setShowModal(false)} />}
        </div>
    )
}
