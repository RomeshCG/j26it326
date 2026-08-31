import React, { useState, useCallback } from "react"
import {
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle2,
    Users,
    Activity,
    BarChart2,
    BookOpen,
    FlaskConical,
    ArrowRight,
    ChevronDown,
    Minus,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const MONTHS_12 = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]

// ─────────────────────────────────────────────────────────────
// SOCIAL INDICATOR DATA STRUCTURE
// All frontend demo data — replace with backend/API values later.
// improvDir: "up" = higher is better, "down" = lower is better
// ─────────────────────────────────────────────────────────────

const SOCIAL_INDICATORS = [
    {
        id: "female_borrower_ratio",
        name: "Female Borrower Ratio",
        icon: "♀",
        unit: "%",
        currentValue: 62.4,
        changePct: 4.2,
        improvDir: "up",
        status: "improving",
        mdiContribution: 12.4,
        mdiWeight: 0.22,
        mdiTrend: 0.564,
        color: "#10b981",
        monthlyData: [57.8, 58.4, 58.9, 59.3, 59.8, 60.1, 60.5, 61.0, 61.4, 61.8, 62.0, 62.4],
        branchData: [
            { name: "Colombo", value: 64.2 },
            { name: "Galle", value: 62.7 },
            { name: "Jaffna", value: 61.5 },
            { name: "Kandy", value: 59.8 },
            { name: "Kurunegala", value: 57.9 },
        ],
        whyItMatters:
            "Measures the proportion of active female borrowers in the loan portfolio. Higher ratios indicate stronger gender-inclusive lending practices and alignment with financial inclusion objectives. A sustained increase suggests the institution is successfully reaching underserved female client segments.",
        interpretation:
            "The Female Borrower Ratio has increased consistently from 57.8 to 62.4 over the monitored period, representing a 4.2% improvement. This is the strongest positive contributor to the current Mission Drift Index.",
        currentObservation: "Improving",
        monitoringFocus: "Maintain branch-level female outreach momentum and monitor for regional gaps.",
        trendSummary: "The Female Borrower Ratio increased from 57.8% to 62.4% during the last 12 months.",
        overallChange: "+4.2%",
        trend: "Increasing",
    },
    {
        id: "new_to_banking_ratio",
        name: "New-to-Banking Ratio",
        icon: "◈",
        unit: "%",
        currentValue: 38.2,
        changePct: 5.6,
        improvDir: "up",
        status: "improving",
        mdiContribution: 8.7,
        mdiWeight: 0.18,
        mdiTrend: 0.483,
        color: "#10b981",
        monthlyData: [32.6, 33.1, 33.8, 34.2, 34.9, 35.5, 36.0, 36.5, 37.0, 37.4, 37.9, 38.2],
        branchData: [
            { name: "Colombo", value: 42.1 },
            { name: "Galle", value: 39.8 },
            { name: "Jaffna", value: 37.9 },
            { name: "Kandy", value: 35.4 },
            { name: "Kurunegala", value: 33.6 },
        ],
        whyItMatters:
            "Percentage of borrowers who had no prior formal banking relationship before joining the portfolio. Higher values indicate stronger financial inclusion impact and alignment with the institution's mission to serve the unbanked population.",
        interpretation:
            "The New-to-Banking Ratio has grown steadily from 32.6% to 38.2% across the monitored period, indicating effective outreach to unbanked client segments. This reflects one of the stronger positive contributions to the current MDI.",
        currentObservation: "Improving",
        monitoringFocus: "Expand first-time banking client acquisition programs, particularly in rural branches.",
        trendSummary: "The New-to-Banking Ratio increased from 32.6% to 38.2% during the last 12 months.",
        overallChange: "+5.6%",
        trend: "Increasing",
    },
    {
        id: "poverty_proxy_score",
        name: "Poverty Proxy Score",
        icon: "◉",
        unit: "",
        currentValue: 71.5,
        changePct: -2.8,
        improvDir: "up",
        status: "attention",
        mdiContribution: -9.3,
        mdiWeight: 0.25,
        mdiTrend: -0.372,
        color: "#f59e0b",
        monthlyData: [73.6, 73.8, 73.2, 72.9, 73.1, 72.7, 72.4, 72.0, 71.8, 71.9, 71.7, 71.5],
        branchData: [
            { name: "Colombo", value: 74.2 },
            { name: "Jaffna", value: 72.4 },
            { name: "Galle", value: 71.6 },
            { name: "Kandy", value: 68.1 },
            { name: "Kurunegala", value: 66.8 },
        ],
        whyItMatters:
            "A composite score measuring outreach depth to financially vulnerable clients. A sustained decline may indicate reduced engagement with higher-vulnerability borrower segments, which directly conflicts with the institution's social mission mandate.",
        interpretation:
            "The Poverty Proxy Score has declined consistently over the last 12 months and currently represents the strongest negative contribution among the monitored social indicators. The decline from 73.6 to 71.5 warrants immediate branch-level review.",
        currentObservation: "Emerging Risk",
        monitoringFocus: "Review branch-level outreach to financially vulnerable borrowers.",
        trendSummary: "The Poverty Proxy Score declined from 73.6 to 71.5 during the last 12 months.",
        overallChange: "-2.8%",
        trend: "Declining",
    },
    {
        id: "client_dropout_rate",
        name: "Client Dropout Rate",
        icon: "⊗",
        unit: "%",
        currentValue: 4.8,
        changePct: -1.2,
        improvDir: "down",
        status: "improving",
        mdiContribution: 6.2,
        mdiWeight: 0.15,
        mdiTrend: 0.413,
        color: "#10b981",
        monthlyData: [6.0, 5.8, 5.7, 5.6, 5.4, 5.3, 5.2, 5.1, 5.0, 4.9, 4.8, 4.8],
        branchData: [
            { name: "Colombo", value: 3.8 },
            { name: "Jaffna", value: 4.2 },
            { name: "Galle", value: 4.4 },
            { name: "Kandy", value: 5.2 },
            { name: "Kurunegala", value: 6.0 },
        ],
        whyItMatters:
            "Percentage of clients who exited the portfolio without completing their loan cycle. A declining rate indicates stronger client retention and relationship quality. Lower dropout rates are beneficial and reflect improved social performance and mission alignment.",
        interpretation:
            "The Client Dropout Rate has steadily declined from 6.0% to 4.8% over the last 12 months. Since a lower dropout rate indicates stronger retention, this represents a positive contribution to the MDI. Kurunegala branch requires specific attention.",
        currentObservation: "Improving",
        monitoringFocus: "Sustain retention programs and investigate dropout drivers in high-rate branches.",
        trendSummary: "The Client Dropout Rate declined from 6.0% to 4.8% during the last 12 months (lower is better).",
        overallChange: "-1.2%",
        trend: "Declining (Positive)",
    },
    {
        id: "social_outreach_coverage",
        name: "Social Outreach Coverage",
        icon: "◎",
        unit: "%",
        currentValue: 68.7,
        changePct: 6.4,
        improvDir: "up",
        status: "improving",
        mdiContribution: 7.1,
        mdiWeight: 0.12,
        mdiTrend: 0.592,
        color: "#10b981",
        monthlyData: [62.3, 63.0, 63.8, 64.4, 65.0, 65.8, 66.1, 66.7, 67.2, 67.8, 68.2, 68.7],
        branchData: [
            { name: "Colombo", value: 78.6 },
            { name: "Galle", value: 74.1 },
            { name: "Jaffna", value: 73.8 },
            { name: "Kandy", value: 69.4 },
            { name: "Kurunegala", value: 67.2 },
        ],
        whyItMatters:
            "Percentage of target underserved communities actively reached by branch services. A rising coverage rate reflects broadening social outreach programs and indicates the institution is expanding its impact beyond existing client segments.",
        interpretation:
            "Social Outreach Coverage has expanded significantly from 62.3% to 68.7% — a 6.4% increase over the monitored period. Colombo leads outreach coverage while Kurunegala represents the lowest-coverage branch requiring targeted outreach investment.",
        currentObservation: "Improving",
        monitoringFocus: "Prioritise outreach investments in lower-coverage branches to reduce geographic disparity.",
        trendSummary: "Social Outreach Coverage increased from 62.3% to 68.7% during the last 12 months.",
        overallChange: "+6.4%",
        trend: "Increasing",
    },
    {
        id: "loan_impact_index",
        name: "Loan Impact Index",
        icon: "◆",
        unit: "",
        currentValue: 66.3,
        changePct: 3.1,
        improvDir: "up",
        status: "stable",
        mdiContribution: 3.4,
        mdiWeight: 0.08,
        mdiTrend: 0.425,
        color: "#6366f1",
        monthlyData: [64.3, 64.5, 64.8, 65.0, 65.1, 65.4, 65.6, 65.9, 66.0, 66.1, 66.2, 66.3],
        branchData: [
            { name: "Colombo", value: 70.2 },
            { name: "Galle", value: 68.4 },
            { name: "Jaffna", value: 67.1 },
            { name: "Kandy", value: 65.0 },
            { name: "Kurunegala", value: 62.8 },
        ],
        whyItMatters:
            "Composite index measuring the tangible socioeconomic impact of issued loans, including income improvement, asset creation, and employment generation. Note: Replace with the approved research indicator specification when the final research methodology is confirmed.",
        interpretation:
            "The Loan Impact Index has improved gradually from 64.3 to 66.3 over the last 12 months, representing a modest but stable positive contribution to the MDI. The index reflects consistent, if incremental, improvement in loan social impact.",
        currentObservation: "Stable",
        monitoringFocus: "Monitor loan utilisation patterns and assess income improvement metrics at borrower level.",
        trendSummary: "The Loan Impact Index increased from 64.3 to 66.3 during the last 12 months.",
        overallChange: "+3.1%",
        trend: "Increasing",
    },
]

