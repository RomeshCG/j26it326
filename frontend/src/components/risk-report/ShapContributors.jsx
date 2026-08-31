import { useState } from "react"
import { ArrowDown, ArrowUp, Check, Copy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const MAX_BLOCKS = 4

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // clipboard unavailable
  }
}

function ImpactBlocks({ impact, direction }) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: MAX_BLOCKS }).map((_, index) => (
        <span
          key={index}
          className={`h-2 w-5 rounded-full ${
            index < impact
              ? direction === "up"
                ? "bg-destructive/70"
                : "bg-emerald-500/70"
              : "bg-muted"
          }`}
        />
      ))}
    </div>
  )
}

export default function ShapContributors({ contributors }) {
  const [copied, setCopied] = useState(false)

  const summaryText = contributors
    .map(
      (item) =>
        `${item.feature} ${item.direction === "up" ? "(increases risk)" : "(reduces risk)"} — ${item.level} impact`
    )
    .join("\n")

  async function handleCopy() {
    await copyText(summaryText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <CardTitle className="text-base font-semibold">Risk contributors</CardTitle>
          <CardDescription>
            Factors influencing this assessment, ranked by impact
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="cursor-pointer shrink-0"
          onClick={handleCopy}
          aria-label="Copy risk contributors"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        <div className="hidden grid-cols-[1fr_8rem_6rem_5rem] gap-4 border-b bg-muted/40 px-6 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Factor</span>
          <span>Impact</span>
          <span>Level</span>
          <span className="text-right">Direction</span>
        </div>

        <ul className="divide-y divide-border/60">
          {contributors.map((item) => (
            <li
              key={item.feature}
              className="grid grid-cols-1 gap-3 px-6 py-4 sm:grid-cols-[1fr_8rem_6rem_5rem] sm:items-center sm:gap-4"
            >
              <p className="text-sm font-medium">{item.feature}</p>
              <ImpactBlocks impact={item.impact} direction={item.direction} />
              <Badge variant="secondary" className="w-fit text-xs font-normal">
                {item.level}
              </Badge>
              <div className="flex items-center justify-start gap-1.5 sm:justify-end">
                {item.direction === "up" ? (
                  <>
                    <ArrowUp className="size-4 text-destructive" aria-hidden />
                    <span className="text-xs text-destructive">Increases risk</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">
                      Reduces risk
                    </span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
