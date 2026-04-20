'use client'

import type { RecurringAmount } from '@/lib/derive'
import { fmt } from '@/lib/derive'

interface AmountHistoryChartProps {
  amounts: RecurringAmount[]
  color?: string
  height?: number
}

export function AmountHistoryChart({
  amounts,
  color = 'var(--rose)',
  height = 120,
}: AmountHistoryChartProps) {
  if (amounts.length === 0) return null

  const sorted = [...amounts].sort((a, b) => a.startDate.localeCompare(b.startDate))

  const today = new Date().toISOString().slice(0, 10)
  const rightEdge = sorted[sorted.length - 1].startDate > today
    ? sorted[sorted.length - 1].startDate
    : (() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().slice(0, 10) })()

  const toMs = (iso: string) => new Date(iso).getTime()
  const minMs = toMs(sorted[0].startDate)
  const maxMs = toMs(rightEdge)
  const rangeMs = Math.max(maxMs - minMs, 1)

  const maxAmount = Math.max(...sorted.map((a) => a.amount))
  const amountCeil = maxAmount * 1.25

  const w = 500
  const padLeft = 8
  const padRight = 8
  const padTop = 12
  const padBottom = 24
  const innerW = w - padLeft - padRight
  const innerH = height - padTop - padBottom

  const xOf = (iso: string) => padLeft + ((toMs(iso) - minMs) / rangeMs) * innerW
  const yOf = (amt: number) => padTop + innerH - (amt / amountCeil) * innerH

  // Build step path: horizontal then vertical at each transition
  let pathD = ''
  for (let i = 0; i < sorted.length; i++) {
    const x = xOf(sorted[i].startDate)
    const y = yOf(sorted[i].amount)
    if (i === 0) {
      pathD += `M ${x} ${y}`
    } else {
      // Vertical step up/down at this date, then horizontal
      pathD += ` L ${x} ${yOf(sorted[i - 1].amount)} L ${x} ${y}`
    }
  }
  // Extend last segment to right edge
  const xRight = xOf(rightEdge)
  pathD += ` L ${xRight} ${yOf(sorted[sorted.length - 1].amount)}`

  // Area fill path
  const areaD = pathD + ` L ${xRight} ${padTop + innerH} L ${padLeft} ${padTop + innerH} Z`

  // Today line
  const todayX = today >= sorted[0].startDate && today <= rightEdge ? xOf(today) : null

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
    >
      <defs>
        <linearGradient id="ah-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Baseline */}
      <line
        x1={padLeft} x2={w - padRight}
        y1={padTop + innerH} y2={padTop + innerH}
        stroke="var(--line)" strokeWidth="1"
      />

      {/* Today marker */}
      {todayX !== null && (
        <line
          x1={todayX} x2={todayX}
          y1={padTop} y2={padTop + innerH}
          stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="3 3"
        />
      )}

      {/* Area fill */}
      <path d={areaD} fill="url(#ah-fill)" />

      {/* Step line */}
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />

      {/* Dots + labels at each entry */}
      {sorted.map((entry, i) => {
        const x = xOf(entry.startDate)
        const y = yOf(entry.amount)
        const labelAnchor = i === 0 ? 'start' : i === sorted.length - 1 ? 'end' : 'middle'
        return (
          <g key={entry.id}>
            <circle cx={x} cy={y} r={3} fill={color} />
            <text
              x={x}
              y={padTop + innerH + 14}
              textAnchor={labelAnchor}
              fontSize="9"
              fill="var(--ink-faint)"
              style={{ fontFamily: 'var(--mono-fern, monospace)' }}
            >
              {entry.startDate.slice(0, 7)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Tiny sparkline for the recurring row — only renders if ≥2 entries */
export function AmountSparkline({
  amounts,
  color = 'var(--rose)',
}: {
  amounts: RecurringAmount[]
  color?: string
}) {
  if (amounts.length < 2) return null
  return <AmountHistoryChart amounts={amounts} color={color} height={40} />
}
