import { COLOR_VARS } from './color-vars'
import { CatSwatch } from './cat-swatch'
import { fmt } from '@/lib/derive'

interface RecurringBarItem {
  id: string
  name: string
  color: string
  icon: string
  total: number
  cleared: number
  amortized: number
}

interface RecurringCategoryBarsProps {
  items: RecurringBarItem[]
  flattenSizes?: boolean
  onCategoryClick?: (id: string) => void
}

export function RecurringCategoryBars({ items, flattenSizes, onCategoryClick }: RecurringCategoryBarsProps) {
  const max = Math.max(...items.map((i) => i.total), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {items.map((it) => {
        const pctTotal = flattenSizes ? 100 : (it.total / max) * 100
        const clearedFrac = it.total > 0 ? it.cleared / it.total : 0
        const amortizedFrac = it.total > 0 ? it.amortized / it.total : 0
        const pendingFrac = Math.max(0, 1 - clearedFrac - amortizedFrac)
        const color = COLOR_VARS[it.color]?.solid ?? 'var(--teal)'

        return (
          <div
            key={it.id}
            role={onCategoryClick ? 'button' : undefined}
            tabIndex={onCategoryClick ? 0 : undefined}
            onClick={onCategoryClick ? () => onCategoryClick(it.id) : undefined}
            onKeyDown={onCategoryClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onCategoryClick(it.id) } : undefined}
            style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <CatSwatch color={it.color} icon={it.icon} size={20} />
              <span style={{ flex: 1, fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {it.name}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--mono-fern)', color: 'var(--ink)', fontWeight: 500, flexShrink: 0 }}>
                {fmt(it.total)}
              </span>
            </div>
            <div style={{ height: 6, width: `${pctTotal}%`, borderRadius: 4, overflow: 'hidden', display: 'flex', transition: 'width .5s cubic-bezier(.4,0,.2,1)' }}>
              <div style={{ width: `${clearedFrac * 100}%`, background: color, opacity: 1 }} />
              <div style={{ width: `${amortizedFrac * 100}%`, background: color, opacity: 0.7 }} />
              <div style={{ width: `${pendingFrac * 100}%`, background: color, opacity: 0.35 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
