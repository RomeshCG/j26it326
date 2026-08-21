function toPoints(series, width, height, pad) {
  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1

  return series.map((value, index) => {
    const x = pad + (index / Math.max(series.length - 1, 1)) * (width - pad * 2)
    const y = height - pad - ((value - min) / range) * (height - pad * 2)
    return { x, y, value }
  })
}

export default function SlopeChart({
  series,
  className = "",
}) {
  const width = 320
  const height = 112
  const pad = 12
  const points = toPoints(series, width, height, pad)
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ")

  const first = points[0]
  const last = points[points.length - 1]
  const slopePath = `M${first.x},${first.y} L${last.x},${last.y}`

  const fillPath = `${path} L${last.x},${height - pad} L${first.x},${height - pad} Z`
  const strokeClass = "text-destructive"

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-28 w-full ${strokeClass} ${className}`}
      role="img"
      aria-hidden="true"
    >
      <path d={fillPath} className="fill-destructive/10" />
      <path
        d={path}
        fill="none"
        className="stroke-current"
        strokeWidth="2.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={slopePath}
        fill="none"
        className="stroke-foreground"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <circle cx={first.x} cy={first.y} r="3" className="fill-muted-foreground" />
      <circle cx={last.x} cy={last.y} r="3.5" className="fill-destructive" />
    </svg>
  )
}
