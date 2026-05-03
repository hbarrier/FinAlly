'use client'

import { useId, useMemo } from 'react'

interface BalanceEvolutionProps {
  series: { date: string; balance: number }[]
  height?: number
}

const W = 520
const PAD_L = 50
const PAD_R = 8
const PAD_T = 10
const PAD_B = 22

function niceStep(range: number): number {
  if (range === 0) return 1
  const rough = range / 4
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * mag >= rough) return m * mag
  }
  return 10 * mag
}

function yLabel(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 10000) return `${sign}${Math.round(abs / 1000)}k`
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

export function BalanceEvolution({ series, height = 200 }: BalanceEvolutionProps) {
  const gradId = useId()
  const grad = `bal-grad-${gradId}`

  const { path, area, yTicks, xTicks, innerH } = useMemo(() => {
    const innerH = height - PAD_T - PAD_B
    const innerW = W - PAD_L - PAD_R

    if (series.length < 2) return { path: '', area: '', yTicks: [], xTicks: [], innerH }

    const vals = series.map((p) => p.balance)
    const minV = Math.min(...vals)
    const maxV = Math.max(...vals)
    const span = maxV - minV

    const xScale = (i: number) => PAD_L + (i / (series.length - 1)) * innerW
    const yScale =
      span === 0
        ? () => PAD_T + innerH / 2
        : (v: number) => PAD_T + (1 - (v - minV) / span) * innerH

    const pts = series.map((p, i) => [xScale(i), yScale(p.balance)] as const)
    const path = pts.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `L${x} ${y}`)).join(' ')
    const area = `${path} L${xScale(series.length - 1)} ${PAD_T + innerH} L${PAD_L} ${PAD_T + innerH} Z`

    // Y ticks: 4-5 nice round values
    const step = niceStep(span || 1000)
    const lo = Math.floor(minV / step) * step
    const yTickValues: number[] = []
    for (let v = lo; v <= maxV + step * 0.01; v += step) yTickValues.push(v)
    const yTicks = yTickValues
      .filter((v) => yScale(v) >= PAD_T - 2 && yScale(v) <= PAD_T + innerH + 2)
      .map((v) => ({ y: yScale(v), label: yLabel(v) }))

    // X ticks: density adapts to span
    const spanDays =
      (new Date(series[series.length - 1].date).getTime() - new Date(series[0].date).getTime()) /
      86400000
    const xTicks: { x: number; label: string }[] = []
    let lastYear = ''

    series.forEach((p, i) => {
      const d = parseInt(p.date.slice(8, 10))
      const m = parseInt(p.date.slice(5, 7))
      const y = p.date.slice(0, 4)

      if (spanDays <= 40) {
        if ([1, 5, 10, 15, 20, 25].includes(d)) {
          xTicks.push({ x: xScale(i), label: String(d) })
        }
      } else if (spanDays <= 200) {
        if (d === 1) {
          xTicks.push({
            x: xScale(i),
            label: new Date(+y, m - 1).toLocaleString('en-US', { month: 'short' }),
          })
        }
      } else if (spanDays <= 1100) {
        if (d === 1 && m % 3 === 1) {
          const mo = new Date(+y, m - 1).toLocaleString('en-US', { month: 'short' })
          xTicks.push({ x: xScale(i), label: m === 1 ? `${mo} '${y.slice(2)}` : mo })
        }
      } else {
        if (d === 1 && m === 1 && y !== lastYear) {
          xTicks.push({ x: xScale(i), label: y })
          lastYear = y
        }
      }
    })

    return { path, area, yTicks, xTicks, innerH }
  }, [series, height])

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
    >
      <defs>
        <linearGradient id={grad} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--sage)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD_L} x2={W - PAD_R} y1={t.y} y2={t.y}
            stroke="var(--line-soft)" strokeWidth="0.5"
          />
          <text
            x={PAD_L - 5} y={t.y}
            textAnchor="end" dominantBaseline="middle"
            fontSize="10" fill="var(--ink-faint)" fontFamily="var(--mono-fern)"
          >
            {t.label}
          </text>
        </g>
      ))}

      <line
        x1={PAD_L} x2={W - PAD_R} y1={PAD_T + innerH} y2={PAD_T + innerH}
        stroke="var(--line)" strokeWidth="0.5"
      />

      {xTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={t.x} x2={t.x} y1={PAD_T + innerH} y2={PAD_T + innerH + 4}
            stroke="var(--line)" strokeWidth="0.5"
          />
          <text
            x={t.x} y={PAD_T + innerH + 14}
            textAnchor="middle" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--mono-fern)"
          >
            {t.label}
          </text>
        </g>
      ))}

      <path d={area} fill={`url(#${grad})`} />
      <path d={path} stroke="var(--sage)" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
