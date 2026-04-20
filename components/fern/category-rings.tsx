'use client'

import { useState } from 'react'
import { COLOR_VARS } from './color-vars'
import { fmtShort } from '@/lib/derive'

interface RingItem {
  id: string
  name: string
  amount: number
  color: string
  icon: string
}

interface CategoryRingsProps {
  items: RingItem[]
}

export function CategoryRings({ items }: CategoryRingsProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const baseR = 90
  const step = 10
  const max = Math.max(...items.map((i) => i.amount), 1)

  return (
    <svg className="rings-svg" viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {items.slice(0, 6).map((it, i) => {
        const r = baseR - i * step
        const pct = it.amount / max
        const c = 2 * Math.PI * r
        const dash = c * pct
        const color = COLOR_VARS[it.color]?.solid ?? 'var(--teal)'
        const isHover = hovered === it.id

        return (
          <g key={it.id}>
            <circle
              cx={cx} cy={cy} r={r}
              stroke="var(--bg-sunken)"
              strokeWidth={isHover ? 9 : 7}
              fill="none"
            />
            <circle
              cx={cx} cy={cy} r={r}
              stroke={color}
              strokeWidth={isHover ? 9 : 7}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${dash} ${c}`}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-width .2s, stroke-dasharray .6s', cursor: 'default' }}
              onMouseEnter={() => setHovered(it.id)}
              onMouseLeave={() => setHovered(null)}
            />
          </g>
        )
      })}
      <text
        x={cx} y={cy - 4}
        textAnchor="middle"
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 12,
          fill: 'var(--ink-faint)',
          letterSpacing: '0.1em',
        }}
      >
        SPENT
      </text>
      <text
        x={cx} y={cy + 22}
        textAnchor="middle"
        style={{ fontFamily: 'var(--serif)', fontSize: 24, fill: 'var(--ink)' }}
      >
        {fmtShort(items.reduce((s, i) => s + i.amount, 0))}
      </text>
    </svg>
  )
}
