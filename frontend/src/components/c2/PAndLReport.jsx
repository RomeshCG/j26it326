import React, { useState } from "react"
import {
    TrendingUp,
    TrendingDown,
    Download,
    Printer,
    ChevronDown,
    FileText,
    RefreshCw,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// MOCK DATA  — replace the objects below with API responses
// ─────────────────────────────────────────────────────────────
const REPORT_DATA = {
    "August 2026": {
        period: "August 2026",
        generated: "31 August 2026",
        lastUpdated: "31 Aug 2026, 11:45 PM",
        transactionCount: "1,284",
        currency: "USD",
        revenue: {
            items: [
                { label: "Interest Income", amount: 142500 },
                { label: "Loan Processing Fees", amount: 18200 },
                { label: "Other Operating Income", amount: 23800 },
            ],
            total: 184500,
        },
        expenses: {
            items: [
                { label: "Staff Costs", amount: 52000 },
                { label: "Administrative Expenses", amount: 18500 },
                { label: "Technology & Infrastructure", amount: 12300 },
                { label: "Branch Operating Costs", amount: 31000 },
                { label: "Marketing & Outreach", amount: 8000 },
                { label: "Other Operating Expenses", amount: 11000 },
            ],
            total: 132800,
        },
        operatingProfit: 51700,
        otherIncome: [
            { label: "Other Income", amount: 2400 },
            { label: "Other Expenses", amount: -3100 },
        ],
        netProfit: 51000,
    },
    "July 2026": {
        period: "July 2026",
        generated: "31 July 2026",
        lastUpdated: "31 Jul 2026, 10:30 PM",
        transactionCount: "1,197",
        currency: "USD",
        revenue: {
            items: [
                { label: "Interest Income", amount: 138200 },
                { label: "Loan Processing Fees", amount: 16800 },
                { label: "Other Operating Income", amount: 21500 },
            ],
            total: 176500,
        },
        expenses: {
            items: [
                { label: "Staff Costs", amount: 52000 },
                { label: "Administrative Expenses", amount: 17900 },
                { label: "Technology & Infrastructure", amount: 12300 },
                { label: "Branch Operating Costs", amount: 29500 },
                { label: "Marketing & Outreach", amount: 7200 },
                { label: "Other Operating Expenses", amount: 9800 },
            ],
            total: 128700,
        },
        operatingProfit: 47800,
        otherIncome: [
            { label: "Other Income", amount: 1900 },
            { label: "Other Expenses", amount: -2800 },
        ],
        netProfit: 46900,
    },
    "June 2026": {
        period: "June 2026",
        generated: "30 June 2026",
        lastUpdated: "30 Jun 2026, 09:15 PM",
        transactionCount: "1,142",
        currency: "USD",
        revenue: {
            items: [
                { label: "Interest Income", amount: 131400 },
                { label: "Loan Processing Fees", amount: 15600 },
                { label: "Other Operating Income", amount: 19200 },
            ],
            total: 166200,
        },
        expenses: {
            items: [
                { label: "Staff Costs", amount: 52000 },
                { label: "Administrative Expenses", amount: 17200 },
                { label: "Technology & Infrastructure", amount: 12300 },
                { label: "Branch Operating Costs", amount: 27800 },
                { label: "Marketing & Outreach", amount: 6500 },
                { label: "Other Operating Expenses", amount: 8900 },
            ],
            total: 124700,
        },
        operatingProfit: 41500,
        otherIncome: [
            { label: "Other Income", amount: 1600 },
            { label: "Other Expenses", amount: -2500 },
        ],
        netProfit: 40600,
    },
}

const PERIODS = ["August 2026", "July 2026", "June 2026"]

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────
function fmt(amount) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.abs(amount))
}

