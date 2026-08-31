import React, { useState, useMemo, useCallback } from "react"
import {
    TrendingUp,
    TrendingDown,
    Download,
    Printer,
    ChevronDown,
    FileText,
    RefreshCw,
    Plus,
    X,
    Trash2,
    AlertTriangle,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const PERIODS = ["August 2026", "July 2026", "June 2026"]

/** Map period label → { year, month (0‑indexed) } for date filtering */
const PERIOD_MAP = {
    "August 2026": { year: 2026, month: 7 },
    "July 2026": { year: 2026, month: 6 },
    "June 2026": { year: 2026, month: 5 },
}

const BRANCHES = [
    "All Branches",
    "Colombo Branch",
    "Kandy Branch",
    "Galle Branch",
    "Jaffna Branch",
    "Head Office",
]

const REVENUE_CATEGORIES = [
    "Interest Income",
    "Service Fees",
    "Other Income",
]

const EXPENSE_CATEGORIES = [
    "Staff Costs",
    "Operational Expenses",
    "Administrative Costs",
    "Utilities",
]

const CURRENCY = "USD"

// ─────────────────────────────────────────────────────────────
// INITIAL MOCK TRANSACTIONS
// Structured for future API/database replacement.
// ─────────────────────────────────────────────────────────────

let _nextId = 100

const INITIAL_TRANSACTIONS = [
    // ── August 2026 ──
    { id: 1, date: "2026-08-28", type: "Revenue", category: "Interest Income", amount: 142500, branch: "Colombo Branch", description: "Monthly loan interest collection" },
    { id: 2, date: "2026-08-25", type: "Revenue", category: "Service Fees", amount: 18200, branch: "Kandy Branch", description: "Loan processing fees" },
    { id: 3, date: "2026-08-22", type: "Revenue", category: "Other Income", amount: 23800, branch: "Head Office", description: "Miscellaneous operating income" },
    { id: 4, date: "2026-08-20", type: "Expense", category: "Staff Costs", amount: 52000, branch: "Head Office", description: "Monthly payroll — all branches" },
    { id: 5, date: "2026-08-18", type: "Expense", category: "Administrative Costs", amount: 18500, branch: "Head Office", description: "Office supplies and admin" },
    { id: 6, date: "2026-08-15", type: "Expense", category: "Operational Expenses", amount: 12300, branch: "Colombo Branch", description: "Technology infrastructure" },
    { id: 7, date: "2026-08-12", type: "Expense", category: "Operational Expenses", amount: 31000, branch: "Galle Branch", description: "Branch operating costs" },
    { id: 8, date: "2026-08-10", type: "Expense", category: "Utilities", amount: 8000, branch: "Jaffna Branch", description: "Electricity and water" },
    { id: 9, date: "2026-08-05", type: "Expense", category: "Operational Expenses", amount: 11000, branch: "Kandy Branch", description: "Other operating expenses" },

    // ── July 2026 ──
    { id: 10, date: "2026-07-28", type: "Revenue", category: "Interest Income", amount: 138200, branch: "Colombo Branch", description: "Monthly loan interest collection" },
    { id: 11, date: "2026-07-25", type: "Revenue", category: "Service Fees", amount: 16800, branch: "Kandy Branch", description: "Loan processing fees" },
    { id: 12, date: "2026-07-20", type: "Revenue", category: "Other Income", amount: 21500, branch: "Head Office", description: "Miscellaneous income" },
    { id: 13, date: "2026-07-18", type: "Expense", category: "Staff Costs", amount: 52000, branch: "Head Office", description: "Monthly payroll" },
    { id: 14, date: "2026-07-15", type: "Expense", category: "Administrative Costs", amount: 17900, branch: "Head Office", description: "Admin costs" },
    { id: 15, date: "2026-07-12", type: "Expense", category: "Operational Expenses", amount: 12300, branch: "Colombo Branch", description: "Technology" },
    { id: 16, date: "2026-07-10", type: "Expense", category: "Operational Expenses", amount: 29500, branch: "Galle Branch", description: "Branch costs" },
    { id: 17, date: "2026-07-05", type: "Expense", category: "Utilities", amount: 7200, branch: "Jaffna Branch", description: "Utilities" },
    { id: 18, date: "2026-07-03", type: "Expense", category: "Operational Expenses", amount: 9800, branch: "Kandy Branch", description: "Other expenses" },

    // ── June 2026 ──
    { id: 19, date: "2026-06-28", type: "Revenue", category: "Interest Income", amount: 131400, branch: "Colombo Branch", description: "Monthly loan interest collection" },
    { id: 20, date: "2026-06-25", type: "Revenue", category: "Service Fees", amount: 15600, branch: "Kandy Branch", description: "Loan processing fees" },
    { id: 21, date: "2026-06-20", type: "Revenue", category: "Other Income", amount: 19200, branch: "Head Office", description: "Miscellaneous income" },
    { id: 22, date: "2026-06-18", type: "Expense", category: "Staff Costs", amount: 52000, branch: "Head Office", description: "Monthly payroll" },
    { id: 23, date: "2026-06-15", type: "Expense", category: "Administrative Costs", amount: 17200, branch: "Head Office", description: "Admin costs" },
    { id: 24, date: "2026-06-12", type: "Expense", category: "Operational Expenses", amount: 12300, branch: "Colombo Branch", description: "Technology" },
    { id: 25, date: "2026-06-10", type: "Expense", category: "Operational Expenses", amount: 27800, branch: "Galle Branch", description: "Branch costs" },
    { id: 26, date: "2026-06-05", type: "Expense", category: "Utilities", amount: 6500, branch: "Jaffna Branch", description: "Utilities" },
    { id: 27, date: "2026-06-03", type: "Expense", category: "Operational Expenses", amount: 8900, branch: "Kandy Branch", description: "Other expenses" },
]

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
    if (!isFinite(value)) return "0.0%"
    return `${value.toFixed(1)}%`
}

