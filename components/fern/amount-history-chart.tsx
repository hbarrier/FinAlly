'use client'

import { useId, useMemo } from 'react'
import type { RecurringAmount } from '@/lib/derive'

interface ActualPoint {
  date: string
  amount: number
}

interface AmountHistoryChartProps {
  amounts: RecurringAmount[]
  color?: string
  height?: number
  actuals?: ActualPoint[]
}

export function AmountHistoryChart({
  amounts,
  color = 'var(--rose)',
  height = 120,
  actuals,
}: AmountHistoryChartProps) {
  const gradId = useId()
  const fillId = `ah-fill-${gradId}`

  const computed = useMemo(() => {
    if (amounts.length === 0) return null

    const sorted = [...amounts].sort((a, b) => a.startDate.localeCompare(b.startDate))

    const today = new Date().toISOString().slice(0, 10)
    const futureEdge = (() => { const d = new Date(); d.setDate(d.getDate() + 90); return d.toISOString().slice(0, 10) })()
    const rightEdge = sorted[sorted.length - 1].startDate > futureEdge
      ? sorted[sorted.length - 1].startDate
      : futureEdge

    const toMs = (iso: string) => new Date(iso).getTime()
    const earliestActual = actuals && actuals.length > 0
      ? actuals.reduce((m, a) => (a.date < m ? a.date : m), actuals[0].date)
      : null
    const leftEdge = earliestActual && earliestActual < sorted[0].startDate
      ? earliestActual
      : sorted[0].startDate
    const minMs = toMs(leftEdge)
    const maxMs = toMs(rightEdge)
    const rangeMs = Math.max(maxMs - minMs, 1)

    const maxConfigured = Math.max(...sorted.map((a) => a.amount))
    const maxActual = actuals && actuals.length > 0 ? Math.max(...actuals.map((a) => a.amount)) : 0
    const maxAmount = Math.max(maxConfigured, maxActual)
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

    // Step function starts from leftEdge (not necessarily sorted[0] if actuals predate it)
    let pathD = ''
    const lineStartX = xOf(leftEdge)
    for (let i = 0; i < sorted.length; i++) {
      const x = xOf(sorted[i].startDate)
      const y = yOf(sorted[i].amount)
      if (i === 0) {
        pathD += `M ${lineStartX} ${y} L ${x} ${y}`
      } else {
        pathD += ` L ${x} ${yOf(sorted[i - 1].amount)} L ${x} ${y}`
      }
    }
    const xRight = xOf(rightEdge)
    pathD += ` L ${xRight} ${yOf(sorted[sorted.length - 1].amount)}`

    const areaD = pathD + ` L ${xRight} ${padTop + innerH} L ${lineStartX} ${padTop + innerH} Z`

    const todayX = today >= leftEdge && today <= rightEdge ? xOf(today) : null

    const dots = sorted.map((entry, i) => ({
      id: entry.id,
      x: xOf(entry.startDate),
      y: yOf(entry.amount),
      anchor: (i === 0 ? 'start' : i === sorted.length - 1 ? 'end' : 'middle') as
        | 'start'
        | 'end'
        | 'middle',
      label: entry.startDate.slice(0, 7),
    }))

    const actualDots = (actuals ?? []).map((a) => ({
      x: xOf(a.date),
      y: yOf(a.amount),
      date: a.date,
      amount: a.amount,
    }))

    return { pathD, areaD, todayX, dots, actualDots, w, padLeft, padRight, padTop, innerH }
  }, [amounts, actuals, height])

  if (!computed) return null
  const { pathD, areaD, todayX, dots, actualDots, w, padLeft, padRight, padTop, innerH } = computed

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
    >
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <line
        x1={padLeft} x2={w - padRight}
        y1={padTop + innerH} y2={padTop + innerH}
        stroke="var(--line)" strokeWidth="1"
      />

      {todayX !== null && (
        <line
          x1={todayX} x2={todayX}
          y1={padTop} y2={padTop + innerH}
          stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="3 3"
        />
      )}

      <path d={areaD} fill={`url(#${fillId})`} />

      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />

      {dots.map((d) => (
        <g key={d.id}>
          <circle cx={d.x} cy={d.y} r={3} fill={color} />
          <text
            x={d.x}
            y={padTop + innerH + 14}
            textAnchor={d.anchor}
            fontSize="9"
            fill="var(--ink-faint)"
            style={{ fontFamily: 'var(--mono-fern, monospace)' }}
          >
            {d.label}
          </text>
        </g>
      ))}

      {actualDots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={3.5}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity="0.7"
        />
      ))}
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
