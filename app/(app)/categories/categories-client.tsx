'use client'

import { useState, useTransition } from 'react'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { SegmentedControl } from '@/components/fern/segmented-control'
import { CategorySheet } from '@/components/fern/sheets/category-sheet'
import { fmt, thisMonthTransactions, type Category, type Transaction } from '@/lib/derive'
import { addCategory, updateCategory, deleteCategory } from '@/lib/actions/categories'

interface CategoriesClientProps {
  categories: Category[]
  transactions: Transaction[]
}

export function CategoriesClient({ categories, transactions: txns }: CategoriesClientProps) {
  const [kindTab, setKindTab] = useState('all')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [, startTransition] = useTransition()

  const monthTxns = thisMonthTransactions(txns)
  const spending: Record<string, number> = {}
  monthTxns.filter((t) => t.kind === 'expense').forEach((t) => {
    if (t.categoryId) spending[t.categoryId] = (spending[t.categoryId] ?? 0) + Number(t.amount ?? 0)
  })

  const filtered = categories.filter((c) => kindTab === 'all' || c.kind === kindTab)
  const expenseCount = categories.filter((c) => c.kind === 'expense').length
  const incomeCount = categories.filter((c) => c.kind === 'income').length

  const usage = (id: string) => txns.filter((t) => t.categoryId === id).length

  const editingItem = editing && editing !== 'new' ? categories.find((c) => c.id === editing) : null

  const handleSave = async (data: Parameters<typeof addCategory>[0]) => {
    startTransition(async () => {
      if (editing && editing !== 'new') {
        await updateCategory(editing, data)
      } else {
        await addCategory(data)
      }
    })
    setEditing(null)
  }

  const handleDelete = async (cat: Category) => {
    const used = usage(cat.id)
    const msg = used > 0
      ? `This category has ${used} transaction${used === 1 ? '' : 's'}. Delete anyway? They'll become "Uncategorized".`
      : `Delete "${cat.name}"?`
    if (!confirm(msg)) return
    startTransition(async () => { await deleteCategory(cat.id) })
  }

  return (
    <div>
      <div className="fern-page-header">
        <div>
          <div className="fern-page-kicker">{categories.length} total · {expenseCount} expense · {incomeCount} income</div>
          <h1 className="fern-page-title">Your <em>categories</em></h1>
        </div>
        <button
          onClick={() => setEditing('new')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, background: 'var(--terracotta)', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          <Icon name="plus" size={16} /> New category
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <SegmentedControl
          value={kindTab}
          onChange={setKindTab}
          options={[
            { value: 'all', label: `All (${categories.length})` },
            { value: 'expense', label: `Expenses (${expenseCount})` },
            { value: 'income', label: `Income (${incomeCount})` },
          ]}
        />
      </div>

      {categories.length === 0 ? (
        <div className="fern-empty">
          <div className="illu">∅</div>
          <h3 style={{ fontSize: 18, margin: '0 0 8px' }}>No categories yet</h3>
          <p style={{ margin: 0 }}>Create your first category to start logging.</p>
          <button onClick={() => setEditing('new')} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
            <Icon name="plus" size={14} /> Add category
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filtered.map((c) => {
            const used = usage(c.id)
            const spent = spending[c.id] ?? 0
            return (
              <div key={c.id} className="fern-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <CatSwatch color={c.color} icon={c.icon} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
                      {c.kind}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => setEditing(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 6 }}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button onClick={() => handleDelete(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 6 }}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12, color: 'var(--ink-soft)', borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
                  <span>{used} transaction{used === 1 ? '' : 's'}</span>
                  {c.kind === 'expense' && <span style={{ fontFamily: 'var(--mono-fern)' }}>{fmt(spent)} this month</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CategorySheet
        open={!!editing}
        onClose={() => setEditing(null)}
        item={editingItem ?? null}
        onSave={handleSave}
      />
    </div>
  )
}
