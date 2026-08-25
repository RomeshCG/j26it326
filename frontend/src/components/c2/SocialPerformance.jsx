import React, { useState } from "react"
import {
    TrendingUp,
    TrendingDown,
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    Info,
    ChevronDown,
    Users,
    Activity,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// MOCK DATA  — replace with API responses later
// ─────────────────────────────────────────────────────────────

/** Social indicator definitions
 *  improveDir: "up" = higher is better, "down" = lower is better
 */
const SOCIAL_INDICATORS = [
    {
        id: "female_borrower_ratio",
        name: "Female Borrower Ratio",
        unit: "%",
        currentValue: 62.4,
        changePct: 4.2,
        improvDir: "up",   // higher is better
        status: "improving",
        definition: "Measures the proportion of active female borrowers in the loan portfolio. Higher ratio indicates stronger gender-inclusive outreach.",
        monthlyData: [57.8, 58.4, 58.9, 59.3, 59.8, 60.1, 60.5, 61.0, 61.4, 61.8, 62.0, 62.4],
        color: "#10b981", // emerald
    },
    {
        id: "new_to_banking_ratio",
        name: "New-to-Banking Ratio",
        unit: "%",
        currentValue: 38.2,
        changePct: 5.6,
        improvDir: "up",
        status: "improving",
        definition: "Percentage of borrowers who had no prior formal banking relationship. Higher values indicate stronger financial inclusion impact.",
        monthlyData: [32.6, 33.1, 33.8, 34.2, 34.9, 35.5, 36.0, 36.5, 37.0, 37.4, 37.9, 38.2],
        color: "#10b981",
    },
    {
        id: "poverty_proxy_score",
        name: "Poverty Proxy Score",
        unit: "",
        currentValue: 71.5,
        changePct: -2.8,
        improvDir: "up",   // higher is better — declining is negative
        status: "attention",
        definition: "A composite score measuring outreach depth to financially vulnerable clients. Declining trend indicates reduced poverty impact.",
        monthlyData: [73.6, 73.8, 73.2, 72.9, 73.1, 72.7, 72.4, 72.0, 71.8, 71.9, 71.7, 71.5],
        color: "#f59e0b", // amber — warning
    },
    {
        id: "client_dropout_rate",
        name: "Client Dropout Rate",
        unit: "%",
        currentValue: 4.8,
        changePct: -1.2,
        improvDir: "down", // lower is better — declining is positive
        status: "improving",
        definition: "Percentage of clients who exited the portfolio without completing their loan cycle. Lower dropout reflects stronger retention.",
        monthlyData: [6.0, 5.8, 5.7, 5.6, 5.4, 5.3, 5.2, 5.1, 5.0, 4.9, 4.8, 4.8],
        color: "#10b981",
    },
    {
        id: "social_outreach_coverage",
        name: "Social Outreach Coverage",
        unit: "%",
        currentValue: 68.7,
        changePct: 6.4,
        improvDir: "up",
        status: "improving",
        definition: "Percentage of target underserved communities actively reached by branch services. Reflects breadth of social outreach programs.",
        monthlyData: [62.3, 63.0, 63.8, 64.4, 65.0, 65.8, 66.1, 66.7, 67.2, 67.8, 68.2, 68.7],
        color: "#10b981",
    },
    {
        // Sixth indicator — Loan Impact Index as placeholder per research spec
        // Replace name, unit, improvDir and data when final research indicator is confirmed
        id: "loan_impact_index",
        name: "Loan Impact Index",
        unit: "",
        currentValue: 66.3,
        changePct: 3.1,
        improvDir: "up",
        status: "stable",
        definition: "Composite index measuring the tangible socioeconomic impact of issued loans (income improvement, asset creation, employment). Replace with approved research indicator when finalised.",
        monthlyData: [64.3, 64.5, 64.8, 65.0, 65.1, 65.4, 65.6, 65.9, 66.0, 66.1, 66.2, 66.3],
        color: "#6366f1", // indigo
    },
]

const MONTHS_12 = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]

// ─── Branch data ───
const BRANCH_DATA = [
    { branch: "Colombo", femaleBorrower: 64.2, newToBanking: 42.1, povertyProxy: 74.2, dropoutRate: 3.8, socialScore: 78.6, mdiContrib: 4.8 },
    { branch: "Kandy", femaleBorrower: 59.8, newToBanking: 35.4, povertyProxy: 68.1, dropoutRate: 5.2, socialScore: 69.4, mdiContrib: -3.2 },
    { branch: "Galle", femaleBorrower: 62.7, newToBanking: 39.8, povertyProxy: 71.6, dropoutRate: 4.4, socialScore: 74.1, mdiContrib: 1.7 },
    { branch: "Kurunegala", femaleBorrower: 57.9, newToBanking: 33.6, povertyProxy: 66.8, dropoutRate: 6.0, socialScore: 67.2, mdiContrib: -4.6 },
    { branch: "Jaffna", femaleBorrower: 61.5, newToBanking: 37.9, povertyProxy: 72.4, dropoutRate: 4.2, socialScore: 73.8, mdiContrib: 0.9 },
]

