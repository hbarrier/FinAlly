'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { SegmentedControl } from '@/components/fern/segmented-control'
import { MerchantSheet } from '@/components/fern/sheets/merchant-sheet'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import type { Category } from '@/lib/derive'
import type { Merchant } from '@/lib/db-types'
import { addMerchant, updateMerchant, deleteMerchant, mergeMerchants } from '@/lib/actions/merchants'
import { runAction } from '@/lib/utils'

interface MerchantsClientProps {
  merchants: Merchant[]
  categories: Category[]
  transactions: { id: string; merchantId: string | null }[]
}

type FilterMode = 'active' | 'inactive' | 'all'

export function MerchantsClient({ merchants: merchantsList, categories, transactions }: MerchantsClientProps) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [filter, setFilter] = useState<FilterMode>('active')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [, startTransition] = useTransition()

  const usageById = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.forEach((t) => {
      if (t.merchantId) map[t.merchantId] = (map[t.merchantId] ?? 0) + 1
    })
    return map
  }, [transactions])

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const usage = (id: string) => usageById[id] ?? 0

  const editingItem = editing && editing !== 'new' ? merchantsList.find((m) => m.id === editing) : null

  const filteredMerchants = [...merchantsList]
    .filter((m) => {
      if (filter === 'active') return m.isActive === 1
      if (filter === 'inactive') return m.isActive === 0
      return true
    })
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleSave = async (data: Parameters<typeof addMerchant>[0] & { isActive?: number }) => {
    startTransition(runAction(async () => {
      if (editing && editing !== 'new') {
        await updateMerchant(editing, data)
      } else {
        await addMerchant(data)
      }
    }))
    setEditing(null)
  }

  const handleDelete = async (m: Merchant) => {
    const used = usage(m.id)
    const msg = used > 0
      ? `This merchant is used in ${used} transaction${used === 1 ? '' : 's'}. Delete anyway?`
      : `Delete "${m.name}"?`
    if (!confirm(msg)) return
    startTransition(runAction(async () => { await deleteMerchant(m.id) }))
  }

  const handleMerge = async () => {
    const [keepId, ...mergeIds] = selected
    const keeper = merchantsList.find((m) => m.id === keepId)!
    const mergeCount = mergeIds.length
    if (!confirm(`Merge ${mergeCount} merchant${mergeCount > 1 ? 's' : ''} into "${keeper.name}"? This cannot be undone.`)) return
    startTransition(runAction(async () => { await mergeMerchants(keepId, mergeIds) }))
    setSelected([])
  }

  return (
    <div>
      <PageHeader
        kicker={`${merchantsList.length} merchants`}
        title={<>Your <em>merchants</em></>}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SegmentedControl
              value={filter}
              onChange={(v) => setFilter(v as FilterMode)}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'all', label: 'All' },
              ]}
            />
            <FernButton onClick={() => setEditing('new')}>
              <Icon name="plus" size={16} /> New merchant
            </FernButton>
          </div>
        }
      />

      <div style={{ marginBottom: 12 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search merchants…"
          style={{ width: '100%', padding: '9px 14px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {selected.length >= 2 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'var(--bg-sunken)', border: '1.5px solid var(--line)', marginBottom: 12 }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>
            Merge {selected.length - 1} merchant{selected.length - 1 > 1 ? 's' : ''} into <strong>{merchantsList.find((m) => m.id === selected[0])?.name}</strong>
          </span>
          <button
            onClick={handleMerge}
            style={{ padding: '7px 14px', borderRadius: 9, background: 'var(--terracotta)', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Merge
          </button>
          <button
            onClick={() => setSelected([])}
            style={{ padding: '7px 14px', borderRadius: 9, background: 'transparent', color: 'var(--ink-faint)', border: '1.5px solid var(--line)', fontSize: 13, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}

      {merchantsList.length === 0 ? (
        <EmptyState
          title="No merchants yet"
          description="Add merchants and link them to categories to speed up expense logging."
          action={
            <FernButton
              tone="outline"
              onClick={() => setEditing('new')}
              style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, fontSize: 13, background: 'transparent', color: 'var(--ink)' }}
            >
              <Icon name="plus" size={14} /> Add merchant
            </FernButton>
          }
        />
      ) : filteredMerchants.length === 0 ? (
        <EmptyState title="No results" description="Try a different search or filter." />
      ) : (
        <div className="fern-card" style={{ padding: '8px 0' }}>
          {filteredMerchants.map((m) => {
            const cat = m.categoryId ? categoryById.get(m.categoryId) : undefined
            const used = usage(m.id)
            const isSelected = selected.includes(m.id)
            const isKeeper = selected[0] === m.id
            return (
              <div
                key={m.id}
                className="fern-txn-row"
                style={{ padding: '12px 16px', opacity: m.isActive === 0 ? 0.5 : 1, background: isSelected ? 'var(--bg-sunken)' : undefined, cursor: 'pointer' }}
                onClick={() => {
                  if (selected.length > 0) {
                    toggleSelect(m.id)
                  } else {
                    setEditing(m.id)
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginRight: 8 }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(m.id)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--terracotta)' }}
                  />
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: cat ? undefined : 'var(--bg-sunken)', display: 'grid', placeItems: 'center' }}>
                  {cat ? (
                    <CatSwatch color={cat.color} icon={cat.icon} size={40} />
                  ) : (
                    <Icon name="store" size={20} style={{ color: 'var(--ink-faint)' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.name}
                    {isKeeper && selected.length >= 2 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'var(--terracotta)', color: 'white', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Primary</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>
                    {cat ? cat.name : 'No default category'}
                    {m.comment && <span style={{ marginLeft: 8 }}>· {m.comment}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
                  {used} use{used === 1 ? '' : 's'}
                </span>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/transactions?merchant=${m.id}`}
                    title="View transactions"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 6, textDecoration: 'none' }}
                  >
                    <Icon name="list" size={14} />
                  </Link>
                  <button onClick={() => setEditing(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 6 }}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button onClick={() => handleDelete(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 6 }}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <MerchantSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        categories={categories}
        item={editingItem ?? null}
        onSave={handleSave}
      />
    </div>
  )
}
