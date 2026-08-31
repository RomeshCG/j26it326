import { useState } from "react"
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  Phone,
  ShieldAlert,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import {
  BorrowerDistressTimeline,
  TemporalSignalFusionSummary,
} from "./TemporalSignalFusion"
import { ALERTS, formatLkr } from "./mock-data"
import SlopeChart from "./SlopeChart"

const INTERVENTIONS = [
  { id: "call", label: "Phone Call" },
  { id: "visit", label: "Field Visit" },
  { id: "restructure", label: "Loan Restructure" },
  { id: "grace", label: "Grace Period" },
]

export default function EwsAlertDetail({ alertId, onBack }) {
  const alert = ALERTS[alertId] ?? ALERTS["EWS-1042"]
  const [selected, setSelected] = useState(null)
  const [outcome, setOutcome] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const probability = alert.distressProbability
  const threshold = alert.threshold

  function handleSave() {
    if (!selected || !outcome.trim()) return
    setSaving(true)
    window.setTimeout(() => {
      setSaving(false)
      setSaved(true)
    }, 700)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <Button type="button" variant="ghost" onClick={onBack} className="cursor-pointer">
        <ArrowLeft />
        Back to early warning dashboard
      </Button>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            EWS alert · {alert.id}
          </p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {alert.borrower}
              </CardTitle>
              <CardDescription>
                {alert.loanId} · {alert.product} · {alert.group}
              </CardDescription>
            </div>
            <Badge variant="destructive">
              <ShieldAlert className="size-3.5" />
              Distress {probability}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Outstanding
            </p>
            <p className="mt-1 text-sm font-medium tabular-nums">{formatLkr(alert.outstanding)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Installment
            </p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {formatLkr(alert.installment)} · {alert.cycle}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Disbursed
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              <CalendarClock className="size-3.5 text-muted-foreground" />
              {alert.disbursed}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contact
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              <Phone className="size-3.5 text-muted-foreground" />
              {alert.phone}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardDescription className="text-xs uppercase tracking-wide">
            Temporal analysis
          </CardDescription>
          <CardTitle className="text-base font-semibold">Borrower distress timeline</CardTitle>
          <CardDescription>
            Behavioural signals tracked across recent collection cycles
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <BorrowerDistressTimeline timeline={alert.distressTimeline} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardDescription className="text-xs uppercase tracking-wide">
            Signal fusion
          </CardDescription>
          <CardTitle className="text-base font-semibold">Temporal signal fusion</CardTitle>
          <CardDescription>
            Combined velocity, decay, and correlation output for this borrower
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <TemporalSignalFusionSummary fusion={alert.signalFusion} />
        </CardContent>
      </Card>

      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">Detailed signal charts</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-base font-semibold">Payment deterioration velocity</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Days late across the last seven installments.
            </p>
            <SlopeChart series={alert.paymentVelocity.series} />
            <p className="mt-2 rounded-lg border border-destructive/20 bg-destructive/10 px-2.5 py-2 text-sm font-medium text-destructive">
              {alert.paymentVelocity.slopeLabel}
            </p>
          </Card>

          <Card className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-base font-semibold">Social signal decay rate</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Group attendance and meeting participation score.
            </p>
            <SlopeChart series={alert.socialDecay.series} />
            <p className="mt-2 rounded-lg border border-destructive/20 bg-destructive/10 px-2.5 py-2 text-sm font-medium text-destructive">
              {alert.socialDecay.slopeLabel}
            </p>
          </Card>
        </div>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm p-5">
        <p className="text-base font-semibold">Cross-signal correlation</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {alert.correlation.label}
        </p>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm p-5">
        <p className="text-base font-semibold">Overall distress probability</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Fused output vs. intervention threshold ({threshold}%).
        </p>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{probability}%</p>
        <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-destructive"
            style={{ width: `${probability}%` }}
          />
          <div
            className="absolute top-0 h-full w-px bg-foreground"
            style={{ left: `${threshold}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex justify-between text-sm text-muted-foreground">
          <span>0%</span>
          <span className="tabular-nums">Threshold {threshold}%</span>
          <span>100%</span>
        </div>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Suggested intervention</CardTitle>
          <CardDescription>Select one action, record the outcome, then save.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {INTERVENTIONS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="lg"
                variant={selected === item.id ? "default" : "outline"}
                className={
                  selected === item.id
                    ? "h-11 cursor-pointer border-primary"
                    : "h-11 cursor-pointer"
                }
                onClick={() => {
                  setSelected(item.id)
                  setSaved(false)
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="outcome">Outcome notes</Label>
            <Textarea
              id="outcome"
              value={outcome}
              onChange={(event) => {
                setOutcome(event.target.value)
                setSaved(false)
              }}
              placeholder="What happened, next follow-up, and borrower response…"
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-3">
          {saved ? (
            <p className="mr-auto text-sm text-muted-foreground">Intervention outcome recorded.</p>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="cursor-pointer"
            disabled={!selected || !outcome.trim() || saving}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            Record outcome
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
