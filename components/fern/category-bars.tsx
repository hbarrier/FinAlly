'use client'

import { COLOR_VARS } from './color-vars'
import { CatSwatch } from './cat-swatch'
import { fmt } from '@/lib/derive'

interface BarItem {
  id: string
  name: string
  amount: number
  color: string
  icon: string
}

interface CategoryBarsProps {
  items: BarItem[]
}

export function CategoryBars({ items }: CategoryBarsProps) {
  const max = Math.max(...items.map((i) => i.amount), 1)
  const shown = items.slice(0, 6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {shown.map((it) => {
        const pct = (it.amount / max) * 100
        const color = COLOR_VARS[it.color]?.solid ?? 'var(--teal)'
        const bg = COLOR_VARS[it.color]?.bg ?? 'var(--teal-bg)'

        return (
          <div key={it.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <CatSwatch color={it.color} icon={it.icon} size={20} />
              <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {it.name}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--mono-fern)', color: 'var(--ink)', fontWeight: 500, flexShrink: 0 }}>
                {fmt(it.amount)}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: bg, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  borderRadius: 4,
                  background: color,
                  transition: 'width .5s cubic-bezier(.4,0,.2,1)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
