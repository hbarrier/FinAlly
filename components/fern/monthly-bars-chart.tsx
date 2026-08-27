'use client'

import { useMemo } from 'react'

interface MonthlyBarsChartProps {
  /** Chronological, oldest first. `month` is a `YYYY-MM` key. */
  months: { month: string; total: number }[]
  color: string
  height?: number
}

const W = 520
const PAD_L = 40
const PAD_R = 8
const PAD_T = 10
const PAD_B = 20

function yLabel(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 10000) return `${Math.round(abs / 1000)}k`
  if (abs >= 1000) return `${(abs / 1000).toFixed(1)}k`
  return String(Math.round(abs))
}

export function MonthlyBarsChart({ months, color, height = 160 }: MonthlyBarsChartProps) {
  const { bars, avgY, avg, top, innerH } = useMemo(() => {
    const innerH = height - PAD_T - PAD_B
    const innerW = W - PAD_L - PAD_R
    const vals = months.map((m) => m.total)
    const max = Math.max(1, ...vals)
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    const yScale = (v: number) => PAD_T + (1 - v / max) * innerH
    const slot = innerW / Math.max(1, months.length)
    const bw = Math.max(2, Math.min(28, slot * 0.6))
    const bars = months.map((m, i) => {
      const cx = PAD_L + slot * i + slot / 2
      const y = yScale(m.total)
      return {
        x: cx - bw / 2,
        y,
        w: bw,
        h: PAD_T + innerH - y,
        label: `${m.month.slice(5)}/${m.month.slice(2, 4)}`,
        show: months.length <= 8 || i % Math.ceil(months.length / 8) === 0,
      }
    })
    return { bars, avgY: yScale(avg), avg, top: max, innerH }
  }, [months, height])

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
    >
      {[top, top / 2].map((v, i) => (
        <text
          key={i}
          x={PAD_L - 5}
          y={PAD_T + (1 - v / top) * innerH}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize="9"
          fill="var(--ink-faint)"
          fontFamily="var(--mono-fern)"
        >
          {yLabel(v)}
        </text>
      ))}

      {bars.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)} rx={2} fill={color} opacity={0.85} />
          {b.show && (
            <text
              x={b.x + b.w / 2}
              y={PAD_T + innerH + 12}
              textAnchor="middle"
              fontSize="8"
              fill="var(--ink-faint)"
              fontFamily="var(--mono-fern)"
            >
              {b.label}
            </text>
          )}
        </g>
      ))}

      <line
        x1={PAD_L}
        x2={W - PAD_R}
        y1={PAD_T + innerH}
        y2={PAD_T + innerH}
        stroke="var(--line)"
        strokeWidth="0.5"
      />

      {avg > 0 && (
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={avgY}
          y2={avgY}
          stroke="var(--ink-soft)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      )}
    </svg>
  )
}