// ─── MDI Contributions ───
const MDI_CONTRIBUTIONS = [
    { name: "Female Borrower Ratio", value: 12.4, color: "#10b981" },
    { name: "New-to-Banking Ratio", value: 8.7, color: "#10b981" },
    { name: "Social Outreach Coverage", value: 7.1, color: "#10b981" },
    { name: "Client Dropout Rate", value: 6.2, color: "#10b981" },
    { name: "Financial Indicators", value: 4.9, color: "#6366f1" },
    { name: "Loan Impact Index", value: 3.4, color: "#6366f1" },
    { name: "Poverty Proxy Score", value: -9.3, color: "#f59e0b" },
]

const SUMMARY = {
    mdi: 72.4,
    socialScore: 74.8,
    improving: 4,
    total: 6,
    attention: 2,
    assessment: "Stable with emerging social-risk signals.",
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** SVG sparkline using inline SVG — matches existing dashboard chart style */
function MiniLineChart({ data, color, height = 60 }) {
    if (!data || data.length < 2) return null
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const w = 100
    const h = height

    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * w
        const y = h - ((v - min) / range) * (h - 8) - 4
        return `${x},${y}`
    })
    const polyline = pts.join(" ")

    // Area fill path
    const areaPath = `M${pts[0]} L${pts.join(" L")} L${(data.length - 1) / (data.length - 1) * w},${h} L0,${h} Z`

    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full"
            style={{ height }}
            preserveAspectRatio="none"
        >
            <defs>
                <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            {/* Area fill */}
            <path d={areaPath} fill={`url(#grad-${color.replace("#", "")})`} />
            {/* Line */}
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polyline}
            />
            {/* Last point dot */}
            <circle
                cx={(data.length - 1) / (data.length - 1) * w}
                cy={h - ((data[data.length - 1] - min) / range) * (h - 8) - 4}
                r="2.5"
                fill={color}
            />
        </svg>
    )
}

/** Determine if a trend is "good" */
function isTrendPositive(indicator) {
    if (indicator.improvDir === "up") return indicator.changePct >= 0
    return indicator.changePct <= 0 // "down" = lower is better
}

