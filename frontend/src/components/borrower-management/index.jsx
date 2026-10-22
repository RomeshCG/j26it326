import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronRight, ClipboardList, FileText, Search, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getApplications, getBorrowers } from "@/lib/m3-api"

import {
  BORROWER_FILTERS,
  BORROWERS,
  PRODUCT_FILTERS,
  filterBorrowers,
  formatLkr,
  loanCategoryMeta,
  mapApiBorrowerToRow,
  riskBandMeta,
} from "./mock-data"

function FilterButton({ active, label, count, onClick }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="cursor-pointer"
    >
      {label}
      <span className="ml-1 tabular-nums opacity-80">({count})</span>
    </Button>
  )
}

/** Prefer demo mock when API fails, is empty, or user forces demo mode. */
function buildLiveRows(apiBorrowers, applications) {
  const appsByBorrower = new Map()
  for (const app of applications || []) {
    if (!app?.borrowerId) continue
    const prev = appsByBorrower.get(app.borrowerId)
    if (!prev || String(app.createdAt || "") > String(prev.createdAt || "")) {
      appsByBorrower.set(app.borrowerId, app)
    }
  }

  return (apiBorrowers || []).map((row) => {
    const app = appsByBorrower.get(row.id)
    return mapApiBorrowerToRow(row, {
      applicationId: app?.id || null,
      product: app?.product?.name || app?.purpose || undefined,
      loanCategory: "consumer",
      status: app?.status === "draft" || app?.status === "submitted" ? "pending" : undefined,
    })
  })
}

