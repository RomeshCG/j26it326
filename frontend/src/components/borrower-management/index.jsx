import { useMemo, useState } from "react"
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

import {
  BORROWER_FILTERS,
  BORROWERS,
  PRODUCT_FILTERS,
  filterBorrowers,
  formatLkr,
  loanCategoryMeta,
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

  const productFilterCounts = useMemo(() => {
    const counts = { all: BORROWERS.length }
    for (const filter of PRODUCT_FILTERS) {
      if (filter.id === "all") continue
      counts[filter.id] = filterBorrowers(BORROWERS, "all", "", filter.id).length
    }
    return counts
  }, [])

  const filterCounts = useMemo(() => {
    const base = filterBorrowers(BORROWERS, "all", "", productFilter)
    const counts = { all: base.length }
    for (const filter of BORROWER_FILTERS) {
      if (filter.id === "all") continue
      counts[filter.id] = filterBorrowers(base, filter.id, "", productFilter).length
    }
    return counts
  }, [productFilter])

  const filteredBorrowers = useMemo(
    () => filterBorrowers(BORROWERS, activeFilter, search, productFilter),
    [activeFilter, search, productFilter]
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
            Search and filter borrowers by product and risk band. Use{" "}
            <span className="font-medium text-foreground">View profile</span> to open
            pre-filled demo applications without entering data manually.
          </p>
        </div>
        <Button
          type="button"
          className="cursor-pointer"
          onClick={() => onNewApplication?.()}
        >
          New application
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total borrowers
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {BORROWERS.length}
          </p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Early warning
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-destructive">
            {filterCounts.ews}
          </p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending review
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {BORROWERS.filter((b) => b.status === "pending").length}
          </p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            With application profile
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {BORROWERS.filter((b) => b.applicationId).length}
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
                    <td className="px-4 py-3 tabular-nums">{borrower.riskScore}</td>
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
