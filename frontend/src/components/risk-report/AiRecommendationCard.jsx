import { AlertTriangle, Check } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { getAiRecommendation } from "./mock-data"

export default function AiRecommendationCard({ report, trustStatus }) {
  const recommendation = getAiRecommendation(report, trustStatus)

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardDescription className="text-xs uppercase tracking-wide">
          System recommendation
        </CardDescription>
        <CardTitle className="text-base font-semibold">AI recommendation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Risk
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {recommendation.risk}%
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Risk level
            </p>
            <p className="mt-1 text-xl font-semibold">{recommendation.riskLevel}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recommendation
            </p>
            <Badge
              className={
                recommendation.recommendation === "REVIEW REQUIRED"
                  ? "mt-1 border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300"
                  : recommendation.recommendation === "APPROVE"
                    ? "mt-1 border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "mt-1 border-transparent bg-destructive/15 text-destructive"
              }
            >
              {recommendation.recommendation}
            </Badge>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Confidence
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {recommendation.confidence}%
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">Key factors</p>
          <ul className="mt-3 space-y-2">
            {recommendation.keyFactors.map((factor) => (
              <li key={factor.label} className="flex items-start gap-2 text-sm">
                {factor.tone === "positive" ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <span>{factor.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