// ─── MDI Formula Breakdown weights ───
const MDI_FORMULA_BREAKDOWN = SOCIAL_INDICATORS.map((ind) => ({
    id: ind.id,
    name: ind.name,
    weight: ind.mdiWeight,
    trend: ind.mdiTrend,
    contribution: ind.mdiContribution,
    isPositive: ind.mdiContribution >= 0,
}))

const SUMMARY = {
    mdi: 72.4,
    status: "Stable → Emerging Risk",
    assessment: "Stable with emerging social-risk signals.",
    improving: 4,
    total: 6,
    attention: 2,
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Determine if a trend is "good" (positive performance) */
function isTrendPositive(indicator) {
    if (indicator.improvDir === "up") return indicator.changePct >= 0
    return indicator.changePct <= 0
}

/** Compute display status label */
function getStatusLabel(status) {
    if (status === "improving") return "Improving"
    if (status === "attention") return "Needs Attention"
    return "Stable"
}

/** Status badge consistent with existing design */
function StatusBadge({ status }) {
    const map = {
        improving: {
            cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
            label: "Improving",
        },
        stable: { cls: "bg-blue-500/15 text-blue-500 border-blue-500/25", label: "Stable" },
        attention: {
            cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
            label: "Needs Attention",
        },
    }
    const s = map[status] || map.stable
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.cls}`}
        >
            {s.label}
        </span>
    )
}

// ─────────────────────────────────────────────────────────────
// Large 12-month SVG chart (used only in the detail section)
// ─────────────────────────────────────────────────────────────

/** Large detailed 12-month SVG chart with axis labels and tooltip support */
function LargeTrendChart({ indicator }) {
    const [hoveredIdx, setHoveredIdx] = useState(null)
    const data = indicator.monthlyData
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const W = 560
    const H = 200
    const PAD_L = 52
    const PAD_R = 16
    const PAD_T = 16
    const PAD_B = 32

    const chartW = W - PAD_L - PAD_R
    const chartH = H - PAD_T - PAD_B

    const pts = data.map((v, i) => {
        const x = PAD_L + (i / (data.length - 1)) * chartW
        const y = PAD_T + chartH - ((v - min) / range) * chartH
        return { x, y, v, month: MONTHS_12[i] }
    })

    const polylineStr = pts.map((p) => `${p.x},${p.y}`).join(" ")
    const areaPath = `M${pts[0].x},${pts[0].y} L${pts.map((p) => `${p.x},${p.y}`).join(" L")} L${pts[pts.length - 1].x},${PAD_T + chartH} L${PAD_L},${PAD_T + chartH} Z`

    // Y-axis labels
    const yAxisSteps = 5
    const yLabels = Array.from({ length: yAxisSteps + 1 }, (_, i) => {
        const val = min + (range / yAxisSteps) * i
        return {
            val: Math.round(val * 10) / 10,
            y: PAD_T + chartH - ((val - min) / range) * chartH,
        }
    })

    const hovered = hoveredIdx !== null ? pts[hoveredIdx] : null

    return (
        <div className="relative w-full" style={{ userSelect: "none" }}>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full"
                style={{ height: 200 }}
                preserveAspectRatio="xMidYMid meet"
            >
                <defs>
                    <linearGradient id={`lg-${indicator.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={indicator.color} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={indicator.color} stopOpacity="0.01" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {yLabels.map((yl, i) => (
                    <g key={i}>
                        <line
                            x1={PAD_L}
                            y1={yl.y}
                            x2={W - PAD_R}
                            y2={yl.y}
                            stroke="currentColor"
                            strokeWidth="0.4"
                            strokeDasharray="3,3"
                            className="text-border"
                        />
                        <text
                            x={PAD_L - 6}
                            y={yl.y + 3}
                            textAnchor="end"
                            fontSize="8"
                            className="fill-muted-foreground"
                        >
                            {yl.val}{indicator.unit}
                        </text>
                    </g>
                ))}

                {/* Hover vertical line */}
                {hovered && (
                    <line
                        x1={hovered.x}
                        y1={PAD_T}
                        x2={hovered.x}
                        y2={PAD_T + chartH}
                        stroke={indicator.color}
                        strokeWidth="1"
                        strokeDasharray="3,2"
                        opacity="0.5"
                    />
                )}

                {/* Area fill */}
                <path d={areaPath} fill={`url(#lg-${indicator.id})`} />

                {/* Line */}
                <polyline
                    fill="none"
                    stroke={indicator.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylineStr}
                />

                {/* Data points + hover zones */}
                {pts.map((p, i) => (
                    <g key={i}>
                        <rect
                            x={p.x - 14}
                            y={PAD_T}
                            width="28"
                            height={chartH}
                            fill="transparent"
                            onMouseEnter={() => setHoveredIdx(i)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            style={{ cursor: "crosshair" }}
                        />
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredIdx === i ? 4 : 2.5}
                            fill={indicator.color}
                            stroke="var(--background, #111)"
                            strokeWidth="1.5"
                        />
                    </g>
                ))}

                {/* X-axis labels */}
                {pts
                    .filter((_, i) => i % 2 === 0 || i === pts.length - 1)
                    .map((p, i) => (
                        <text
                            key={i}
                            x={p.x}
                            y={H - 6}
                            textAnchor="middle"
                            fontSize="7.5"
                            className="fill-muted-foreground uppercase"
                        >
                            {p.month}
                        </text>
                    ))}
            </svg>

            {/* Tooltip */}
            {hovered && (
                <div
                    className="pointer-events-none absolute z-10 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg"
                    style={{
                        top: 4,
                        left: `calc(${(hovered.x / W) * 100}% + 8px)`,
                        transform: hovered.x > W * 0.7 ? "translateX(calc(-100% - 16px))" : "none",
                    }}
                >
                    <div className="font-semibold text-foreground">{hovered.month}</div>
                    <div style={{ color: indicator.color }} className="font-bold text-sm">
                        {hovered.v}{indicator.unit}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// INDICATOR SELECTION CARD (compact)
// ─────────────────────────────────────────────────────────────

function IndicatorCard({ indicator, isSelected, onClick }) {
    const positive = isTrendPositive(indicator)
    const TrendIcon = indicator.changePct >= 0 ? TrendingUp : TrendingDown
    const trendColor = positive ? "text-emerald-500" : "text-amber-500"
    const mdiPositive = indicator.mdiContribution >= 0

    return (
        <button
            onClick={onClick}
            id={`indicator-card-${indicator.id}`}
            aria-pressed={isSelected}
            className={[
                "w-full text-left rounded-xl border p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                isSelected
                    ? "border-emerald-500/60 bg-emerald-500/8 shadow-md ring-1 ring-emerald-500/30"
                    : "border-border bg-card hover:border-border/80 hover:bg-muted/30 shadow-sm",
            ].join(" ")}
        >
            {/* Header row: icon + name / status badge */}
            <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <span
                        className="text-base leading-none"
                        style={{ color: indicator.color }}
                        aria-hidden="true"
                    >
                        {indicator.icon}
                    </span>
                    <span className="text-sm font-semibold text-foreground leading-tight">{indicator.name}</span>
                </div>
                <StatusBadge status={indicator.status} />
            </div>

            {/* Current value + YoY change on one row */}
            <div className="flex items-end justify-between gap-2 mb-4">
                <span className="text-2xl font-bold text-foreground tabular-nums">
                    {indicator.currentValue}{indicator.unit}
                </span>
                <div className={`flex items-center gap-0.5 text-xs font-semibold ${trendColor}`}>
                    <TrendIcon size={13} />
                    {indicator.changePct >= 0 ? "+" : ""}
                    {indicator.changePct}%
                </div>
            </div>

            {/* MDI contribution */}
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                <span>MDI contribution</span>
                <span
                    className={`font-bold tabular-nums ${mdiPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                >
                    {mdiPositive ? "+" : ""}
                    {indicator.mdiContribution}
                </span>
            </div>
        </button>
    )
}

// ─────────────────────────────────────────────────────────────
// MDI CONTRIBUTION BAR
// ─────────────────────────────────────────────────────────────

function MdiContributionVisual({ value }) {
    const MAX = 15
    const pct = Math.min(Math.round((Math.abs(value) / MAX) * 100), 100)
    const isPositive = value >= 0

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span
                    className={`text-3xl font-bold tabular-nums ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                >
                    {isPositive ? "+" : ""}
                    {value}
                </span>
                <span
                    className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${isPositive
                        ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                        : "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                        }`}
                >
                    {isPositive ? "Positive" : "Negative"} Impact
                </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted/40 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${isPositive ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <p className="text-[11px] text-muted-foreground">
                {isPositive ? "Positive" : "Negative"} contribution to MDI
                &nbsp;·&nbsp; contribution level: {pct >= 75 ? "High" : pct >= 40 ? "Moderate" : "Low"}
            </p>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// BRANCH PERFORMANCE HORIZONTAL BARS
// ─────────────────────────────────────────────────────────────

function BranchPerformanceBars({ indicator }) {
    const data = [...indicator.branchData]
    // For indicators where lower is better, best = minimum
    const sortedForBest = indicator.improvDir === "down"
        ? [...data].sort((a, b) => a.value - b.value)
        : [...data].sort((a, b) => b.value - a.value)

    const bestBranch = sortedForBest[0]
    const worstBranch = sortedForBest[sortedForBest.length - 1]
    const maxVal = Math.max(...data.map((d) => d.value))
    const minVal = Math.min(...data.map((d) => d.value))

    const getBranchStatus = (branch) => {
        if (branch.name === bestBranch.name) return "best"
        if (branch.name === worstBranch.name) return "attention"
        return "normal"
    }

    return (
        <div className="space-y-4">
            {/* Best / Attention callouts */}
            <div className="flex flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        Best: <strong>{bestBranch.name}</strong>
                    </span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
                    <AlertTriangle size={12} className="text-amber-500" />
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                        Needs Attention: <strong>{worstBranch.name}</strong>
                    </span>
                </div>
            </div>

            {/* Bars */}
            <div className="space-y-2.5">
                {data.map((branch) => {
                    const barPct = ((branch.value - minVal) / ((maxVal - minVal) || 1)) * 100
                    const branchStatus = getBranchStatus(branch)
                    const barColor =
                        branchStatus === "best"
                            ? "bg-emerald-500"
                            : branchStatus === "attention"
                                ? "bg-amber-500"
                                : "bg-blue-500/60"

                    return (
                        <div key={branch.name} className="flex items-center gap-3">
                            <span className="w-24 shrink-0 text-sm text-foreground font-medium">{branch.name}</span>
                            <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                    style={{ width: `${Math.max(barPct, 4)}%` }}
                                />
                            </div>
                            <span className="w-14 text-right text-sm font-semibold tabular-nums text-foreground">
                                {branch.value}{indicator.unit}
                            </span>
                            {branchStatus === "best" && (
                                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            )}
                            {branchStatus === "attention" && (
                                <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                            )}
                            {branchStatus === "normal" && (
                                <span className="w-[13px] shrink-0" />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MDI FORMULA BREAKDOWN TABLE
// ─────────────────────────────────────────────────────────────

function MdiFormulaBreakdown({ selectedId }) {
    const maxAbs = Math.max(...MDI_FORMULA_BREAKDOWN.map((r) => Math.abs(r.contribution)))

    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-border/50 bg-muted/10 px-4 py-2 text-sm text-foreground/80 font-mono">
                MDI = Σ (Weight × Indicator Trend)
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm" aria-label="mdi-formula-breakdown">
                    <thead>
                        <tr className="border-b border-border bg-muted/20">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Indicator
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Weight
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Trend
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Contribution
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">
                                Impact Bar
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {MDI_FORMULA_BREAKDOWN.map((row) => {
                            const pct = Math.round((Math.abs(row.contribution) / maxAbs) * 100)
                            const isActive = row.id === selectedId
                            return (
                                <tr
                                    key={row.id}
                                    className={`transition-colors ${isActive ? "bg-emerald-500/5" : "hover:bg-muted/10"}`}
                                >
                                    <td className="px-4 py-3 font-medium text-foreground">
                                        {isActive && (
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 mb-0.5" />
                                        )}
                                        {row.name}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                                        {row.weight.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                                        {row.trend >= 0 ? "+" : ""}
                                        {row.trend.toFixed(3)}
                                    </td>
                                    <td
                                        className={`px-4 py-3 text-right tabular-nums font-semibold ${row.isPositive
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-amber-600 dark:text-amber-400"
                                            }`}
                                    >
                                        {row.isPositive ? "+" : ""}
                                        {row.contribution}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${row.isPositive ? "bg-emerald-500" : "bg-amber-500"}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-border bg-muted/20">
                            <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-foreground">
                                Current MDI Score
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-xl text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {SUMMARY.mdi}
                            </td>
                            <td className="px-4 py-3" />
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
                Weights, trends and contributions are frontend demo data only. Replace with actual MDI algorithm output from backend/API.
            </p>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function SocialPerformance() {
    // Default selection: Poverty Proxy Score (strongest negative contributor)
    const [selectedId, setSelectedId] = useState("poverty_proxy_score")
    const [period, setPeriod] = useState("Last 12 Months")

    const selected = SOCIAL_INDICATORS.find((ind) => ind.id === selectedId)
    const positive = isTrendPositive(selected)
    const TrendIcon = selected.changePct >= 0 ? TrendingUp : TrendingDown
    const trendColor = positive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"

    const handleSelect = useCallback((id) => {
        setSelectedId(id)
    }, [])

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">

            {/* ── 1. PAGE HEADER (existing style preserved) ── */}
            <header className="z-10 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border bg-background/80 px-8 py-6 backdrop-blur-md sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                        Social Performance
                    </h1>
                    <div className="mt-1 text-sm text-muted-foreground">
                        Deep-dive analysis of social indicators influencing mission health.
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

                {/* ── 2. CURRENT MDI SUMMARY (existing style preserved) ── */}
                <section className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm overflow-hidden relative">
                    <div className="pointer-events-none absolute top-0 right-0 h-56 w-56 translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/8 blur-3xl" />

                    <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
                        {/* MDI */}
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Current MDI
                            </div>
                            <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                                {SUMMARY.mdi}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                Status: <span className="text-amber-500 font-medium">{SUMMARY.status}</span>
                            </div>
                        </div>
                        {/* Improving */}
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Indicators Improving
                            </div>
                            <div className="text-4xl font-bold text-foreground">
                                {SUMMARY.improving}
                                <span className="text-xl text-muted-foreground font-normal"> / {SUMMARY.total}</span>
                            </div>
                        </div>
                        {/* Attention */}
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Requiring Attention
                            </div>
                            <div className="text-4xl font-bold text-amber-500">
                                {SUMMARY.attention}
                                <span className="text-xl text-muted-foreground font-normal"> / {SUMMARY.total}</span>
                            </div>
                        </div>
                        {/* Assessment */}
                        <div className="flex flex-col justify-center">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Assessment
                            </div>
                            <div className="text-sm text-foreground font-medium leading-snug">
                                {SUMMARY.assessment}
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 mt-5 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-2 w-fit">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                        <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                            Current assessment: {SUMMARY.assessment}
                        </span>
                    </div>
                </section>

                {/* ── 3. SOCIAL INDICATOR EXPLORER ── */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <Activity className="text-emerald-600 dark:text-emerald-400" size={20} />
                            Social Indicator Explorer
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Select an indicator to investigate its trend, branch impact, and contribution to the Mission Drift Index.
                        </p>
                    </div>

                    {/* ── 6 Selection Cards (2×3 grid) ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {SOCIAL_INDICATORS.map((ind) => (
                            <IndicatorCard
                                key={ind.id}
                                indicator={ind}
                                isSelected={ind.id === selectedId}
                                onClick={() => handleSelect(ind.id)}
                            />
                        ))}
                    </div>
                </section>

                {/* ── 4. DYNAMIC INDICATOR ANALYSIS ── */}
                {selected && (
                    <section className="space-y-6" id="indicator-analysis-section">

                        {/* Section heading */}
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <BarChart2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                            <h2 className="text-lg font-semibold text-foreground">
                                Indicator Analysis
                            </h2>
                            <ArrowRight size={14} className="text-muted-foreground" />
                            <span className="text-lg font-semibold" style={{ color: selected.color }}>
                                {selected.name}
                            </span>
                        </div>

                        {/* ── Indicator current value + trend ── */}
                        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div>
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                        {selected.name}
                                    </div>
                                    <div className="flex items-end gap-3">
                                        <span className="text-5xl font-bold text-foreground tabular-nums">
                                            {selected.currentValue}{selected.unit}
                                        </span>
                                        <div className={`flex items-center gap-1 pb-1 text-base font-semibold ${trendColor}`}>
                                            <TrendIcon size={18} />
                                            {selected.changePct >= 0 ? "+" : ""}
                                            {selected.changePct}% over last 12 months
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 sm:items-end">
                                    <StatusBadge status={selected.status} />
                                    <div className="text-sm text-muted-foreground">
                                        MDI Contribution:{" "}
                                        <span
                                            className={`font-bold tabular-nums ${selected.mdiContribution >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                                        >
                                            {selected.mdiContribution >= 0 ? "+" : ""}
                                            {selected.mdiContribution}
                                        </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Impact:{" "}
                                        <span className={`font-medium ${selected.mdiContribution >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                            {selected.mdiContribution >= 0 ? "Positive" : "Negative"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── 5. 12-Month Trend Chart + Analysis ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                            {/* Chart — larger, takes 3/5 columns on large screens */}
                            <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
                                <h3 className="text-sm font-semibold text-foreground mb-1">
                                    12-Month Trend
                                </h3>
                                <p className="text-xs text-muted-foreground mb-4">
                                    {period} · Hover to inspect monthly values
                                </p>
                                <LargeTrendChart indicator={selected} />
                                {/* Month x-axis full list below chart */}
                                <div className="mt-4 flex justify-between text-[9px] text-muted-foreground uppercase tracking-wide">
                                    {MONTHS_12.map((m) => (
                                        <span key={m}>{m}</span>
                                    ))}
                                </div>
                            </div>

                            {/* Trend Analysis summary — 2/5 columns */}
                            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                        Trend Analysis
                                    </h3>
                                    <p className="text-sm text-foreground/85 leading-relaxed">
                                        {selected.trendSummary}
                                    </p>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                                        <span className="text-muted-foreground">Overall change</span>
                                        <span className={`font-semibold tabular-nums ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                            {selected.overallChange}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                                        <span className="text-muted-foreground">Trend</span>
                                        <span className="font-medium text-foreground">{selected.trend}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                                        <span className="text-muted-foreground">Performance</span>
                                        <StatusBadge status={selected.status} />
                                    </div>
                                    <div className="flex justify-between items-center py-1.5">
                                        <span className="text-muted-foreground">Directionality</span>
                                        <span className="text-xs font-medium text-foreground">
                                            {selected.improvDir === "up" ? "Higher = Better" : "Lower = Better"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── 6. MDI CONTRIBUTION ── */}
                        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground mb-0.5">
                                    Contribution to MDI
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    How {selected.name} currently influences the Mission Drift Index score.
                                </p>
                            </div>
                            <MdiContributionVisual value={selected.mdiContribution} />
                        </div>

                        {/* ── 7. BRANCH PERFORMANCE ── */}
                        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground mb-0.5 flex items-center gap-2">
                                    <Users size={16} className="text-purple-500" />
                                    Branch Performance
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Compare {selected.name} across branches.
                                </p>
                            </div>
                            <BranchPerformanceBars indicator={selected} />
                        </div>

                        {/* ── 8. WHY THIS INDICATOR MATTERS + RESEARCH INTERPRETATION ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                            {/* Why it matters */}
                            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <BookOpen size={15} className="text-blue-500" />
                                    Why This Indicator Matters
                                </h3>
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                    {selected.whyItMatters}
                                </p>
                            </div>

                            {/* Research Interpretation */}
                            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <FlaskConical size={15} className="text-indigo-500" />
                                    Research Interpretation
                                </h3>
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                    {selected.interpretation}
                                </p>
                                <div className="space-y-2 pt-2 border-t border-border/40">
                                    <div className="flex justify-between items-start gap-2 text-sm">
                                        <span className="text-muted-foreground shrink-0">Current observation:</span>
                                        <span
                                            className={`font-semibold text-right ${selected.mdiContribution >= 0
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-amber-600 dark:text-amber-400"
                                                }`}
                                        >
                                            {selected.currentObservation}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-start gap-2 text-sm">
                                        <span className="text-muted-foreground shrink-0">Monitoring focus:</span>
                                        <span className="text-foreground font-medium text-right text-xs leading-snug max-w-[60%]">
                                            {selected.monitoringFocus}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </section>
                )}

                {/* ── 9. MDI FORMULA BREAKDOWN ── */}
                <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                    <div>
                        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                            <Minus size={16} className="text-muted-foreground" />
                            MDI Formula Breakdown
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Contribution of each monitored social indicator to the current Mission Drift Index.
                            The selected indicator is highlighted.
                        </p>
                    </div>
                    <MdiFormulaBreakdown selectedId={selectedId} />
                </section>

            </div>
        </div>
    )
}
