import { useMemo, useState } from "react"
import { Check, Copy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  DEFAULT_SELECTED_INTERACTION,
  INTERACTION_DETAILS,
  MATRIX_FEATURES,
  getInteractionKey,
  getMatrixValue,
} from "./mock-data"

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // clipboard unavailable
  }
}

function cellClasses(value, isSelected) {
  if (value == null) return "bg-muted text-muted-foreground"
  const abs = Math.abs(value)
  let tone = ""
  if (value > 0) {
    if (abs >= 0.18) tone = "bg-destructive/20 text-destructive hover:bg-destructive/25"
    else if (abs >= 0.08) tone = "bg-destructive/10 text-destructive/90 hover:bg-destructive/15"
    else tone = "bg-destructive/5 text-destructive/80 hover:bg-destructive/10"
  } else {
    if (abs >= 0.12) tone = "bg-emerald-500/20 text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-300"
    else if (abs >= 0.05) tone = "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
    else tone = "bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
  }
  const selected = isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
  return `${tone} ${selected}`
}

const LABEL_STYLES = {
  COMPOUNDING:
    "border-transparent bg-destructive/15 text-destructive",
  COMPENSATORY:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  INDEPENDENT:
    "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300",
}

function StrengthBar({ value }) {
  const filled = Math.min(5, Math.round(Math.abs(value) * 20))
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={`h-2 w-8 rounded-full ${
            index < filled ? "bg-primary/70" : "bg-muted"
          }`}
        />
      ))}
    </div>
  )
}

export default function ShapInteractionMatrix() {
  const [selectedKey, setSelectedKey] = useState(DEFAULT_SELECTED_INTERACTION)
  const [copied, setCopied] = useState(false)

  const selectedDetail =
    INTERACTION_DETAILS[selectedKey] ?? INTERACTION_DETAILS[DEFAULT_SELECTED_INTERACTION]
  const [row, col] = selectedKey.split("-").map(Number)
  const selectedValue = getMatrixValue(row, col)
  const pairLabel = `${MATRIX_FEATURES[row]} × ${MATRIX_FEATURES[col]}`

  const matrixCells = useMemo(() => {
    const size = MATRIX_FEATURES.length
    return Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (_, j) => ({
        i,
        j,
        value: getMatrixValue(i, j),
        key: getInteractionKey(i, j),
      }))
    )
  }, [])

  async function handleCopy() {
    const text = `${pairLabel}\nStrength: ${selectedValue > 0 ? "+" : ""}${selectedValue?.toFixed(2)}\n${selectedDetail.label}\n\n${selectedDetail.explanation}`
    await copyText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Factor interactions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How borrower factors combine to influence the risk score
        </p>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Interaction matrix</CardTitle>
          <CardDescription>
            Select a cell to view how two factors interact. Warm tones increase risk;
            cool tones reduce it.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-6">
          <table className="w-full min-w-[540px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2" />
                {MATRIX_FEATURES.map((feature) => (
                  <th
                    key={feature}
                    className="p-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {feature}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixCells.map((rowCells, rowIndex) => (
                <tr key={MATRIX_FEATURES[rowIndex]}>
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">
                    {MATRIX_FEATURES[rowIndex]}
                  </th>
                  {rowCells.map((cell) => {
                    const isSelected = cell.key === selectedKey
                    const isDiagonal = cell.i === cell.j

                    return (
                      <td key={`${cell.i}-${cell.j}`} className="p-1.5">
                        {isDiagonal ? (
                          <div className="flex h-12 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                            —
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => cell.key && setSelectedKey(cell.key)}
                            className={`flex h-12 w-full cursor-pointer items-center justify-center rounded-md border border-transparent text-xs font-medium tabular-nums transition-colors ${cellClasses(cell.value, isSelected)}`}
                            title={`${MATRIX_FEATURES[cell.i]} × ${MATRIX_FEATURES[cell.j]}: ${cell.value > 0 ? "+" : ""}${cell.value?.toFixed(2)}`}
                          >
                            {cell.value > 0 ? "+" : ""}
                            {cell.value.toFixed(2)}
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/50 pb-4">
          <div>
            <CardDescription className="text-xs uppercase tracking-wide">
              Selected interaction
            </CardDescription>
            <CardTitle className="mt-1 text-base font-semibold">{pairLabel}</CardTitle>
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
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Interaction strength
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {selectedValue > 0 ? "+" : ""}
                {selectedValue?.toFixed(2)}
              </p>
            </div>
            <StrengthBar value={selectedValue} />
            <Badge className={LABEL_STYLES[selectedDetail.label] ?? LABEL_STYLES.INDEPENDENT}>
              <span
                className={`mr-1.5 inline-block size-2 rounded-full ${
                  selectedDetail.tone === "negative" ? "bg-destructive" : "bg-emerald-500"
                }`}
              />
              {selectedDetail.label}
            </Badge>
          </div>

          <div className="rounded-lg border-l-4 border-primary/40 bg-muted/30 px-4 py-3">
            <p className="text-sm leading-relaxed text-foreground/90">
              {selectedDetail.explanation}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
