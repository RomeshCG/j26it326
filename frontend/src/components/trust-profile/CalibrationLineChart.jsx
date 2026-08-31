function toPoints(values, width, height, padX, padY, yMax) {
  const usableW = width - padX * 2
  const usableH = height - padY * 2

  return values.map((value, index) => {
    const x =
      padX +
      (index / Math.max(values.length - 1, 1)) * usableW
    const y = height - padY - (value / yMax) * usableH
    return { x, y, value }
  })
}

function toPath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ")
}

export default function CalibrationLineChart({
  series,
  threshold = 20,
  className = "",
}) {
  const width = 720
  const height = 280
  const padX = 48
  const padY = 28
  const yMax = 50

  const overPoints = toPoints(
    series.map((item) => item.over),
    width,
    height,
    padX,
    padY,
    yMax
  )
  const underPoints = toPoints(
    series.map((item) => item.under),
    width,
    height,
    padX,
    padY,
    yMax
  )

  const thresholdY = height - padY - (threshold / yMax) * (height - padY * 2)
  const yTicks = [0, 10, 20, 30, 40, 50]

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-64 w-full sm:h-72"
        role="img"
        aria-label="Over-reliance and under-reliance rates across the last 20 decisions"
      >
        {yTicks.map((tick) => {
          const y = height - padY - (tick / yMax) * (height - padY * 2)
          return (
            <g key={tick}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                className="stroke-border"
                strokeWidth="1"
              />
              <text
                x={padX - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                style={{ fontSize: "11px" }}
              >
                {tick}%
              </text>
            </g>
          )
        })}

        <line
          x1={padX}
          y1={thresholdY}
          x2={width - padX}
          y2={thresholdY}
          className="stroke-muted-foreground"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <text
          x={width - padX}
          y={thresholdY - 6}
          textAnchor="end"
          className="fill-muted-foreground"
          style={{ fontSize: "10px" }}
        >
          Threshold {threshold}%
        </text>

        <path
          d={toPath(overPoints)}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={toPath(underPoints)}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {overPoints.map((point, index) => (
          <circle
            key={`over-${index}`}
            cx={point.x}
            cy={point.y}
            r="2.5"
            fill="#ef4444"
          />
        ))}
        {underPoints.map((point, index) => (
          <circle
            key={`under-${index}`}
            cx={point.x}
            cy={point.y}
            r="2.5"
            fill="#3b82f6"
          />
        ))}

        {[1, 5, 10, 15, 20].map((decision) => {
          const index = decision - 1
          const x = overPoints[index]?.x
          if (x == null) return null
          return (
            <text
              key={decision}
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: "11px" }}
            >
              {decision}
            </text>
          )
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full bg-red-500" />
          Over-reliance rate
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full bg-blue-500" />
          Under-reliance rate
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-px w-5 border-t border-dashed border-muted-foreground" />
          Threshold
        </span>
      </div>
    </div>
  )
}
