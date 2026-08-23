function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = ((angleDeg - 180) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  }
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1"
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

export default function RiskScoreGauge({ score, color }) {
  const clamped = Math.max(0, Math.min(100, score))
  const cx = 120
  const cy = 110
  const radius = 88
  const trackEnd = 180
  const valueEnd = (clamped / 100) * 180

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 240 130"
        className="h-36 w-full max-w-[240px]"
        role="img"
        aria-label={`Risk score ${clamped} out of 100`}
      >
        <path
          d={describeArc(cx, cy, radius, 0, trackEnd)}
          fill="none"
          className="stroke-muted"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={describeArc(cx, cy, radius, 0, valueEnd)}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          className="fill-foreground text-4xl font-semibold"
          style={{ fontSize: "36px", fontWeight: 600 }}
        >
          {clamped}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: "12px" }}
        >
          Risk score
        </text>
        <text
          x={24}
          y={124}
          className="fill-muted-foreground"
          style={{ fontSize: "11px" }}
        >
          0
        </text>
        <text
          x={216}
          y={124}
          textAnchor="end"
          className="fill-muted-foreground"
          style={{ fontSize: "11px" }}
        >
          100
        </text>
      </svg>
    </div>
  )
}
