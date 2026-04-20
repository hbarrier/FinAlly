'use client'

import { useState, useTransition, useMemo } from 'react'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Chip } from '@/components/fern/chip'
import { SegmentedControl } from '@/components/fern/segmented-control'
import { TransactionSheet } from '@/components/fern/sheets/transaction-sheet'
import { fmt, allOccurrencesInRange, type Category, type Transaction, type Recurring } from '@/lib/derive'
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
  clearTransaction,
  detachTransactionFromRecurring,
} from '@/lib/actions/transactions'
import { RecurringLinkSheet } from '@/components/fern/sheets/recurring-link-sheet'
import { ImportWizard } from './import-wizard'

type Merchant = { id: string; name: string; categoryId: string | null }

type VirtualEntry = {
  _virtual: true
  id: string
  date: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string | null
  recurringId: string
  name: string
}

type Movement = Transaction | VirtualEntry

function isVirtual(m: Movement): m is VirtualEntry {
  return '_virtual' in m && (m as VirtualEntry)._virtual === true
}

interface TransactionsClientProps {
  transactions: Transaction[]
  categories: Category[]
  merchants: Merchant[]
  recurring: Recurring[]
  initialMerchantId?: string
}

export function TransactionsClient({ transactions: txns, categories, merchants, recurring, initialMerchantId = 'all' }: TransactionsClientProps) {
  const [q, setQ] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [merchantFilter, setMerchantFilter] = useState(initialMerchantId)
  const [clearedFilter, setClearedFilter] = useState<'all' | 'cleared' | 'uncleared'>('all')
  const [importOpen, setImportOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [linkSheetOpen, setLinkSheetOpen] = useState(false)
  const [linkingTxn, setLinkingTxn] = useState<Transaction | null>(null)
  const [prefillData, setPrefillData] = useState<{
    date: string; amount: number; kind: 'expense' | 'income'
    categoryId: string | null; note: string; recurringId: string
  } | null>(null)
  const [, startTransition] = useTransition()

  // Generate virtual entries for recurring occurrences not yet logged as transactions
  const virtualEntries = useMemo(() => {
    if (!recurring.length) return []
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const twelveMonthsAgo = new Date(today)
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

    // Dedup by period rather than exact date: a transaction logged any day within
    // the expected cadence period counts as covering that occurrence.
    function periodKey(isoDate: string, cadence: string): string {
      if (cadence === 'yearly') return isoDate.slice(0, 4)
      if (cadence === 'monthly') return isoDate.slice(0, 7)
      // weekly / biweekly: use the ISO Monday of that week as period key
      const d = new Date(isoDate + 'T12:00:00')
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      return monday.toISOString().slice(0, 10)
    }

    const loggedPeriods = new Set<string>()
    txns
      .filter((t) => t.recurringId)
      .forEach((t) => {
        const r = recurring.find((r) => r.id === t.recurringId)
        if (r) loggedPeriods.add(`${t.recurringId}:${periodKey(t.date, r.cadence)}`)
      })

    return allOccurrencesInRange(recurring, twelveMonthsAgo, today)
      .filter((o) => !loggedPeriods.has(`${o.id}:${periodKey(o.date.toISOString().slice(0, 10), o.cadence)}`))
      .map((o) => ({
        _virtual: true as const,
        id: `virtual:${o.id}:${o.date.toISOString().slice(0, 10)}`,
        date: o.date.toISOString().slice(0, 10),
        amount: o.amount,
        kind: o.kind,
        categoryId: o.categoryId,
        recurringId: o.id,
        name: o.name,
      }))
  }, [recurring, txns])

  const filtered = useMemo(() => {
    const all: Movement[] = [...txns, ...virtualEntries]
    return all.filter((m) => {
      if (kindFilter !== 'all' && m.kind !== kindFilter) return false
      if (catFilter !== 'all' && m.categoryId !== catFilter) return false
      if (merchantFilter !== 'all') {
        if (isVirtual(m)) return false
        if ((m as Transaction).merchantId !== merchantFilter) return false
      }
      if (clearedFilter !== 'all') {
        if (isVirtual(m)) {
          // virtual entries are inherently uncleared — hide them only when filtering for cleared
          if (clearedFilter === 'cleared') return false
        } else {
          const isCleared = (m as Transaction).cleared === 1
          if (clearedFilter === 'cleared' && !isCleared) return false
          if (clearedFilter === 'uncleared' && isCleared) return false
        }
      }
      if (q) {
        const cat = categories.find((c) => c.id === m.categoryId)
        const hay = isVirtual(m)
          ? `${m.name} ${cat?.name ?? ''}`.toLowerCase()
          : `${(m as Transaction).note ?? ''} ${cat?.name ?? ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [txns, virtualEntries, kindFilter, catFilter, merchantFilter, clearedFilter, q, categories])

  // Group by year → date
  const yearGroups = useMemo(() => {
    const byDate: Record<string, Movement[]> = {}
    filtered.forEach((m) => {
      byDate[m.date] = byDate[m.date] ?? []
      byDate[m.date].push(m)
    })
    const byYear: Record<string, [string, Movement[]][]> = {}
    Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([date, items]) => {
        const year = date.slice(0, 4)
        byYear[year] = byYear[year] ?? []
        byYear[year].push([date, items])
      })
    return Object.entries(byYear).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  const filteredActual = filtered.filter((m) => !isVirtual(m)).length
  const filteredScheduled = filtered.filter(isVirtual).length

  const closeSheet = () => {
    setSheetOpen(false)
    setEditingTxn(null)
    setPrefillData(null)
  }

  const handleSave = async (data: Parameters<typeof addTransaction>[0]) => {
    startTransition(async () => {
      if (editingTxn) {
        await updateTransaction(editingTxn.id, data)
      } else {
        await addTransaction({ ...data, recurringId: prefillData?.recurringId ?? null })
      }
    })
    closeSheet()
  }

  const handleDelete = async () => {
    if (!editingTxn) return
    startTransition(async () => { await deleteTransaction(editingTxn.id) })
    closeSheet()
  }

  const handleDetach = async () => {
    if (!linkingTxn) return
    startTransition(async () => { await detachTransactionFromRecurring(linkingTxn.id) })
    setLinkSheetOpen(false)
    setLinkingTxn(null)
  }

  const handleOpenVirtual = (entry: VirtualEntry) => {
    setPrefillData({
      date: entry.date,
      amount: entry.amount,
      kind: entry.kind,
      categoryId: entry.categoryId,
      note: entry.name,
      recurringId: entry.recurringId,
    })
    setEditingTxn(null)
    setSheetOpen(true)
  }

  return (
    <div>
      <div className="fern-page-header">
        <div>
          <div className="fern-page-kicker">All history</div>
          <h1 className="fern-page-title">Your <em>movements</em></h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)' }}>
            {filteredActual} of {txns.length}
            {filteredScheduled > 0 && <> · <span style={{ color: 'var(--butter-ink)' }}>{filteredScheduled} scheduled</span></>}
          </span>
          <button
            onClick={() => setImportOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, background: 'var(--bg-elevated)', color: 'var(--ink-soft)', border: '1.5px solid var(--line)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <Icon name="upload" size={16} /> Import
          </button>
          <button
            onClick={() => { setEditingTxn(null); setPrefillData(null); setSheetOpen(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, background: 'var(--terracotta)', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <Icon name="plus" size={16} /> Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220, background: 'var(--bg-elevated)', borderRadius: 10, padding: '0 12px', border: '1.5px solid var(--line)', flexShrink: 0 }}>
          <Icon name="search" size={16} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
          <input
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--ink)', padding: '10px 0', minWidth: 0 }}
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 0, display: 'grid', placeItems: 'center' }}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <SegmentedControl
          value={kindFilter}
          onChange={setKindFilter}
          options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]}
        />
        <SegmentedControl
          value={clearedFilter}
          onChange={(v) => setClearedFilter(v as 'all' | 'cleared' | 'uncleared')}
          options={[{ value: 'all', label: 'All' }, { value: 'cleared', label: 'Cleared' }, { value: 'uncleared', label: 'Pending' }]}
        />
        <select
          className="fern-select"
          style={{ maxWidth: 180 }}
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="fern-select"
          style={{ maxWidth: 180 }}
          value={merchantFilter}
          onChange={(e) => setMerchantFilter(e.target.value)}
        >
          <option value="all">All merchants</option>
          {merchants.sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {txns.length === 0 && virtualEntries.length === 0 ? (
        <div className="fern-empty">
          <div className="illu">◇</div>
          <h3 style={{ fontSize: 18, margin: '0 0 8px' }}>No transactions yet</h3>
          <p style={{ margin: 0 }}>Log your first expense or income to see it here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="fern-empty">
          <div className="illu">◌</div>
          <h3 style={{ fontSize: 18, margin: '0 0 8px' }}>Nothing matches</h3>
          <p style={{ margin: 0 }}>Try a different search or filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {yearGroups.map(([year, dateGroups]) => (
            <div key={year}>
              <h2 style={{ margin: '0 0 10px 4px', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)' }}>{year}</h2>
              <div className="fern-card" style={{ padding: '8px 16px' }}>
                {dateGroups.map(([date, items]) => {
                  const total = items.reduce((s, m) => s + (m.kind === 'income' ? 1 : -1) * Number(m.amount ?? 0), 0)
                  const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
                  return (
                    <div key={date}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px 6px', fontSize: 12, borderBottom: '1px solid var(--line-soft)' }}>
                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>{label}</h4>
                        <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 12, color: total >= 0 ? 'var(--sage-ink)' : 'var(--ink-faint)' }}>
                          {total >= 0 ? '+' : '−'}{fmt(Math.abs(total))}
                        </span>
                      </div>
                      {items.map((m) => {
                  const cat = categories.find((c) => c.id === m.categoryId)
                  if (isVirtual(m)) {
                    return (
                      <div
                        key={m.id}
                        className="fern-txn-row"
                        style={{ opacity: 0.6 }}
                        onClick={() => handleOpenVirtual(m)}
                      >
                        <CatSwatch color={cat?.color} icon={cat?.icon ?? 'tag'} size={34} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{cat?.name ?? 'Uncategorized'}</span>
                            <Chip tone="scheduled"><Icon name="repeat" size={10} /> scheduled</Chip>
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: m.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
                          {m.kind === 'income' ? '+' : '−'}{fmt(Math.abs(m.amount ?? 0))}
                        </div>
                        <button
                          title="Log and mark as cleared"
                          onClick={(e) => {
                            e.stopPropagation()
                            startTransition(async () => {
                              await addTransaction({
                                date: m.date,
                                amount: m.amount,
                                kind: m.kind,
                                categoryId: m.categoryId,
                                note: m.name,
                                recurringId: m.recurringId,
                                cleared: 1,
                              })
                            })
                          }}
                          style={{
                            flexShrink: 0,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            border: '1.5px solid var(--line)',
                            background: 'transparent',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        />
                      </div>
                    )
                  }
                  const t = m as Transaction
                  const merchant = merchants.find((mer) => mer.id === t.merchantId)
                  const isCleared = t.cleared === 1
                  return (
                    <div key={t.id} className="fern-txn-row" onClick={() => { setEditingTxn(t); setPrefillData(null); setSheetOpen(true) }}>
                      <CatSwatch color={cat?.color} icon={cat?.icon ?? 'tag'} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.note ?? merchant?.name ?? cat?.name ?? 'Transaction'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{cat?.name ?? 'Uncategorized'}</span>
                          {merchant && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>· {merchant.name}</span>}
                          {t.recurringId && <Chip tone="recurring"><Icon name="repeat" size={10} /> recurring</Chip>}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
                        {t.kind === 'income' ? '+' : '−'}{fmt(Math.abs(t.amount ?? 0))}
                      </div>
                      <button
                        title={t.recurringId ? 'Manage recurring link' : 'Make recurring'}
                        onClick={(e) => { e.stopPropagation(); setLinkingTxn(t); setLinkSheetOpen(true) }}
                        style={{
                          flexShrink: 0,
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          border: t.recurringId ? 'none' : '1.5px dashed var(--line)',
                          background: t.recurringId ? 'var(--sage-bg)' : 'transparent',
                          color: t.recurringId ? 'var(--sage-ink)' : 'var(--ink-faint)',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <Icon name="repeat" size={12} />
                      </button>
                      <button
                        title={isCleared ? 'Mark as pending' : 'Mark as cleared'}
                        onClick={(e) => {
                          e.stopPropagation()
                          startTransition(async () => { await clearTransaction(t.id, !isCleared) })
                        }}
                        style={{
                          flexShrink: 0,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: isCleared ? 'none' : '1.5px solid var(--line)',
                          background: isCleared ? 'var(--sage)' : 'transparent',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'background 0.15s, border 0.15s',
                        }}
                      >
                        {isCleared && <Icon name="check" size={12} style={{ color: '#fff' }} />}
                      </button>
                    </div>
                  )
                })}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className="fern-fab"
        onClick={() => { setEditingTxn(null); setPrefillData(null); setSheetOpen(true) }}
        aria-label="Log something"
      >
        <Icon name="plus" size={26} />
      </button>

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        merchants={merchants}
        recurring={recurring}
        categories={categories}
      />

      <TransactionSheet
        open={sheetOpen}
        onClose={closeSheet}
        categories={categories}
        merchants={merchants}
        item={editingTxn}
        prefill={prefillData ? {
          date: prefillData.date,
          amount: prefillData.amount,
          kind: prefillData.kind,
          categoryId: prefillData.categoryId,
          note: prefillData.note,
        } : null}
        onSave={handleSave}
        onDelete={editingTxn ? handleDelete : undefined}
      />

      {linkingTxn && (
        <RecurringLinkSheet
          open={linkSheetOpen}
          onClose={() => { setLinkSheetOpen(false); setLinkingTxn(null) }}
          transaction={linkingTxn}
          categories={categories}
          recurring={recurring}
          onDetach={linkingTxn.recurringId ? handleDetach : undefined}
        />
      )}
    </div>
  )
}
