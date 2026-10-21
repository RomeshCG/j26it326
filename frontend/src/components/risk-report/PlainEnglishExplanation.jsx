import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const BAND_TEXT = { LOW: "low", MEDIUM: "moderate", HIGH: "high" }

/**
 * Template-only text built from the model's real top factors (no GenAI, never invents a number).
 * ponytail: factor labels come from the model's own feature names; richer wording needs v3 fields.
 */
function buildPlainEnglish(report) {
  const factors = report.shapContributors ?? []
  const up = factors.filter((f) => f.direction === "up").slice(0, 3).map((f) => f.feature)
  const down = factors.filter((f) => f.direction === "down").slice(0, 2).map((f) => f.feature)
  const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a[0])

  const parts = [
    `The model estimates a ${report.defaultProbability}% chance that this loan becomes overdue, which is a ${BAND_TEXT[report.classification] ?? "moderate"} risk.`,
  ]
  if (up.length) parts.push(`The score is pushed up mainly by ${list(up)}.`)
  if (down.length) parts.push(`It is held down by ${list(down)}.`)
  if (report.recommendation) parts.push(`Suggested action: ${report.recommendation}. The officer makes the final decision.`)
  return parts.join(" ")
}

export default function PlainEnglishExplanation({ report }) {
  if (report.source !== "api") return null
  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base font-semibold">In plain English</CardTitle>
        <CardDescription>Built from the model's real top factors</CardDescription>
      </CardHeader>
      <CardContent className="pt-5 text-sm leading-relaxed">{buildPlainEnglish(report)}</CardContent>
    </Card>
  )
}
