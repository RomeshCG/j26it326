import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { CheckCircle2, FileText, Loader2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { approveApplication, getApplications } from "@/lib/m3-api"

function formatLkr(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"
  return `LKR ${n.toLocaleString("en-LK")}`
}

export default function PendingLoanApprovals() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [note, setNote] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await getApplications({ status: "submitted" })
      setRows(Array.isArray(list) ? list : [])
    } catch (err) {
      setError(err?.message || "Failed to load submitted applications")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleApprove(row) {
    setBusyId(row.id)
    setNote(null)
    setError(null)
    try {
      const result = await approveApplication(row.id, {
        approvedAmount: Number(row.requestedAmount),
        termMonths: row.requestedTermMonths || 12,
        decisionNotes: "Approved by branch manager after M1 risk review",
      })
      const loanId = result?.loan?.id
      setNote(
        loanId
          ? `Approved ${row.borrower?.fullName || "applicant"} — loan ${loanId} is pending disbursement.`
          : `Approved ${row.borrower?.fullName || "applicant"}.`
      )
      await load()
      if (loanId) {
        navigate("/loan-officer/disbursement", {
          state: {
            application: {
              fullName: row.borrower?.fullName || "Borrower",
              nic: row.borrower?.nicNumber || "—",
              product: row.product?.name || row.purpose || "Consumer loan",
              amount: Number(row.requestedAmount),
              tenure: String(row.requestedTermMonths || 12),
              district: "Colombo Head Office",
              riskScore: 77,
              riskLabel: "Low risk",
              applicationId: row.id,
              loanId,
              borrowerId: row.borrowerId,
            },
          },
        })
      }
    } catch (err) {
      setError(err?.message || "Approve failed")
    } finally {
      setBusyId(null)
    }
  }

  function openRiskReport(row) {
    const payload = row.wizardPayload?.form || {}
    navigate("/loan-officer/risk-report", {
      state: {
        applicationId: row.id,
        applicant: {
          name: row.borrower?.fullName || payload.fullName || "Applicant",
          nic: row.borrower?.nicNumber || payload.nic || "—",
          date: payload.applicationDate || new Date().toISOString().slice(0, 10),
        },
        loanAmount: Number(row.requestedAmount),
        product: row.product?.name || row.purpose || "Consumer loan",
        branch: payload.branch || "Colombo Head Office",
        features: {
          contract_amount: Number(row.requestedAmount),
          tenure: Number(row.requestedTermMonths) || 12,
          installment: Number(payload.installment) || undefined,
          interest_amount: payload.interestRate
            ? Math.round(
                (Number(row.requestedAmount) * Number(payload.interestRate)) / 100
              )
            : undefined,
          branch: payload.branch || "Colombo Head Office",
          product: row.product?.name || "Consumer loan",
          product_category: row.product?.productCategory || "Consumer",
          product_type: "Monthly",
        },
      },
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            M3 · Loan pipeline
          </p>
          <h2 className="text-base font-semibold tracking-tight">Pending loan approvals</h2>
          <p className="text-xs text-muted-foreground">
            Submitted applications waiting for branch manager approve (creates loan for
            disbursement).
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={load}>
          Refresh
        </Button>
      </div>

      <div className="space-y-3 p-4">
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {note ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
            {note}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading submitted applications…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No submitted applications. Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run seed:ruwani</code>{" "}
            in <code className="rounded bg-muted px-1.5 py-0.5 text-xs">backend/</code>.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {row.borrower?.fullName || "Unnamed borrower"}
                    </p>
                    <Badge variant="outline">submitted</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.borrower?.nicNumber || "—"} · {row.product?.name || row.purpose || "Loan"}{" "}
                    · {formatLkr(row.requestedAmount)} · {row.requestedTermMonths || "—"} mo
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{row.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => openRiskReport(row)}
                  >
                    <FileText />
                    Risk report
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer"
                    disabled={busyId === row.id}
                    onClick={() => handleApprove(row)}
                  >
                    {busyId === row.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <ShieldCheck />
                    )}
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="size-3.5" />
          After approve, confirm disbursement to activate the loan.{" "}
          <Link to="/loan-officer/borrowers" className="text-primary underline-offset-2 hover:underline">
            Borrower list
          </Link>
        </p>
      </div>
    </div>
  )
}
