import { useMemo, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import InteractionDetail from "./InteractionDetail"
import {
  DEFAULT_SELECTED_INTERACTION,
  MATRIX_FEATURES,
  getInteractionKey,
  getMatrixValue,
} from "./mock-data"

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

export default function ShapInteractionMatrix() {
  const [selectedKey, setSelectedKey] = useState(DEFAULT_SELECTED_INTERACTION)

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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Factor interactions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an interaction in the matrix to see how factors combine
        </p>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Interaction matrix</CardTitle>
          <CardDescription>
            Warm tones increase risk; cool tones reduce it. Click a cell for the full breakdown.
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

      <InteractionDetail interactionKey={selectedKey} />
    </section>
  )
}
