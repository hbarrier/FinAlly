'use client'

import { useState, useTransition } from 'react'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { SegmentedControl } from '@/components/fern/segmented-control'
import { CategorySheet } from '@/components/fern/sheets/category-sheet'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { fmt, type Category } from '@/lib/derive'
import type { CategoryStats } from '@/lib/queries/category-stats'
import { addCategory, updateCategory, deleteCategory, setCategoryActive } from '@/lib/actions/categories'
import { runAction, REIMBURSEMENT_CATEGORY_NAME } from '@/lib/utils'
import { confirmDialog } from '@/lib/dialogs-store'

interface CategoriesClientProps {
  categories: Category[]
  stats: CategoryStats
}

export function CategoriesClient({ categories, stats }: CategoriesClientProps) {
  const [kindTab, setKindTab] = useState('all')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [, startTransition] = useTransition()

  const spending = stats.monthSpend
  const usageById = stats.usage

  const filtered = categories
    .filter((c) => kindTab === 'all' || c.kind === kindTab)
    .sort((a, b) => b.isActive - a.isActive)
  const expenseCount = categories.filter((c) => c.kind === 'expense').length
  const incomeCount = categories.filter((c) => c.kind === 'income').length

  const usage = (id: string) => usageById[id] ?? 0

  const editingItem = editing && editing !== 'new' ? categories.find((c) => c.id === editing) : null

  const handleSave = async (data: Parameters<typeof addCategory>[0]) => {
    startTransition(runAction(async () => {
      if (editing && editing !== 'new') {
        await updateCategory(editing, data)
      } else {
        await addCategory(data)
      }
    }))
    setEditing(null)
  }

  const isProtected = (cat: Category) =>
    cat.isPensionAlimentaire === 1 || cat.name === REIMBURSEMENT_CATEGORY_NAME

  const handleDelete = async (cat: Category) => {
    if (!(await confirmDialog({ message: `Delete "${cat.name}"?`, confirmLabel: 'Delete', tone: 'danger' }))) return
    startTransition(runAction(async () => { await deleteCategory(cat.id) }))
  }

  const handleToggleActive = async (cat: Category) => {
    const active = cat.isActive === 1
    if (active) {
      const used = usage(cat.id)
      const msg = used > 0
        ? `"${cat.name}" has ${used} transaction${used === 1 ? '' : 's'} and can't be deleted. Deactivate it so it can't be picked anymore? Your budget and simulations keep it.`
        : `Deactivate "${cat.name}" so it can't be picked anymore?`
      if (!(await confirmDialog({ message: msg, confirmLabel: 'Deactivate', tone: 'danger' }))) return
    }
    startTransition(runAction(async () => { await setCategoryActive(cat.id, !active) }))
  }

  return (
    <div>
      <PageHeader
        kicker={`${categories.length} total · ${expenseCount} expense · ${incomeCount} income`}
        title={<>Your <em>categories</em></>}
        actions={
          <FernButton onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> New category
          </FernButton>
        }
      />

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
        <EmptyState
          illu="∅"
          title="No categories yet"
          description="Create your first category to start logging."
          action={
            <FernButton
              tone="outline"
              onClick={() => setEditing('new')}
              style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, fontSize: 13, background: 'transparent', color: 'var(--ink)' }}
            >
              <Icon name="plus" size={14} /> Add category
            </FernButton>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filtered.map((c) => {
            const used = usage(c.id)
            const spent = spending[c.id] ?? 0
            const inactive = c.isActive === 0
            const protectedCat = isProtected(c)
            const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 6 } as const
            return (
              <div key={c.id} className="fern-card" style={{ padding: 16, opacity: inactive ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <CatSwatch color={c.color} icon={c.icon} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
                      {c.kind}{inactive && ' · Inactive'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => setEditing(c.id)} style={iconBtn}>
                      <Icon name="edit" size={14} />
                    </button>
                    {inactive ? (
                      <button onClick={() => handleToggleActive(c)} style={iconBtn} aria-label="Reactivate">
                        <Icon name="check" size={14} />
                      </button>
                    ) : protectedCat ? null : used > 0 ? (
                      <button onClick={() => handleToggleActive(c)} style={iconBtn} aria-label="Deactivate">
                        <Icon name="x" size={14} />
                      </button>
                    ) : (
                      <button onClick={() => handleDelete(c)} style={iconBtn} aria-label="Delete">
                        <Icon name="trash" size={14} />
                      </button>
                    )}
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
