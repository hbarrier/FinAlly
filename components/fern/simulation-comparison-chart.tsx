'use client'

import { useMemo } from 'react'
import type { SimMonthComparison } from '@/lib/derive'

interface SimulationComparisonChartProps {
  /** Chronological, oldest first, current month last. */
  data: SimMonthComparison[]
  view: 'monthly' | 'yearly'
  height?: number
}

const W = 640
const PAD_L = 40
const PAD_R = 8
const PAD_T = 24
const PAD_B = 26

const SEGMENTS = [
  { key: 'recurring', label: 'Recurring', color: 'var(--teal)' },
  { key: 'variable', label: 'Variable', color: 'var(--butter)' },
  { key: 'recurringYearly', label: 'Yearly recurring', color: 'var(--lilac)' },
] as const

function yLabel(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 10000) return `${Math.round(abs / 1000)}k`
  if (abs >= 1000) return `${(abs / 1000).toFixed(1)}k`
  return String(Math.round(abs))
}

export function SimulationComparisonChart({ data, view, height = 220 }: SimulationComparisonChartProps) {
  const segments = useMemo(
    () => (view === 'yearly' ? SEGMENTS.slice() : SEGMENTS.slice(0, 2)),
    [view],
  )

  const { slots, top, innerH } = useMemo(() => {
    const innerH = height - PAD_T - PAD_B
    const innerW = W - PAD_L - PAD_R
    const max = Math.max(1, ...data.flatMap((d) => [d.actualTotal, d.simTotal]))
    const slot = innerW / Math.max(1, data.length)
    const pairW = Math.min(40, slot * 0.66)
    const barW = pairW / 2 - 1
    const baseline = PAD_T + innerH
    const stack = (parts: SimMonthComparison['actual'], x: number, opacity: number) => {
      let y = baseline
      return segments
        .map((s) => {
          const val = parts[s.key]
          const h = (val / max) * innerH
          y -= h
          return { x, y, w: barW, h, color: s.color, opacity, key: s.key }
        })
        .filter((r) => r.h > 0.4)
    }
    const slots = data.map((d, i) => {
      const cx = PAD_L + slot * i + slot / 2
      const ax = cx - pairW / 2
      const sx = cx - pairW / 2 + barW + 2
      const pairTop = PAD_T + (1 - Math.max(d.actualTotal, d.simTotal) / max) * innerH
      return {
        cx,
        label: d.label,
        ongoing: d.ongoing,
        pct: d.pct,
        pairTop,
        rects: [...stack(d.actual, ax, 0.9), ...stack(d.sim, sx, 0.38)],
      }
    })
    return { slots, top: max, innerH }
  }, [data, segments, height])

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          marginBottom: 8,
          fontSize: 11,
          color: 'var(--ink-soft)',
        }}
      >
        {segments.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            {s.label}
          </span>
        ))}
        <span style={{ color: 'var(--ink-faint)' }}>solid = actual · faded = simulation</span>
      </div>

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

        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={PAD_T + innerH}
          y2={PAD_T + innerH}
          stroke="var(--line)"
          strokeWidth="0.5"
        />

        {slots.map((s, i) => (
          <g key={i}>
            {s.rects.map((r, j) => (
              <rect
                key={j}
                x={r.x}
                y={r.y}
                width={r.w}
                height={Math.max(0, r.h)}
                fill={r.color}
                opacity={r.opacity}
              />
            ))}

            {s.pct != null && (
              <text
                x={s.cx}
                y={s.pairTop - 6}
                textAnchor="middle"
                fontSize="9"
                fill="var(--ink-soft)"
                fontFamily="var(--mono-fern)"
              >
                {Math.round(s.pct)}%
              </text>
            )}

            <text
              x={s.cx}
              y={PAD_T + innerH + 14}
              textAnchor="middle"
              fontSize="8"
              fill={s.ongoing ? 'var(--ink-faint)' : 'var(--ink-soft)'}
              fontStyle={s.ongoing ? 'italic' : 'normal'}
              fontFamily="var(--mono-fern)"
            >
              {s.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
