import { useState } from "react"
import { Check, Copy, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { getInteractionDetail } from "./mock-data"

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // clipboard unavailable
  }
}

const LABEL_STYLES = {
  COMPOUNDING: "border-transparent bg-destructive/15 text-destructive",
  COMPENSATORY:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  INDEPENDENT: "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300",
}

function formatContribution(value) {
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value}%`
}

function ContributionRow({ label, value, maxValue, highlight, tone }) {
  const width = Math.min(100, (Math.abs(value) / maxValue) * 100)
  const isPositive = value > 0

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        highlight ? "border-primary/30 bg-primary/5" : "border-border/60 bg-muted/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm ${highlight ? "font-semibold" : "font-medium"}`}>{label}</p>
        <p
          className={`text-sm font-semibold tabular-nums ${
            highlight
              ? tone === "negative"
                ? "text-destructive"
                : "text-emerald-700 dark:text-emerald-300"
              : isPositive
                ? "text-destructive/90"
                : "text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {formatContribution(value)}
          {!highlight ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              risk contribution
            </span>
          ) : (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              contribution
            </span>
          )}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            isPositive ? "bg-destructive/70" : "bg-emerald-500/70"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export default function InteractionDetail({ interactionKey }) {
  const detail = getInteractionDetail(interactionKey)
  const [copied, setCopied] = useState(false)

  const { factorA, factorB, breakdown, label, tone, explanation } = detail
  const effectTitle = label === "COMPOUNDING" ? "Compounding effect" : "Offsetting effect"
  const maxBar = Math.max(
    Math.abs(breakdown.factorA),
    Math.abs(breakdown.factorB),
    Math.abs(breakdown.combined),
    1
  )

  const copyPayload = [
    `${factorA} + ${factorB}`,
    `${effectTitle}`,
    `${factorA} alone: ${formatContribution(breakdown.factorA)}`,
    `${factorB} alone: ${formatContribution(breakdown.factorB)}`,
    `Combined: ${formatContribution(breakdown.combined)}`,
    "",
    explanation,
  ].join("\n")

  async function handleCopy() {
    await copyText(copyPayload)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/50 pb-4">
        <div className="space-y-3">
          <div>
            <CardDescription className="text-xs uppercase tracking-wide">
              Interaction detail
            </CardDescription>
            <CardTitle className="mt-1 text-base font-semibold">
              How these factors combine
            </CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-normal">
              {factorA}
            </Badge>
            <Plus className="size-4 text-muted-foreground" aria-hidden />
            <Badge variant="secondary" className="font-normal">
              {factorB}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="cursor-pointer shrink-0"
          onClick={handleCopy}
          aria-label="Copy interaction detail"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={LABEL_STYLES[label] ?? LABEL_STYLES.INDEPENDENT}>
            {effectTitle}
          </Badge>
          {label === "COMPOUNDING" &&
          Math.abs(breakdown.combined) >
            Math.abs(breakdown.factorA) + Math.abs(breakdown.factorB) ? (
            <p className="text-xs text-muted-foreground">
              Combined impact exceeds the sum of individual contributions
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <ContributionRow
            label={`${factorA} alone`}
            value={breakdown.factorA}
            maxValue={maxBar}
            tone={tone}
          />
          <ContributionRow
            label={`${factorB} alone`}
            value={breakdown.factorB}
            maxValue={maxBar}
            tone={tone}
          />
          <ContributionRow
            label="Combined interaction"
            value={breakdown.combined}
            maxValue={maxBar}
            highlight
            tone={tone}
          />
        </div>

        <div className="rounded-lg border-l-4 border-primary/40 bg-muted/30 px-4 py-3">
          <p className="text-sm leading-relaxed text-foreground/90">{explanation}</p>
        </div>
      </CardContent>
    </Card>
  )
}
