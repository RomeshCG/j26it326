export default function ShapFactorChart({ factors }) {
  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.value)), 0.01)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Decreases risk ←</span>
        <span>→ Increases risk</span>
      </div>

      <div className="space-y-3">
        {factors.map((factor) => {
          const widthPct = (Math.abs(factor.value) / maxAbs) * 50
          const isPositive = factor.value >= 0

          return (
            <div key={factor.feature} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-3 sm:grid-cols-[12rem_1fr_4rem]">
              <p className="truncate text-sm font-medium" title={factor.feature}>
                {factor.feature}
              </p>

              <div className="relative h-7 rounded-md bg-muted/60">
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                {isPositive ? (
                  <div
                    className="absolute top-1 bottom-1 left-1/2 rounded-r-md bg-emerald-500/80"
                    style={{ width: `${widthPct}%` }}
                    title={`+${factor.value.toFixed(2)}`}
                  />
                ) : (
                  <div
                    className="absolute top-1 bottom-1 right-1/2 rounded-l-md bg-destructive/80"
                    style={{ width: `${widthPct}%` }}
                    title={factor.value.toFixed(2)}
                  />
                )}
              </div>

              <p
                className={`text-right text-xs font-medium tabular-nums ${
                  isPositive ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"
                }`}
              >
                {isPositive ? "+" : ""}
                {factor.value.toFixed(2)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
