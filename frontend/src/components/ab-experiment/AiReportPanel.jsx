import { Check, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import RiskScoreGauge from "@/components/risk-report/RiskScoreGauge"
import ShapFactorChart from "@/components/risk-report/ShapFactorChart"
import {
  NARRATIVE_STYLES,
  classificationMeta,
} from "@/components/risk-report/mock-data"

const INTERACTION_STYLES = {
  COMPENSATORY: {
    className:
      "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  COMPOUNDING: {
    className:
      "border-transparent bg-destructive/15 text-destructive",
  },
  INDEPENDENT: {
    className:
      "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
}

export default function AiReportPanel({
  report,
  decision,
  overrideReason,
  onDecision,
  onOverrideReasonChange,
}) {
  const classMeta = classificationMeta(report.classification)
  const narrativeStyle = NARRATIVE_STYLES[report.narrativeStyle]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-xl border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Risk score</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <RiskScoreGauge score={report.riskScore} color={classMeta.gaugeColor} />
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Default probability</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 items-center justify-center py-4">
            <p className="text-3xl font-semibold tabular-nums">
              {report.defaultProbability.toFixed(1)}
              <span className="text-lg text-muted-foreground">%</span>
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Classification</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 py-4">
            <Badge className={`px-3 py-1 text-xs font-semibold ${classMeta.className}`}>
              {classMeta.label}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="text-sm font-semibold">SHAP individual factors</CardTitle>
          <CardDescription>Top 5 features driving this score</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <ShapFactorChart factors={report.shapFactors} />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">SHAP interaction panel</h3>
        <div className="space-y-3">
          {report.interactions.map((item) => (
            <Card key={item.id} className="rounded-xl border bg-card">
              <CardHeader className="space-y-2 pb-2">
                <Badge
                  className={
                    INTERACTION_STYLES[item.label]?.className ??
                    "border-transparent bg-muted text-muted-foreground"
                  }
                >
                  {item.label}
                </Badge>
                <CardTitle className="text-sm font-semibold leading-snug">
                  {item.pair}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {item.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold">
              Explanation for: {report.officerName}
            </CardTitle>
            <Badge className={narrativeStyle.className}>
              Style: {narrativeStyle.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-xs leading-relaxed text-foreground/90">
            {report.narrative}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="text-sm font-semibold">Decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onDecision("approve")}
              className={`cursor-pointer border-transparent ${
                decision === "approve"
                  ? "bg-emerald-600 text-white hover:bg-emerald-600/90"
                  : "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
              }`}
            >
              <Check />
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onDecision("reject")}
              className={`cursor-pointer ${
                decision === "reject" ? "ring-2 ring-destructive/40" : ""
              }`}
            >
              <X />
              Reject
            </Button>
          </div>

          {decision === "reject" ? (
            <div className="space-y-2">
              <Label htmlFor="group-a-override">Override reason</Label>
              <Textarea
                id="group-a-override"
                value={overrideReason}
                onChange={(event) => onOverrideReasonChange(event.target.value)}
                placeholder="Explain why you are rejecting…"
                rows={3}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
