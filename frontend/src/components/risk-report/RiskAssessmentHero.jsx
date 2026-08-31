import { useState } from "react"
import { Check, Copy, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { classificationMeta, formatLkr } from "./mock-data"

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // clipboard unavailable
  }
}

export default function RiskAssessmentHero({ report }) {
  const classMeta = classificationMeta(report.classification)
  const [copied, setCopied] = useState(false)

  const summaryText = [
    "Credit Risk Assessment",
    `Applicant: ${report.applicant.name}`,
    `Loan: ${formatLkr(report.loanAmount)}`,
    `Default risk: ${report.defaultProbability}%`,
    `Classification: ${classMeta.shortLabel}`,
  ].join("\n")

  async function handleCopy() {
    await copyText(summaryText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Credit risk assessment
            </CardTitle>
            <CardDescription className="mt-0.5">
              Overview for this loan application
            </CardDescription>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer shrink-0"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy summary"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Applicant
            </p>
            <p className="mt-1 text-lg font-semibold">{report.applicant.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{report.applicant.nic}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Loan
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatLkr(report.loanAmount)}
            </p>
            {report.product ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{report.product}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Default risk
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight">
              {report.defaultProbability}
              <span className="text-xl text-muted-foreground">%</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Estimated probability of default
            </p>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Classification
            </p>
            <Badge className={`mt-3 px-4 py-1.5 text-sm font-semibold ${classMeta.className}`}>
              {classMeta.label}
            </Badge>
            <p className="mt-3 text-xs text-muted-foreground">Assigned risk band</p>
          </div>

          <div className="rounded-xl border bg-card p-5 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Risk score
            </p>
            <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight">
              {report.riskScore}
              <span className="text-xl text-muted-foreground">/100</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Higher score indicates lower risk</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