/** Status badge */
function StatusBadge({ status }) {
    const map = {
        improving: { cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", label: "Improving" },
        stable: { cls: "bg-blue-500/15 text-blue-500 border-blue-500/25", label: "Stable" },
        attention: { cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", label: "Needs Attention" },
    }
    const s = map[status] || map.stable
    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.cls}`}>
            {s.label}
        </span>
    )
}

// ─────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────

/** Single indicator chart card */
function SocialIndicatorCard({ indicator }) {
    const [showInfo, setShowInfo] = useState(false)
    const positive = isTrendPositive(indicator)
    const absChange = Math.abs(indicator.changePct)
    const TrendIcon = indicator.changePct >= 0 ? TrendingUp : TrendingDown
    const trendColor = positive
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-amber-600 dark:text-amber-400"

    return (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3 relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground leading-tight">{indicator.name}</span>
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={`info-${indicator.id}`}
                    >
                        <Info size={13} />
                    </button>
                </div>
                <StatusBadge status={indicator.status} />
            </div>

            {/* Info tooltip */}
            {showInfo && (
                <div className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                    {indicator.definition}
                </div>
            )}

            {/* Current value + trend */}
            <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-foreground">
                    {indicator.currentValue}{indicator.unit}
                </span>
                <div className={`pb-0.5 flex items-center gap-0.5 text-sm font-semibold ${trendColor}`}>
                    <TrendIcon size={15} />
                    {indicator.changePct >= 0 ? "+" : ""}{indicator.changePct}% YoY
                </div>
            </div>

            {/* SVG Chart */}
            <div className="relative mt-1">
                <MiniLineChart data={indicator.monthlyData} color={indicator.color} height={56} />
            </div>

            {/* Month axis labels */}
            <div className="flex justify-between text-[9px] text-muted-foreground uppercase tracking-wide -mt-1">
                {MONTHS_12.filter((_, i) => i % 3 === 0 || i === 11).map((m) => (
                    <span key={m}>{m}</span>
                ))}
            </div>
        </div>
    )
}

/** Horizontal contribution bar for MDI breakdown */
function ContributionBar({ name, value, maxAbs }) {
    const pct = Math.round((Math.abs(value) / maxAbs) * 100)
    const isPositive = value >= 0
    return (
        <div className="flex items-center gap-3">
            <span className="w-48 shrink-0 text-sm text-foreground truncate">{name}</span>
            <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                    className={`h-full rounded-full ${isPositive ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span
                className={`w-10 text-right text-sm font-semibold tabular-nums ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
            >
                {value >= 0 ? "+" : ""}{value}
            </span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function SocialPerformance() {
    const [period, setPeriod] = useState("Last 12 Months")

    const bestBranch = [...BRANCH_DATA].sort((a, b) => b.socialScore - a.socialScore)[0]
    const worstBranch = [...BRANCH_DATA].sort((a, b) => a.socialScore - b.socialScore)[0]
    const maxMdiAbs = Math.max(...MDI_CONTRIBUTIONS.map((c) => Math.abs(c.value)))
    const positiveContribs = MDI_CONTRIBUTIONS.filter((c) => c.value >= 0)
    const negativeContribs = MDI_CONTRIBUTIONS.filter((c) => c.value < 0)

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">

            {/* ── PAGE HEADER ── */}
            <header className="z-10 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border bg-background/80 px-8 py-6 backdrop-blur-md sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                        Social Performance
                    </h1>
                    <div className="mt-1 text-sm text-muted-foreground">
                        Deep-dive analysis of social impact indicators and their contribution to mission health.
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground">
                        <ChevronDown size={14} className="text-muted-foreground" />
                        <select
                            id="sp-period-selector"
                            className="bg-transparent border-none outline-none text-sm font-medium text-foreground cursor-pointer"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            aria-label="period-selector"
                        >
                            <option>Last 12 Months</option>
                            <option>Last 6 Months</option>
                            <option>Last 24 Months</option>
                        </select>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">

                {/* ── SOCIAL PERFORMANCE SUMMARY ── */}
                <section className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm overflow-hidden relative">
                    <div className="pointer-events-none absolute top-0 right-0 h-56 w-56 translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/8 blur-3xl" />

                    <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
                        {/* MDI */}
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current MDI</div>
                            <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{SUMMARY.mdi}</div>
                        </div>
                        {/* Social Score */}
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Social Performance Score</div>
                            <div className="text-4xl font-bold text-foreground">{SUMMARY.socialScore}</div>
                        </div>
                        {/* Improving */}
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Indicators Improving</div>
                            <div className="text-4xl font-bold text-foreground">
                                {SUMMARY.improving}
                                <span className="text-xl text-muted-foreground font-normal"> / {SUMMARY.total}</span>
                            </div>
                        </div>
                        {/* Attention */}
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Requiring Attention</div>
                            <div className="text-4xl font-bold text-amber-500">
                                {SUMMARY.attention}
                                <span className="text-xl text-muted-foreground font-normal"> / {SUMMARY.total}</span>
                            </div>
                        </div>
                    </div>

                    {/* Assessment line */}
                    <div className="relative z-10 mt-5 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-2 w-fit">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                        <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                            Current assessment: {SUMMARY.assessment}
                        </span>
                    </div>
                </section>

                {/* ── SIX INDICATOR TREND CHARTS ── */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <Activity className="text-emerald-600 dark:text-emerald-400" size={20} />
                            Social Indicator Trends
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {period} performance across key social impact indicators.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {SOCIAL_INDICATORS.map((ind) => (
                            <SocialIndicatorCard key={ind.id} indicator={ind} />
                        ))}
                    </div>
                </section>

                {/* ── BRANCH COMPARISON ── */}
                <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <Users className="text-purple-500" size={20} />
                                Branch Performance Comparison
                            </h2>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Compare social performance across branches.
                            </p>
                        </div>

                        {/* Best/Worst callouts */}
                        <div className="flex gap-3 flex-wrap text-xs">
                            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                                <CheckCircle2 size={13} className="text-emerald-500" />
                                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                    Best: <span className="font-bold">{bestBranch.branch}</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
                                <AlertTriangle size={13} className="text-amber-500" />
                                <span className="text-amber-700 dark:text-amber-400 font-medium">
                                    Needs Attention: <span className="font-bold">{worstBranch.branch}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-x-auto">
                        <table className="w-full text-sm" aria-label="branch-comparison-table">
                            <thead>
                                <tr className="border-b border-border">
                                    {["Branch", "Female Borrower Ratio", "New-to-Banking", "Poverty Proxy", "Dropout Rate", "Social Score", "MDI Contribution"].map((col) => (
                                        <th
                                            key={col}
                                            className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {BRANCH_DATA.map((row) => (
                                    <tr key={row.branch} className="transition-colors hover:bg-muted/20">
                                        <td className="px-5 py-3 font-semibold text-foreground whitespace-nowrap">{row.branch}</td>
                                        <td className="px-5 py-3 text-muted-foreground">{row.femaleBorrower}%</td>
                                        <td className="px-5 py-3 text-muted-foreground">{row.newToBanking}%</td>
                                        <td className="px-5 py-3 text-muted-foreground">{row.povertyProxy}</td>
                                        <td className="px-5 py-3 text-muted-foreground">{row.dropoutRate}%</td>
                                        <td className="px-5 py-3 font-semibold text-foreground">{row.socialScore}</td>
                                        <td className="px-5 py-3">
                                            <span
                                                className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${row.mdiContrib >= 0
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-amber-600 dark:text-amber-400"
                                                    }`}
                                            >
                                                {row.mdiContrib >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                                {row.mdiContrib >= 0 ? "+" : ""}{row.mdiContrib}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* ── MDI CONTRIBUTION BREAKDOWN ── */}
                <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
                    {/* Section title */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">MDI Contribution Breakdown</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                How current social and financial indicators influence the Mission Drift Index.
                            </p>
                        </div>
                        {/* MDI score badge */}
                        <div className="shrink-0 flex flex-col items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Current MDI</span>
                            <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{SUMMARY.mdi}</span>
                        </div>
                    </div>

                    {/* Explainability narrative */}
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-foreground/85 leading-relaxed">
                        Current MDI is influenced <span className="font-semibold text-emerald-600 dark:text-emerald-400">positively</span> by improvements in female borrower participation, new-to-banking outreach, and social outreach coverage. The declining{" "}
                        <span className="font-semibold text-amber-600 dark:text-amber-400">Poverty Proxy Score</span> is currently the strongest negative contributor.
                    </div>

                    {/* Positive contributions */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                            <TrendingUp size={13} /> Positive Contributions
                        </h3>
                        {positiveContribs.map((c) => (
                            <ContributionBar key={c.name} name={c.name} value={c.value} maxAbs={maxMdiAbs} />
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border/50" />

                    {/* Negative contributions */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-2">
                            <TrendingDown size={13} /> Negative Contributions
                        </h3>
                        {negativeContribs.map((c) => (
                            <ContributionBar key={c.name} name={c.name} value={c.value} maxAbs={maxMdiAbs} />
                        ))}
                    </div>

                    <p className="text-[10px] text-muted-foreground italic">
                        Contribution values are mock UI data only. Replace with actual MDI algorithm output from backend/API.
                    </p>
                </section>

                {/* ── GENAI SOCIAL INSIGHT ── */}
                <section className="rounded-2xl border border-blue-500/20 bg-card p-6 shadow-sm relative overflow-hidden">
                    <div className="pointer-events-none absolute top-0 -right-4 h-48 w-48 rounded-full bg-blue-500/5 blur-3xl" />

                    <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground relative z-10">
                        <Sparkles className="text-blue-500" size={18} />
                        GenAI Social Performance Insight
                    </h2>
                    <p className="text-xs text-muted-foreground mb-5 relative z-10">
                        AI-generated interpretation of current social performance data
                    </p>

                    {/* Narrative */}
                    <div className="relative z-10 text-sm text-foreground/90 leading-relaxed mb-6 bg-muted/30 p-4 rounded-xl border border-border/50">
                        "Social performance has improved overall during the past 12 months. Female borrower participation and new-to-banking outreach show consistent improvement. However, the Poverty Proxy Score has declined gradually, indicating a potential reduction in outreach to financially vulnerable clients. Immediate attention to branch-level poverty outreach is recommended before the trend impacts the MDI threshold."
                    </div>

                    {/* Key observations */}
                    <div className="space-y-3 mb-6 relative z-10">
                        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Key Observations</h3>
                        {[
                            { icon: CheckCircle2, color: "text-emerald-500", text: "Female borrower participation is consistently improving across all branches." },
                            { icon: CheckCircle2, color: "text-emerald-500", text: "New-to-banking ratio reflects strong financial inclusion progress." },
                            { icon: CheckCircle2, color: "text-emerald-500", text: "Social outreach coverage has expanded by 6.4% year-over-year." },
                            { icon: AlertTriangle, color: "text-amber-500", text: "Poverty Proxy Score in declining trend — requires branch-level review.", warn: true },
                        ].map((item, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                                <item.icon className={`${item.color} shrink-0 mt-0.5`} size={16} />
                                <span className={item.warn ? "text-amber-700 dark:text-amber-400 font-medium" : ""}>{item.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* Key focus */}
                    <div className="relative z-10 mt-auto pt-4 border-t border-border">
                        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Key Focus</h3>
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-3 py-2 rounded-lg border border-blue-500/20">
                            Monitor poverty-related outreach at branch level to prevent further MDI erosion.
                        </div>
                    </div>
                </section>

            </div>
        </div>
    )
}
