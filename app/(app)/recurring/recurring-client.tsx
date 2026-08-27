'use client'

import { useMemo, useState, useTransition } from 'react'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { RecurringSheet } from '@/components/fern/sheets/recurring-sheet'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { fmt, monthlyEstimate, type Category, type RecurringWithAmounts } from '@/lib/derive'
import { addRecurring, updateRecurring, deleteRecurring } from '@/lib/actions/recurring'
import { runAction } from '@/lib/utils'
import type { Merchant } from '@/lib/db-types'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface RecurringClientProps {
  recurring: RecurringWithAmounts[]
  categories: Category[]
  merchants: Merchant[]
  transactionsByRecurring: Record<string, { date: string; amount: number }[]>
}

export function RecurringClient({ recurring, categories, merchants, transactionsByRecurring }: RecurringClientProps) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [, startTransition] = useTransition()

  const bills = recurring.filter((r) => r.kind === 'expense')
  const incomes = recurring.filter((r) => r.kind === 'income')
  const monthlyOut = bills.reduce((s, r) => s + monthlyEstimate(r), 0)
  const monthlyIn = incomes.reduce((s, r) => s + monthlyEstimate(r), 0)

  const editingItem = editing && editing !== 'new' ? recurring.find((r) => r.id === editing) : null

  const handleSave = async (data: Parameters<typeof addRecurring>[0]) => {
    startTransition(runAction(async () => {
      if (editing && editing !== 'new') {
        await updateRecurring(editing, data)
      } else {
        await addRecurring(data)
      }
    }))
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring item?')) return
    startTransition(runAction(async () => { await deleteRecurring(id) }))
  }

  return (
    <div>
      <PageHeader
        kicker="On a schedule"
        title={<><em>Recurring</em> movements</>}
        actions={
          <FernButton onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> New recurring
          </FernButton>
        }
      />

      {recurring.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="fern-card">
            <div className="fern-page-kicker">Monthly estimate · In</div>
            <div className="fern-display" style={{ fontSize: 44, color: 'var(--sage-ink)', marginTop: 4 }}>+{fmt(monthlyIn)}</div>
            <div style={{ color: 'var(--ink-faint)', fontSize: 12, marginTop: 6 }}>
              Across {incomes.length} recurring income{incomes.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="fern-card">
            <div className="fern-page-kicker">Monthly estimate · Out</div>
            <div className="fern-display" style={{ fontSize: 44, color: 'var(--rose-ink)', marginTop: 4 }}>−{fmt(monthlyOut)}</div>
            <div style={{ color: 'var(--ink-faint)', fontSize: 12, marginTop: 6 }}>
              Across {bills.length} recurring bill{bills.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      )}

      {recurring.length === 0 ? (
        <EmptyState
          illu="◯"
          title="No recurring items yet"
          description="Add your rent, salary, subscriptions — anything that repeats."
          action={
            <FernButton
              tone="outline"
              onClick={() => setEditing('new')}
              style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, fontSize: 13, background: 'transparent', color: 'var(--ink)' }}
            >
              <Icon name="plus" size={14} /> Add first recurring
            </FernButton>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <RecurringSection title="Bills & subscriptions" items={bills} categories={categories} onEdit={(id) => setEditing(id)} onDelete={handleDelete} />
          <RecurringSection title="Income" items={incomes} categories={categories} onEdit={(id) => setEditing(id)} onDelete={handleDelete} />
        </div>
      )}

      <RecurringSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        categories={categories}
        merchants={merchants}
        item={editingItem ?? null}
        amounts={editingItem?.amounts ?? []}
        actuals={editingItem ? (transactionsByRecurring[editingItem.id] ?? []) : []}
        onSave={handleSave}
      />
    </div>
  )
}