export default function BorrowerManagement({
  onOpenRiskReport,
  onOpenLoan,
  onOpenAlert,
  onNewApplication,
  onViewApplication,
  onContinueApplication,
}) {
  const [activeFilter, setActiveFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const [search, setSearch] = useState("")

  const [liveRows, setLiveRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  /** "auto" = live if available else mock; "live" = live only; "mock" = force demo list */
  const [dataMode, setDataMode] = useState("auto")

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [borrowers, applications] = await Promise.all([
          getBorrowers(),
          getApplications().catch(() => []),
        ])
        if (cancelled) return
        const list = Array.isArray(borrowers) ? borrowers : []
        const apps = Array.isArray(applications) ? applications : []
        setLiveRows(buildLiveRows(list, apps))
      } catch (err) {
        if (cancelled) return
        setError(err?.message || "Failed to load borrowers")
        setLiveRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const usingMock =
    dataMode === "mock" ||
    (dataMode === "auto" && (!loading && (error || liveRows.length === 0)))

  const borrowers = usingMock ? BORROWERS : liveRows

  const productFilterCounts = useMemo(() => {
    const counts = { all: borrowers.length }
    for (const filter of PRODUCT_FILTERS) {
      if (filter.id === "all") continue
      counts[filter.id] = filterBorrowers(borrowers, "all", "", filter.id).length
    }
    return counts
  }, [borrowers])

  const filterCounts = useMemo(() => {
    const base = filterBorrowers(borrowers, "all", "", productFilter)
    const counts = { all: base.length }
    for (const filter of BORROWER_FILTERS) {
      if (filter.id === "all") continue
      counts[filter.id] = filterBorrowers(base, filter.id, "", productFilter).length
    }
    return counts
  }, [borrowers, productFilter])

  const filteredBorrowers = useMemo(
    () => filterBorrowers(borrowers, activeFilter, search, productFilter),
    [borrowers, activeFilter, search, productFilter]
  )

  function handleRowAction(borrower) {
    if (borrower.status === "pending" || !borrower.loanId) {
      onOpenRiskReport?.(borrower)
      return
    }
    onOpenLoan?.(borrower.loanId)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Portfolio · C1 &amp; C3 entry point
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Borrower Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Live list from <span className="font-medium text-foreground">GET /api/m3/borrowers</span>
            . Switch to demo mock when you need a full risk/EWS showcase with empty DB.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={usingMock ? "outline" : "secondary"}
            size="sm"
            className="cursor-pointer"
            disabled={loading}
            onClick={() => setDataMode("live")}
          >
            Live API
          </Button>
          <Button
            type="button"
            variant={usingMock ? "secondary" : "outline"}
            size="sm"
            className="cursor-pointer"
            onClick={() => setDataMode("mock")}
          >
            Demo mock
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => onNewApplication?.()}
          >
            New application
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Loading borrowers from M3 API…
        </div>
      ) : null}

      {!loading && usingMock ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Showing <span className="font-medium">demo mock borrowers</span>
          {error
            ? ` (API unavailable: ${error})`
            : liveRows.length === 0
              ? " (no rows in tenant DB yet — create borrowers via M3 or keep mock for the viva)"
              : " (manual Demo mock mode)"}
          . Risk / EWS columns are richer in mock; live list uses real NIC/name/status from the
          database.
        </div>
      ) : null}

      {!loading && !usingMock && error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Live API failed: {error}. Switch to <span className="font-medium">Demo mock</span> for
          the showcase list, or fix auth / M3 backend.
        </div>
      ) : null}

      {!loading && !usingMock && !error ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-800 dark:text-emerald-200">
          Live data from /api/m3/borrowers ({liveRows.length} row
          {liveRows.length === 1 ? "" : "s"}). Risk score / EWS flags appear when M3 links loans
          and alerts to the list.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total borrowers
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {borrowers.length}
          </p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Early warning
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-destructive">
            {filterCounts.ews ?? 0}
          </p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending review
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {borrowers.filter((b) => b.status === "pending").length}
          </p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            With application profile
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {borrowers.filter((b) => b.applicationId).length}
          </p>
        </Card>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="space-y-4 border-b border-border/50 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">Borrower list</CardTitle>
            <CardDescription>
              {filteredBorrowers.length} borrower
              {filteredBorrowers.length === 1 ? "" : "s"} shown
              {usingMock ? " · mock" : " · live"}
            </CardDescription>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, NIC, branch, loan ID…"
              className="h-9 pl-8"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {PRODUCT_FILTERS.map((filter) => (
              <FilterButton
                key={filter.id}
                active={productFilter === filter.id}
                label={filter.label}
                count={productFilterCounts[filter.id]}
                onClick={() => setProductFilter(filter.id)}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {BORROWER_FILTERS.map((filter) => (
              <FilterButton
                key={filter.id}
                active={activeFilter === filter.id}
                label={filter.label}
                count={filterCounts[filter.id]}
                onClick={() => setActiveFilter(filter.id)}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Borrower</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Outstanding</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBorrowers.map((borrower) => {
                const risk = riskBandMeta(borrower.riskBand)
                const category = loanCategoryMeta(borrower.loanCategory)
                const isPending = borrower.status === "pending"

                return (
                  <tr
                    key={borrower.id}
                    className={`border-b last:border-b-0 ${
                      borrower.ews ? "bg-destructive/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleRowAction(borrower)}
                        className="cursor-pointer text-left transition-opacity hover:opacity-80"
                      >
                        <p className="font-medium">{borrower.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {borrower.nic}
                          {borrower.loanId ? ` · ${borrower.loanId}` : ""}
                        </p>
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {borrower.branch}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="space-y-1">
                        <p>{borrower.product}</p>
                        <Badge variant={category.variant} className="text-[10px]">
                          {category.label}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={risk.className}>{risk.label}</Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {borrower.riskScore != null ? borrower.riskScore : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {borrower.outstanding > 0
                        ? formatLkr(borrower.outstanding)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={isPending ? "outline" : "secondary"}>
                          {isPending ? "Pending" : "Active"}
                        </Badge>
                        {borrower.ews ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="size-3" />
                            EWS
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() =>
                            borrower.applicationId
                              ? onViewApplication?.(borrower.applicationId)
                              : onNewApplication?.()
                          }
                        >
                          <ClipboardList />
                          {borrower.applicationId ? "View profile" : "New application"}
                        </Button>
                        {borrower.applicationId && borrower.status === "pending" ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => onContinueApplication?.(borrower.applicationId)}
                          >
                            Continue draft
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => onOpenRiskReport?.(borrower)}
                        >
                          <FileText />
                          Risk report
                        </Button>
                        {borrower.loanId ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => onOpenLoan?.(borrower.loanId)}
                          >
                            Loan
                            <ChevronRight />
                          </Button>
                        ) : null}
                        {borrower.alertId ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => onOpenAlert?.(borrower.alertId)}
                          >
                            <ShieldAlert />
                            Alert
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filteredBorrowers.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No borrowers match this filter.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