function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

/** Filter transactions by selected period and branch */
function filterTransactions(transactions, period, branch) {
    const pm = PERIOD_MAP[period]
    if (!pm) return []
    return transactions.filter((t) => {
        const d = new Date(t.date)
        const matchMonth = d.getFullYear() === pm.year && d.getMonth() === pm.month
        const matchBranch = branch === "All Branches" || t.branch === branch
        return matchMonth && matchBranch
    })
}

/** Group transactions by category and compute totals */
function computePnL(filtered) {
    const revenueByCategory = {}
    const expenseByCategory = {}
    let totalRevenue = 0
    let totalExpenses = 0

    for (const t of filtered) {
        if (t.type === "Revenue") {
            revenueByCategory[t.category] = (revenueByCategory[t.category] || 0) + t.amount
            totalRevenue += t.amount
        } else {
            expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount
            totalExpenses += t.amount
        }
    }

    const netProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    return {
        revenueItems: Object.entries(revenueByCategory).map(([label, amount]) => ({ label, amount })),
        expenseItems: Object.entries(expenseByCategory).map(([label, amount]) => ({ label, amount })),
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        transactionCount: filtered.length,
    }
}

// ─────────────────────────────────────────────────────────────
// P&L TABLE SUB-COMPONENTS (preserved from existing page)
// ─────────────────────────────────────────────────────────────

function Divider() {
    return (
        <tr>
            <td colSpan={2} className="px-0 py-0">
                <div className="border-t border-border/70 mx-6" />
            </td>
        </tr>
    )
}

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

function LineItem({ label, amount }) {
    return (
        <tr className="hover:bg-muted/20 transition-colors">
            <td className="pl-10 pr-6 py-2 text-sm text-foreground/80">{label}</td>
            <td className="pr-6 py-2 text-sm text-right font-mono text-foreground/80 tabular-nums">
                {fmt(amount)}
            </td>
        </tr>
    )
}

function TotalRow({ label, amount, highlight = false, className = "" }) {
    const isNeg = amount < 0
    return (
        <tr className={`${highlight ? "bg-muted/30" : ""} ${className}`}>
            <td className="pl-6 pr-6 py-2.5 text-sm font-semibold text-foreground">{label}</td>
            <td
                className={`pr-6 py-2.5 text-sm text-right font-mono font-semibold tabular-nums ${isNeg ? "text-red-500" : "text-foreground"}`}
            >
                {isNeg ? `(${fmt(amount)})` : fmt(amount)}
            </td>
        </tr>
    )
}