function RecurringSection({
  title,
  items,
  categories,
  onEdit,
  onDelete,
}: {
  title: string
  items: RecurringWithAmounts[]
  categories: Category[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'category'>('name')
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const visibleItems = useMemo(() => {
    const filtered = showAll ? items : items.filter((r) => !r.endDate || r.endDate >= today)
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  }, [items, showAll, today])

  const categoryGroups = useMemo(() => {
    if (sortBy !== 'category') return null
    const groups = new Map<string, { cat: Category | undefined; items: RecurringWithAmounts[] }>()
    for (const r of visibleItems) {
      const cat = r.categoryId ? categoryById.get(r.categoryId) : undefined
      const key = cat?.name ?? 'Uncategorized'
      if (!groups.has(key)) groups.set(key, { cat, items: [] })
      groups.get(key)!.items.push(r)
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, { cat, items }]) => ({ name, cat, items }))
  }, [sortBy, visibleItems, categoryById])

  const hiddenCount = items.length - visibleItems.length

  return (
    <div className="fern-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
        <span className="fern-page-kicker">{visibleItems.length} items</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: showAll ? 'var(--ink)' : 'transparent', color: showAll ? 'var(--bg)' : 'var(--ink-faint)' }}
        >
          {showAll ? `All (${items.length})` : `Active${hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}`}
        </button>
        <button
          onClick={() => setSortBy('name')}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: sortBy === 'name' ? 'var(--ink)' : 'transparent', color: sortBy === 'name' ? 'var(--bg)' : 'var(--ink-faint)' }}
        >
          A–Z
        </button>
        <button
          onClick={() => setSortBy('category')}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: sortBy === 'category' ? 'var(--ink)' : 'transparent', color: sortBy === 'category' ? 'var(--bg)' : 'var(--ink-faint)' }}
        >
          Category
        </button>
      </div>
      {visibleItems.length === 0 ? (
        <div style={{ color: 'var(--ink-faint)', padding: '20px 0', textAlign: 'center', fontSize: 13 }}>None yet</div>
      ) : categoryGroups ? (
        categoryGroups.map(({ name, cat, items: groupItems }) => {
          const monthlyTotal = groupItems.reduce((s, r) => s + monthlyEstimate(r), 0)
          const yearlyTotal = monthlyTotal * 12
          const amountColor = groupItems[0]?.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)'
          return (
            <div key={name} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {cat && <CatSwatch color={cat.color} icon={cat.icon ?? 'tag'} size={18} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{name}</span>
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', color: amountColor }}>
                  M: {fmt(monthlyTotal)} / Y: {fmt(yearlyTotal)}
                </span>
              </div>
              {groupItems.map((r) => <RecurringRow key={r.id} r={r} cat={cat} onEdit={onEdit} onDelete={onDelete} />)}
            </div>
          )
        })
      ) : (
        visibleItems.map((r) => {
          const cat = r.categoryId ? categoryById.get(r.categoryId) : undefined
          return <RecurringRow key={r.id} r={r} cat={cat} onEdit={onEdit} onDelete={onDelete} />
        })
      )}
    </div>
  )
}

function RecurringRow({
  r,
  cat,
  onEdit,
  onDelete,
}: {
  r: RecurringWithAmounts
  cat: Category | undefined
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const cadenceLabel = (() => {
    if (r.cadence === 'monthly') {
      const dom = r.dayOfMonth ?? 1
      const domLabel = dom === -1 ? 'last day' : dom === -2 ? '2nd to last' : `day ${dom}`
      return `Monthly · ${domLabel}`
    }
    if (r.cadence === 'yearly') {
      const d = new Date(r.startDate)
      return `Yearly · ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
    }
    return 'Yearly'
  })()
  return (
    <div onClick={() => onEdit(r.id)} style={{ cursor: 'pointer' }}>
      <div className="fern-txn-row" style={{ cursor: 'pointer' }}>
        <CatSwatch color={cat?.color} icon={cat?.icon ?? 'tag'} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{r.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-faint)' }}>
            <Icon name="repeat" size={10} /> {cadenceLabel}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: r.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
          {r.kind === 'income' ? '+' : '−'}{fmt(r.amount)}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(r.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'grid', placeItems: 'center', padding: 4 }}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  )
}
