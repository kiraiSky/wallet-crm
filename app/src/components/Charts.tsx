// Gráficos em SVG puro — sem dependências externas
// Server-component-friendly (não usa 'use client')

interface GaugeProps {
  value: number // 0-100
  color: string // hex
  size?: number
}

export function Gauge({ value, color, size = 90 }: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius
  const arcFraction = 0.75 // arco de 270°
  const arcLen = circumference * arcFraction
  const filled = arcLen * (clamped / 100)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <g transform={`rotate(135 ${cx} ${cy})`}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLen} ${circumference}`}
          strokeLinecap="round"
        />
        {clamped > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
          />
        )}
      </g>
    </svg>
  )
}

interface SparklineProps {
  data: number[]
  color: string // hex
  height?: number
}

export function Sparkline({ data, color, height = 96 }: SparklineProps) {
  if (data.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-zinc-400">
        Sem dados suficientes
      </div>
    )
  }
  const width = 300
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const pad = 6

  const points = data.map((v, i) => ({
    x: i * stepX,
    y: height - pad - ((v - min) / range) * (height - pad * 2),
  }))

  const linePath = 'M ' + points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')
  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x.toFixed(2)} ${height} L 0 ${height} Z`

  const gradId = `sparkfill-${color.replace('#', '')}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className="block"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

interface DonutProps {
  segments: { value: number; color: string }[]
  size?: number
  strokeWidth?: number
}

export function Donut({ segments, size = 128, strokeWidth = 18 }: DonutProps) {
  const radius = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((s, x) => s + x.value, 0)

  if (total === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-full border-[18px] border-zinc-100"
      >
        <span className="text-[10px] text-zinc-400">Sem dados</span>
      </div>
    )
  }

  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {segments.map((seg, i) => {
          const fraction = seg.value / total
          const dashLen = fraction * circumference
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={-offset}
            />
          )
          offset += dashLen
          return el
        })}
      </g>
    </svg>
  )
}