function NetProfitRow({ amount }) {
    const isProfit = amount >= 0
    return (
        <tr className={isProfit ? "bg-emerald-500/8" : "bg-red-500/8"}>
            <td className="pl-6 pr-6 py-4 text-base font-bold text-foreground">
                NET {isProfit ? "PROFIT" : "LOSS"}
            </td>
            <td
                className={`pr-6 py-4 text-base text-right font-mono font-bold tabular-nums ${isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
            >
                {isProfit ? fmt(amount) : `(${fmt(amount)})`}
            </td>
        </tr>
    )
}

/** Summary stat card */
function SummaryCard({ label, value, sub, positive }) {
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
            {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// ADD TRANSACTION MODAL
// ─────────────────────────────────────────────────────────────

const EMPTY_FORM = {
    type: "",
    category: "",
    amount: "",
    date: "",
    branch: "",
    description: "",
}

function AddTransactionModal({ open, onClose, onAdd }) {
    const [form, setForm] = useState({ ...EMPTY_FORM })
    const [errors, setErrors] = useState({})

    const set = useCallback((field, value) => {
        setForm((prev) => {
            const next = { ...prev, [field]: value }
            // Reset category when type changes
            if (field === "type") next.category = ""
            return next
        })
        setErrors((prev) => ({ ...prev, [field]: undefined }))
    }, [])

    const validate = useCallback(() => {
        const e = {}
        if (!form.type) e.type = "Transaction type is required"
        if (!form.category) e.category = "Category is required"
        if (!form.amount || Number(form.amount) <= 0) e.amount = "Amount must be greater than 0"
        if (!form.date) e.date = "Date is required"
        if (!form.branch) e.branch = "Branch is required"
        setErrors(e)
        return Object.keys(e).length === 0
    }, [form])

    const handleSubmit = useCallback((e) => {
        e.preventDefault()
        if (!validate()) return
        onAdd({
            id: ++_nextId,
            date: form.date,
            type: form.type,
            category: form.category,
            amount: Number(form.amount),
            branch: form.branch,
            description: form.description.trim(),
        })
        setForm({ ...EMPTY_FORM })
        setErrors({})
        onClose()
    }, [form, validate, onAdd, onClose])

    const handleCancel = useCallback(() => {
        setForm({ ...EMPTY_FORM })
        setErrors({})
        onClose()
    }, [onClose])

    if (!open) return null

    const categories = form.type === "Revenue" ? REVENUE_CATEGORIES : form.type === "Expense" ? EXPENSE_CATEGORIES : []

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />

            {/* Dialog */}
            <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl mx-4">
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-base font-semibold text-foreground">Add Financial Transaction</h2>
                    <button
                        onClick={handleCancel}
                        className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                        aria-label="close-modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

                    {/* Transaction Type */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Transaction Type <span className="text-red-400">*</span>
                        </label>
                        <div className="flex gap-2">
                            {["Revenue", "Expense"].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => set("type", t)}
                                    className={[
                                        "flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                                        form.type === t
                                            ? t === "Revenue"
                                                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                : "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                            : "border-border bg-muted/20 text-foreground hover:bg-muted/40",
                                    ].join(" ")}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        {errors.type && <p className="text-xs text-red-400 mt-1">{errors.type}</p>}
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Category <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={form.category}
                            onChange={(e) => set("category", e.target.value)}
                            disabled={!form.type}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-40"
                        >
                            <option value="">Select category</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        {errors.category && <p className="text-xs text-red-400 mt-1">{errors.category}</p>}
                    </div>

                    {/* Amount + Date row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                Amount (USD) <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                step="any"
                                value={form.amount}
                                onChange={(e) => set("amount", e.target.value)}
                                placeholder="0"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40 tabular-nums"
                            />
                            {errors.amount && <p className="text-xs text-red-400 mt-1">{errors.amount}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                Date <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => set("date", e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40"
                            />
                            {errors.date && <p className="text-xs text-red-400 mt-1">{errors.date}</p>}
                        </div>
                    </div>

                    {/* Branch */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Branch <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={form.branch}
                            onChange={(e) => set("branch", e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40"
                        >
                            <option value="">Select branch</option>
                            {BRANCHES.filter((b) => b !== "All Branches").map((b) => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                        {errors.branch && <p className="text-xs text-red-400 mt-1">{errors.branch}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Description <span className="text-muted-foreground font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={form.description}
                            onChange={(e) => set("description", e.target.value)}
                            placeholder="Brief description"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                    </div>
                </form>

                {/* Modal footer */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all"
                    >
                        Add Transaction
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// DELETE CONFIRMATION MODAL
// ─────────────────────────────────────────────────────────────

function DeleteConfirmModal({ open, transaction, onConfirm, onCancel }) {
    if (!open || !transaction) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl mx-4 p-6">
                <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={18} className="text-amber-500" />
                    <h3 className="text-base font-semibold text-foreground">Delete Transaction</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                    Are you sure you want to delete this transaction?
                </p>
                <div className="text-sm text-foreground font-medium mb-4">
                    {transaction.category} — {fmt(transaction.amount)} ({transaction.type})
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(transaction.id)}
                        className="rounded-lg bg-red-600 hover:bg-red-700 active:scale-[0.98] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function PAndLReport() {
    // ── State ──
    const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS)
    const [period, setPeriod] = useState("August 2026")
    const [branch, setBranch] = useState("All Branches")
    const [modalOpen, setModalOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)

    // ── Filtered & calculated ──
    const filtered = useMemo(() => filterTransactions(transactions, period, branch), [transactions, period, branch])
    const pnl = useMemo(() => computePnL(filtered), [filtered])
    const sortedHistory = useMemo(
        () => [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)),
        [filtered]
    )

    const isProfit = pnl.netProfit >= 0

    // ── Handlers ──
    const handleAdd = useCallback((txn) => {
        setTransactions((prev) => [...prev, txn])
    }, [])

    const handleDelete = useCallback((id) => {
        setTransactions((prev) => prev.filter((t) => t.id !== id))
        setDeleteTarget(null)
    }, [])

    /** Download – exports current filtered P&L as text */
    function handleDownload() {
        const lines = [
            `P&L Report — ${period}${branch !== "All Branches" ? ` · ${branch}` : ""}`,
            `Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`,
            `Currency: ${CURRENCY}`,
            ``,
            `=== REVENUE ===`,
            ...pnl.revenueItems.map((r) => `  ${r.label}: $${r.amount.toLocaleString()}`),
            `  Total Revenue: $${pnl.totalRevenue.toLocaleString()}`,
            ``,
            `=== EXPENSES ===`,
            ...pnl.expenseItems.map((r) => `  ${r.label}: $${r.amount.toLocaleString()}`),
            `  Total Expenses: $${pnl.totalExpenses.toLocaleString()}`,
            ``,
            `=== SUMMARY ===`,
            `  Net Profit: $${pnl.netProfit.toLocaleString()}`,
            `  Profit Margin: ${pctFmt(pnl.profitMargin)}`,
            `  Transactions: ${pnl.transactionCount}`,
            ``,
            `--- End of Report ---`,
        ]
        const blob = new Blob([lines.join("\n")], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `PnL_Report_${period.replace(" ", "_")}${branch !== "All Branches" ? `_${branch.replace(" ", "_")}` : ""}.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    function handlePrint() {
        window.print()
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">

            {/* ── PAGE HEADER (existing style preserved) ── */}
            <header className="z-10 flex shrink-0 flex-col items-start justify-between gap-4 border-b border-border bg-background/80 px-8 py-6 backdrop-blur-md sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                        P&amp;L Report
                    </h1>
                    <div className="mt-1 text-sm text-muted-foreground">
                        Profit &amp; Loss Statement
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* + Add Transaction */}
                    <button
                        id="pl-add-txn-btn"
                        onClick={() => setModalOpen(true)}
                        className="flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all"
                    >
                        <Plus size={14} />
                        Add Transaction
                    </button>

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

                    {/* Branch filter */}
                    <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground">
                        <ChevronDown size={14} className="text-muted-foreground" />
                        <select
                            id="pl-branch-selector"
                            className="bg-transparent border-none outline-none text-sm font-medium text-foreground cursor-pointer"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            aria-label="branch-selector"
                        >
                            {BRANCHES.map((b) => (
                                <option key={b} value={b}>{b}</option>
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

                    {/* Download */}
                    <button
                        id="pl-download-btn"
                        onClick={handleDownload}
                        className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                        <Download size={14} />
                        <span className="hidden sm:inline">Download Report</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">

                {/* ── REPORT META ── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground border border-border/50 bg-muted/20 rounded-xl px-5 py-3">
                    <div className="flex items-center gap-2">
                        <FileText size={13} className="text-muted-foreground" />
                        <span>
                            Generated from{" "}
                            <span className="font-semibold text-foreground">{pnl.transactionCount}</span>{" "}
                            recorded transactions · Currency:{" "}
                            <span className="font-semibold text-foreground">{CURRENCY}</span> · Report Period:{" "}
                            <span className="font-semibold text-foreground">{period}</span>
                            {branch !== "All Branches" && (
                                <>
                                    {" "}· Branch:{" "}
                                    <span className="font-semibold text-foreground">{branch}</span>
                                </>
                            )}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <RefreshCw size={11} />
                        Auto-calculated from transactions
                    </div>
                </div>

                {/* ── SUMMARY CARDS (dynamically calculated) ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard
                        label="Total Revenue"
                        value={fmt(pnl.totalRevenue)}
                    />
                    <SummaryCard
                        label="Total Expenses"
                        value={fmt(pnl.totalExpenses)}
                    />
                    <SummaryCard
                        label="Net Profit"
                        value={isProfit ? fmt(pnl.netProfit) : `(${fmt(pnl.netProfit)})`}
                        positive={isProfit}
                        sub={isProfit ? "Profitable period" : "Loss period"}
                    />
                    <SummaryCard
                        label="Profit Margin"
                        value={pctFmt(pnl.profitMargin)}
                        positive={pnl.profitMargin > 0}
                    />
                </div>

                {/* ── MAIN P&L STATEMENT (dynamically generated) ── */}
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    {/* Statement header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-6 py-4 border-b border-border">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">
                                Profit &amp; Loss Statement
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Reporting period: {period}
                                {branch !== "All Branches" && ` · ${branch}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Currency: {CURRENCY}</span>
                            <span>Transactions: {pnl.transactionCount}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full" aria-label="profit-and-loss-statement">
                            <thead>
                                <tr className="border-b border-border/50">
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="pr-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {period.toUpperCase()}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-0">

                                {/* ── REVENUE ── */}
                                <SectionHead label="Revenue" />
                                {pnl.revenueItems.length > 0 ? (
                                    pnl.revenueItems.map((item) => (
                                        <LineItem key={item.label} label={item.label} amount={item.amount} />
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="pl-10 py-2 text-sm text-muted-foreground italic">
                                            No revenue transactions recorded
                                        </td>
                                    </tr>
                                )}
                                <Divider />
                                <TotalRow label="Total Revenue" amount={pnl.totalRevenue} />

                                <tr><td colSpan={2} className="py-2" /></tr>

                                {/* ── EXPENSES ── */}
                                <SectionHead label="Expenses" />
                                {pnl.expenseItems.length > 0 ? (
                                    pnl.expenseItems.map((item) => (
                                        <LineItem key={item.label} label={item.label} amount={item.amount} />
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={2} className="pl-10 py-2 text-sm text-muted-foreground italic">
                                            No expense transactions recorded
                                        </td>
                                    </tr>
                                )}
                                <Divider />
                                <TotalRow label="Total Expenses" amount={pnl.totalExpenses} />

                                <tr><td colSpan={2} className="py-2" /></tr>

                                {/* ── NET PROFIT / LOSS ── */}
                                <Divider />
                                <Divider />
                                <NetProfitRow amount={pnl.netProfit} />

                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/10">
                        <p className="text-xs text-muted-foreground">
                            This report was automatically compiled from{" "}
                            <span className="font-medium text-foreground">{pnl.transactionCount}</span>{" "}
                            categorized transactions recorded during {period}. Values are in{" "}
                            <span className="font-medium text-foreground">{CURRENCY}</span>.
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

                {/* ── RECENT FINANCIAL TRANSACTIONS ── */}
                <div id="ledger" className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden scroll-mt-20">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">
                                Transaction ledger
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {pnl.transactionCount} transactions for {period}
                                {branch !== "All Branches" && ` · ${branch}`}
                            </p>
                        </div>
                        <button
                            onClick={() => setModalOpen(true)}
                            className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        >
                            <Plus size={13} />
                            Add
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm" aria-label="transaction-history">
                            <thead>
                                <tr className="border-b border-border/50">
                                    {["Date", "Category", "Type", "Amount", "Branch", "Description", ""].map((col) => (
                                        <th
                                            key={col || "actions"}
                                            className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {sortedHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                                            No transactions for this period.
                                        </td>
                                    </tr>
                                )}
                                {sortedHistory.map((txn) => (
                                    <tr key={txn.id} className="transition-colors hover:bg-muted/20">
                                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                                            {formatDate(txn.date)}
                                        </td>
                                        <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">
                                            {txn.category}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${txn.type === "Revenue"
                                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                                    }`}
                                            >
                                                {txn.type}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 font-mono tabular-nums font-medium text-foreground whitespace-nowrap">
                                            {fmt(txn.amount)}
                                        </td>
                                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">
                                            {txn.branch}
                                        </td>
                                        <td className="px-5 py-3 text-muted-foreground max-w-[200px] truncate">
                                            {txn.description || "—"}
                                        </td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => setDeleteTarget(txn)}
                                                title="Delete transaction"
                                                className="rounded-md p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── REPORT INFORMATION ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: "Report Period", value: period },
                        { label: "Currency", value: "LKR (Rs.)" },
                        { label: "Branch", value: branch },
                        { label: "Transaction Count", value: `${pnl.transactionCount} Transactions` },
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

            {/* ── MODALS ── */}
            <AddTransactionModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onAdd={handleAdd}
            />
            <DeleteConfirmModal
                open={!!deleteTarget}
                transaction={deleteTarget}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    )
}
