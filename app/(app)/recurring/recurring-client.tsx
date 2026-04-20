'use client'

import { useMemo, useState, useTransition } from 'react'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { RecurringSheet } from '@/components/fern/sheets/recurring-sheet'
import { AmountSparkline } from '@/components/fern/amount-history-chart'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { fmt, monthlyEstimate, type Category, type RecurringWithAmounts } from '@/lib/derive'
import { addRecurring, updateRecurring, deleteRecurring } from '@/lib/actions/recurring'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface RecurringClientProps {
  recurring: RecurringWithAmounts[]
  categories: Category[]
}

export function RecurringClient({ recurring, categories }: RecurringClientProps) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [, startTransition] = useTransition()

  const bills = recurring.filter((r) => r.kind === 'expense')
  const incomes = recurring.filter((r) => r.kind === 'income')
  const monthlyOut = bills.reduce((s, r) => s + monthlyEstimate(r), 0)
  const monthlyIn = incomes.reduce((s, r) => s + monthlyEstimate(r), 0)

  const editingItem = editing && editing !== 'new' ? recurring.find((r) => r.id === editing) : null

  const handleSave = async (data: Parameters<typeof addRecurring>[0]) => {
    startTransition(async () => {
      if (editing && editing !== 'new') {
        await updateRecurring(editing, data)
      } else {
        await addRecurring(data)
      }
    })
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring item?')) return
    startTransition(async () => { await deleteRecurring(id) })
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
        item={editingItem ?? null}
        amounts={editingItem?.amounts ?? []}
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
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  return (
    <div className="fern-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
        <span className="fern-page-kicker">{items.length} items</span>
      </div>
      {items.length === 0 ? (
        <div style={{ color: 'var(--ink-faint)', padding: '20px 0', textAlign: 'center', fontSize: 13 }}>None yet</div>
      ) : (
        items.map((r) => {
          const cat = r.categoryId ? categoryById.get(r.categoryId) : undefined
          const cadenceLabel = (() => {
            if (r.cadence === 'monthly') return `Monthly · day ${r.dayOfMonth ?? 1}`
            if (r.cadence === 'weekly') return `Weekly · ${DOW[r.dayOfWeek ?? 1]}`
            if (r.cadence === 'yearly') {
              const d = new Date(r.startDate)
              return `Yearly · ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
            }
            return 'Yearly'
          })()
          const sparklineColor = r.kind === 'income' ? 'var(--sage)' : 'var(--rose)'
          return (
            <div key={r.id} onClick={() => onEdit(r.id)} style={{ cursor: 'pointer' }}>
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
              {r.amounts.length >= 2 && (
                <div style={{ paddingLeft: 46, paddingRight: 28, marginTop: -4, marginBottom: 4 }}>
                  <AmountSparkline amounts={r.amounts} color={sparklineColor} />
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