function pctFmt(value) {
    return `${value.toFixed(1)}%`
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

/** One summary stat card */
function SummaryCard({ label, value, sub, positive }) {
    const isPositive = positive !== false
    return (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
                {label}
            </div>
            <div
                className={`text-2xl font-bold ${positive === true
                        ? "text-emerald-600 dark:text-emerald-400"
                        : positive === false
                            ? "text-red-500"
                            : "text-foreground"
                    }`}
            >
                {value}
            </div>
            {sub && (
                <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
            )}
        </div>
    )
}

/** A divider row in the P&L table */
function Divider() {
    return (
        <tr>
            <td colSpan={2} className="px-0 py-0">
                <div className="border-t border-border/70 mx-6" />
            </td>
        </tr>
    )
}

/** Section heading row */
function SectionHead({ label }) {
    return (
        <tr>
            <td
                colSpan={2}
                className="px-6 pt-5 pb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground"
            >
                {label}
            </td>
        </tr>
    )
}

/** A regular line-item row (indented) */
function LineItem({ label, amount, negative }) {
    return (
        <tr className="hover:bg-muted/20 transition-colors">
            <td className="pl-10 pr-6 py-2 text-sm text-foreground/80">{label}</td>
            <td className="pr-6 py-2 text-sm text-right font-mono text-foreground/80 tabular-nums">
                {negative ? `(${fmt(amount)})` : fmt(amount)}
            </td>
        </tr>
    )
}

/** A subtotal / total row */
function TotalRow({ label, amount, className = "", indent = false, highlight = false }) {
    const isNegative = amount < 0
    return (
        <tr
            className={`${highlight ? "bg-muted/30" : ""} ${className}`}
        >
            <td className={`${indent ? "pl-10" : "pl-6"} pr-6 py-2.5 text-sm font-semibold text-foreground`}>
                {label}
            </td>
            <td
                className={`pr-6 py-2.5 text-sm text-right font-mono font-semibold tabular-nums ${isNegative ? "text-red-500" : "text-foreground"
                    }`}
            >
                {isNegative ? `(${fmt(amount)})` : fmt(amount)}
            </td>
        </tr>
    )
}

/** The big Net Profit row */
function NetProfitRow({ amount }) {
    const isProfit = amount >= 0
    return (
        <tr className={`${isProfit ? "bg-emerald-500/8" : "bg-red-500/8"}`}>
            <td className="pl-6 pr-6 py-4 text-base font-bold text-foreground">
                NET {isProfit ? "PROFIT" : "LOSS"}
            </td>
            <td
                className={`pr-6 py-4 text-base text-right font-mono font-bold tabular-nums ${isProfit
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500"
                    }`}
            >
                {isProfit ? fmt(amount) : `(${fmt(amount)})`}
            </td>
        </tr>
    )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function PAndLReport() {
    const [period, setPeriod] = useState("August 2026")
    const data = REPORT_DATA[period]

    const netProfitMargin = ((data.netProfit / data.revenue.total) * 100).toFixed(1)
    const isProfit = data.netProfit >= 0

    /** Download placeholder — wire up real PDF/XLSX export here */
    function handleDownload() {
        const blob = new Blob(
            [
                `P&L Report — ${data.period}\n`,
                `Generated: ${data.generated}\n`,
                `Currency: ${data.currency}\n\n`,
                `Total Revenue: $${data.revenue.total.toLocaleString()}\n`,
                `Total Expenses: $${data.expenses.total.toLocaleString()}\n`,
                `Operating Profit: $${data.operatingProfit.toLocaleString()}\n`,
                `Net Profit: $${data.netProfit.toLocaleString()}\n`,
                `Net Profit Margin: ${netProfitMargin}%\n`,
            ],
            { type: "text/plain" }
        )
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `PnL_Report_${data.period.replace(" ", "_")}.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    function handlePrint() {
        window.print()
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
            {/* ── PAGE HEADER ── */}
            <header className="z-10 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border bg-background/80 px-8 py-6 backdrop-blur-md sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                        P&amp;L Report
                    </h1>
                    <div className="mt-1 text-sm text-muted-foreground">
                        Automatically generated profit and loss statement from financial transactions.
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Period selector */}
                    <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground">
                        <ChevronDown size={14} className="text-muted-foreground" />
                        <select
                            id="pl-period-selector"
                            className="bg-transparent border-none outline-none text-sm font-medium text-foreground cursor-pointer"
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            aria-label="reporting-period-selector"
                        >
                            {PERIODS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    {/* Print */}
                    <button
                        id="pl-print-btn"
                        onClick={handlePrint}
                        title="Print Report"
                        className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                        <Printer size={14} />
                        <span className="hidden sm:inline">Print</span>
                    </button>

                    {/* Download Report */}
                    <button
                        id="pl-download-btn"
                        onClick={handleDownload}
                        className="flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all"
                    >
                        <Download size={14} />
                        Download Report
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">

                {/* ── REPORT META / AUTO-GENERATED NOTICE ── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground border border-border/50 bg-muted/20 rounded-xl px-5 py-3">
                    <div className="flex items-center gap-2">
                        <FileText size={13} className="text-muted-foreground" />
                        <span>
                            Generated from{" "}
                            <span className="font-semibold text-foreground">{data.transactionCount}</span>{" "}
                            recorded transactions · Currency:{" "}
                            <span className="font-semibold text-foreground">{data.currency}</span> · Report Period:{" "}
                            <span className="font-semibold text-foreground">{data.period}</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <RefreshCw size={11} />
                        Last updated: <span className="font-medium">{data.lastUpdated}</span>
                    </div>
                </div>

                {/* ── SUMMARY CARDS ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard
                        label="Total Revenue"
                        value={fmt(data.revenue.total)}
                    />
                    <SummaryCard
                        label="Total Expenses"
                        value={fmt(data.expenses.total)}
                    />
                    <SummaryCard
                        label="Operating Profit"
                        value={fmt(data.operatingProfit)}
                        positive={data.operatingProfit >= 0}
                    />
                    <SummaryCard
                        label="Net Profit Margin"
                        value={pctFmt(parseFloat(netProfitMargin))}
                        sub={isProfit ? "Profitable period" : "Loss period"}
                        positive={isProfit}
                    />
                </div>

                {/* ── MAIN P&L STATEMENT ── */}
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    {/* Statement header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-6 py-4 border-b border-border">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">
                                Profit &amp; Loss Statement
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Reporting period: {data.period}
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Generated: {data.generated}</span>
                            <span>Currency: {data.currency}</span>
                        </div>
                    </div>

                    {/* Column headings */}
                    <div className="overflow-x-auto">
                        <table className="w-full" aria-label="profit-and-loss-statement">
                            <thead>
                                <tr className="border-b border-border/50">
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="pr-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {data.period.toUpperCase()}
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y-0">

                                {/* ── REVENUE ── */}
                                <SectionHead label="Revenue" />
                                {data.revenue.items.map((item) => (
                                    <LineItem key={item.label} label={item.label} amount={item.amount} />
                                ))}
                                <Divider />
                                <TotalRow label="Total Revenue" amount={data.revenue.total} />

                                {/* spacer */}
                                <tr><td colSpan={2} className="py-2" /></tr>

                                {/* ── OPERATING EXPENSES ── */}
                                <SectionHead label="Operating Expenses" />
                                {data.expenses.items.map((item) => (
                                    <LineItem key={item.label} label={item.label} amount={item.amount} />
                                ))}
                                <Divider />
                                <TotalRow label="Total Operating Expenses" amount={data.expenses.total} />

                                {/* spacer */}
                                <tr><td colSpan={2} className="py-2" /></tr>

                                {/* ── OPERATING PROFIT ── */}
                                <Divider />
                                <TotalRow
                                    label="Operating Profit"
                                    amount={data.operatingProfit}
                                    highlight
                                    className={data.operatingProfit >= 0
                                        ? "[&>td:last-child]:text-emerald-600 dark:[&>td:last-child]:text-emerald-400"
                                        : "[&>td:last-child]:text-red-500"}
                                />

                                {/* spacer */}
                                <tr><td colSpan={2} className="py-2" /></tr>

                                {/* ── OTHER INCOME / EXPENSES ── */}
                                <SectionHead label="Other Income / Expenses" />
                                {data.otherIncome.map((item) => (
                                    <LineItem
                                        key={item.label}
                                        label={item.label}
                                        amount={item.amount}
                                        negative={item.amount < 0}
                                    />
                                ))}

                                {/* spacer */}
                                <tr><td colSpan={2} className="py-2" /></tr>

                                {/* ── NET PROFIT / LOSS ── */}
                                <Divider />
                                <Divider />
                                <NetProfitRow amount={data.netProfit} />

                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/10">
                        <p className="text-xs text-muted-foreground">
                            This report was automatically compiled from{" "}
                            <span className="font-medium text-foreground">{data.transactionCount}</span>{" "}
                            categorized transactions recorded during {data.period}. Values are in{" "}
                            <span className="font-medium text-foreground">{data.currency}</span>.
                        </p>
                        <button
                            onClick={handleDownload}
                            className="flex shrink-0 items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all"
                        >
                            <Download size={13} />
                            Download Report
                        </button>
                    </div>
                </div>

                {/* ── REPORT INFORMATION ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: "Report Period", value: data.period },
                        { label: "Currency", value: data.currency },
                        { label: "Generated", value: data.generated },
                        { label: "Transaction Count", value: data.transactionCount },
                    ].map((info) => (
                        <div
                            key={info.label}
                            className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3"
                        >
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                {info.label}
                            </div>
                            <div className="text-sm font-medium text-foreground">{info.value}</div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    )
}
