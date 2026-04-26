'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Chip } from '@/components/fern/chip'
import { SegmentedControl } from '@/components/fern/segmented-control'
import { TransactionSheet } from '@/components/fern/sheets/transaction-sheet'
import { fmt, allOccurrencesInRange, formatDate, type Category, type Transaction, type Recurring } from '@/lib/derive'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { Fab } from '@/components/fern/fab'
import {
  ReimbursementMappingSheet,
  type ReimbursementMappingExpense,
} from '@/components/fern/sheets/reimbursement-mapping-sheet'
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
  clearTransaction,
  detachTransactionFromRecurring,
} from '@/lib/actions/transactions'
import {
  mapReimbursementIncomeToExpenses,
  setExpenseManualSettlement,
} from '@/lib/actions/reimbursements'
import { RecurringLinkSheet } from '@/components/fern/sheets/recurring-link-sheet'
import { BulkRecurringLinkSheet } from '@/components/fern/sheets/bulk-recurring-link-sheet'
import type { Merchant } from '@/lib/db-types'

const ImportWizard = dynamic(
  () => import('./import-wizard').then((m) => m.ImportWizard),
  { ssr: false },
)

type VirtualEntry = {
  _virtual: true
  id: string
  date: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string | null
  merchantId: string | null
  recurringId: string
  name: string
}

type Movement = Transaction | VirtualEntry

type ReimbursementFilter =
  | 'all'
  | 'unresolved'
  | 'expense:not_reimbursed'
  | 'expense:partially_reimbursed'
  | 'expense:reimbursed'
  | 'expense:manually_settled'
  | 'income:unmapped'
  | 'income:partially_allocated'
  | 'income:fully_allocated'

function isVirtual(m: Movement): m is VirtualEntry {
  return '_virtual' in m
}

function isUnresolvedReimbursementStatus(status: string) {
  return (
    status === 'not_reimbursed' ||
    status === 'partially_reimbursed' ||
    status === 'no_rate' ||
    status === 'unmapped' ||
    status === 'partially_allocated'
  )
}

interface TransactionsClientProps {
  transactions: Transaction[]
  categories: Category[]
  merchants: Merchant[]
  recurring: Recurring[]
  eligibleReimbursementExpenses: ReimbursementMappingExpense[]
  reimbursementSummaries: Record<string, { status: string; label: string }>
  reimbursementMappingCounts: Record<string, number>
  initialMerchantId?: string
  selectedYear: number
  years: string[]
}

export function TransactionsClient({
  transactions: txns,
  categories,
  merchants,
  recurring,
  eligibleReimbursementExpenses,
  reimbursementSummaries,
  reimbursementMappingCounts,
  initialMerchantId = 'all',
  selectedYear,
  years,
}: TransactionsClientProps) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [merchantFilter, setMerchantFilter] = useState(initialMerchantId)
  const [clearedFilter, setClearedFilter] = useState<'all' | 'cleared' | 'uncleared'>('all')
  const [reimbursementFilter, setReimbursementFilter] = useState<ReimbursementFilter>('all')
  const [importOpen, setImportOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [linkSheetOpen, setLinkSheetOpen] = useState(false)
  const [linkingTxn, setLinkingTxn] = useState<Transaction | null>(null)
  const [mappingSheetOpen, setMappingSheetOpen] = useState(false)
  const [mappingIncome, setMappingIncome] = useState<Transaction | null>(null)
  const [prefillData, setPrefillData] = useState<{
    date: string; amount: number; kind: 'expense' | 'income'
    categoryId: string | null; merchantId: string | null; note: string; recurringId: string
  } | null>(null)
  const [visibleMonthsByYear, setVisibleMonthsByYear] = useState<Record<number, number>>({})
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkSheetOpen, setBulkSheetOpen] = useState(false)
  const [, startTransition] = useTransition()
  const clearSheetStateTimer = useRef<number | null>(null)

  const visibleMonths = visibleMonthsByYear[selectedYear] ?? 2
  const setVisibleMonths = (updater: (current: number) => number) => {
    setVisibleMonthsByYear((prev) => ({
      ...prev,
      [selectedYear]: updater(prev[selectedYear] ?? 2),
    }))
  }

  // Generate virtual entries for recurring occurrences not yet logged as transactions
  const virtualEntries = useMemo(() => {
    if (!recurring.length) return []
    const yearStart = new Date(`${selectedYear}-01-01T00:00:00`)
    const rangeEnd = new Date(Math.min(
      new Date(`${selectedYear}-12-31T23:59:59`).getTime(),
      new Date().getTime(),
    ))
    rangeEnd.setHours(23, 59, 59, 999)

    // Format a Date as YYYY-MM-DD in local time (not UTC) to avoid off-by-one
    // when local midnight is behind UTC (e.g. France UTC+1/+2).
    function localDateStr(d: Date): string {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

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

    const recurringById = new Map(recurring.map((r) => [r.id, r]))
    const loggedPeriods = new Set<string>()
    txns
      .filter((t) => t.recurringId)
      .forEach((t) => {
        const r = recurringById.get(t.recurringId!)
        if (r) loggedPeriods.add(`${t.recurringId}:${periodKey(t.date, r.cadence)}`)
      })

    return allOccurrencesInRange(recurring, yearStart, rangeEnd)
      .filter((o) => !loggedPeriods.has(`${o.id}:${periodKey(localDateStr(o.date), o.cadence)}`))
      .map((o) => ({
        _virtual: true as const,
        id: `virtual:${o.id}:${localDateStr(o.date)}`,
        date: localDateStr(o.date),
        amount: o.amount,
        kind: o.kind,
        categoryId: o.categoryId,
        merchantId: o.merchantId ?? null,
        recurringId: o.id,
        name: o.name,
      }))
  }, [recurring, txns, selectedYear])

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const merchantById = useMemo(
    () => new Map(merchants.map((m) => [m.id, m])),
    [merchants],
  )

  const merchantsSortedByName = useMemo(
    () => [...merchants].sort((a, b) => a.name.localeCompare(b.name)),
    [merchants],
  )

  const filtered = useMemo(() => {
    const all: Movement[] = [...txns, ...virtualEntries]
    const needle = q.toLowerCase()
    return all.filter((m) => {
      if (kindFilter !== 'all' && m.kind !== kindFilter) return false
      if (catFilter !== 'all' && m.categoryId !== catFilter) return false
      if (merchantFilter !== 'all') {
        if (isVirtual(m)) return false
        if ((m as Transaction).merchantId !== merchantFilter) return false
      }
      if (clearedFilter !== 'all') {
        if (isVirtual(m)) {
          if (clearedFilter === 'cleared') return false
        } else {
          const isCleared = (m as Transaction).cleared === 1
          if (clearedFilter === 'cleared' && !isCleared) return false
          if (clearedFilter === 'uncleared' && isCleared) return false
        }
      }
      if (reimbursementFilter !== 'all') {
        if (isVirtual(m)) return false

        const summary = reimbursementSummaries[m.id]
        if (!summary) return false

        if (reimbursementFilter === 'unresolved') {
          if (!isUnresolvedReimbursementStatus(summary.status)) return false
        } else {
          const [scope, status] = reimbursementFilter.split(':')
          if (summary.status !== status) return false
          if (scope === 'expense' && m.kind !== 'expense') return false
          if (scope === 'income' && m.kind !== 'income') return false
        }
      }
      if (q) {
        const cat = m.categoryId ? categoryById.get(m.categoryId) : undefined
        const hay = isVirtual(m)
          ? `${m.name} ${cat?.name ?? ''}`.toLowerCase()
          : `${(m as Transaction).note ?? ''} ${cat?.name ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [
    txns,
    virtualEntries,
    kindFilter,
    catFilter,
    merchantFilter,
    clearedFilter,
    reimbursementFilter,
    reimbursementSummaries,
    q,
    categoryById,
  ])

  // All months in the filtered data, sorted newest-first
  const allMonths = useMemo(() => {
    const monthSet = new Set<string>()
    filtered.forEach((m) => monthSet.add(m.date.slice(0, 7)))
    return [...monthSet].sort((a, b) => b.localeCompare(a))
  }, [filtered])

  const visibleMonthSet = useMemo(
    () => new Set(allMonths.slice(0, visibleMonths)),
    [allMonths, visibleMonths],
  )

  const visibleEntries = useMemo(
    () => filtered.filter((m) => visibleMonthSet.has(m.date.slice(0, 7))),
    [filtered, visibleMonthSet],
  )

  const visibleRealIds = useMemo(
    () => visibleEntries.filter((m) => !isVirtual(m)).map((m) => m.id),
    [visibleEntries],
  )

  const selectedTransactions = useMemo(
    () => txns.filter((t) => selectedIds.has(t.id)),
    [txns, selectedIds],
  )

  // Group visible entries by date
  const dateGroups = useMemo(() => {
    const byDate: Record<string, Movement[]> = {}
    visibleEntries.forEach((m) => {
      byDate[m.date] = byDate[m.date] ?? []
      byDate[m.date].push(m)
    })
    return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a))
  }, [visibleEntries])

  // Group date groups by month for section headers
  const monthGroups = useMemo(() => {
    const byMonth: Record<string, [string, Movement[]][]> = {}
    dateGroups.forEach(([date, items]) => {
      const month = date.slice(0, 7)
      byMonth[month] = byMonth[month] ?? []
      byMonth[month].push([date, items])
    })
    return Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a))
  }, [dateGroups])

  let filteredActual = 0
  let filteredScheduled = 0
  for (const m of filtered) {
    if (isVirtual(m)) filteredScheduled++
    else filteredActual++
  }

  const closeSheet = () => {
    setSheetOpen(false)
    if (clearSheetStateTimer.current) window.clearTimeout(clearSheetStateTimer.current)
    // Keep editing state until the close animation ends to avoid flashing "create" UI.
    clearSheetStateTimer.current = window.setTimeout(() => {
      setEditingTxn(null)
      setPrefillData(null)
      clearSheetStateTimer.current = null
    }, 250)
  }

  useEffect(() => {
    // If the sheet is opened quickly again, don't let a pending timer clear state mid-open.
    if (sheetOpen && clearSheetStateTimer.current) {
      window.clearTimeout(clearSheetStateTimer.current)
      clearSheetStateTimer.current = null
    }
  }, [sheetOpen])

  useEffect(() => {
    return () => {
      if (clearSheetStateTimer.current) window.clearTimeout(clearSheetStateTimer.current)
    }
  }, [])

  const handleSave = async (data: Parameters<typeof addTransaction>[0]) => {
    if (editingTxn) {
      const mappingCount = reimbursementMappingCounts[editingTxn.id] ?? 0
      const currentCategory = editingTxn.categoryId ? categoryById.get(editingTxn.categoryId) : undefined
      const nextCategory = data.categoryId ? categoryById.get(data.categoryId) : undefined
      const wasReimbursableExpense = editingTxn.kind === 'expense' && editingTxn.reimbursable === 1
      const willBeReimbursableExpense = data.kind === 'expense' && data.reimbursable === 1
      const wasReimbursementIncome =
        editingTxn.kind === 'income' &&
        currentCategory?.kind === 'income' &&
        currentCategory.name === 'Remboursements'
      const willBeReimbursementIncome =
        data.kind === 'income' &&
        nextCategory?.kind === 'income' &&
        nextCategory.name === 'Remboursements'

      if (mappingCount > 0 && wasReimbursableExpense && !willBeReimbursableExpense) {
        const confirmed = window.confirm(
          'This expense has reimbursement mappings. Turning off reimbursable will clear its mappings and manual settlement state.',
        )
        if (!confirmed) return
      }

      if (mappingCount > 0 && wasReimbursementIncome && !willBeReimbursementIncome) {
        const confirmed = window.confirm(
          'This reimbursement income has mappings. Changing it out of the Remboursements category will clear those mappings.',
        )
        if (!confirmed) return
      }
    }

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

  const toggleSelectionMode = () => {
    setSelectionMode((v) => !v)
    setSelectedIds(new Set())
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setBulkSheetOpen(false)
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => setSelectedIds(new Set(visibleRealIds))

  const selectAllInMonth = (month: string) => {
    const ids = visibleEntries
      .filter((m) => !isVirtual(m) && m.date.startsWith(month))
      .map((m) => m.id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }

  const handleOpenVirtual = (entry: VirtualEntry) => {
    setPrefillData({
      date: entry.date,
      amount: entry.amount,
      kind: entry.kind,
      categoryId: entry.categoryId,
      merchantId: entry.merchantId,
      note: entry.name,
      recurringId: entry.recurringId,
    })
    setEditingTxn(null)
    setSheetOpen(true)
  }

  const handleOpenMapping = (transaction: Transaction) => {
    setMappingIncome(transaction)
    setMappingSheetOpen(true)
  }

  const handleSaveMapping = (expenseIds: string[]) => {
    if (!mappingIncome) return
    startTransition(async () => {
      await mapReimbursementIncomeToExpenses(mappingIncome.id, expenseIds)
    })
  }

  const isReimbursementIncome = (transaction: Transaction, category?: Category) =>
    transaction.kind === 'income' &&
    category?.kind === 'income' &&
    category.name === 'Remboursements'

  const isReimbursableExpense = (transaction: Transaction) =>
    transaction.kind === 'expense' && transaction.reimbursable === 1

  return (
    <div>
      <PageHeader
        kicker="All history"
        title={<>Your <em>movements</em></>}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)' }}>
              {filteredActual} of {txns.length}
              {filteredScheduled > 0 && <> · <span style={{ color: 'var(--butter-ink)' }}>{filteredScheduled} scheduled</span></>}
            </span>
            {!selectionMode && (
              <>
                <FernButton tone="outline" onClick={() => setImportOpen(true)}>
                  <Icon name="upload" size={16} /> Import
                </FernButton>
                <FernButton onClick={() => { setEditingTxn(null); setPrefillData(null); setSheetOpen(true) }}>
                  <Icon name="plus" size={16} /> Add
                </FernButton>
              </>
            )}
            <FernButton tone={selectionMode ? 'teal' : 'outline'} onClick={toggleSelectionMode}>
              <Icon name="check-square" size={16} /> {selectionMode ? 'Cancel' : 'Select'}
            </FernButton>
          </div>
        }
      />

      {/* Year picker */}
      {years.length > 0 && (
        <div className="fern-segmented" style={{ marginBottom: 16, alignSelf: 'flex-start' }}>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className={String(selectedYear) === y ? 'active' : ''}
              onClick={() => router.push(`?year=${y}`)}
            >
              {y}
            </button>
          ))}
        </div>
      )}

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
          {merchantsSortedByName.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          className="fern-select"
          style={{ maxWidth: 240 }}
          value={reimbursementFilter}
          onChange={(e) => setReimbursementFilter(e.target.value as ReimbursementFilter)}
        >
          <option value="all">All reimbursement states</option>
          <option value="unresolved">Unresolved reimbursement work</option>
          <option value="expense:not_reimbursed">Expenses: not reimbursed</option>
          <option value="expense:partially_reimbursed">Expenses: partially reimbursed</option>
          <option value="expense:reimbursed">Expenses: reimbursed</option>
          <option value="expense:manually_settled">Expenses: manually settled</option>
          <option value="income:unmapped">Income: unmapped</option>
          <option value="income:partially_allocated">Income: partially allocated</option>
          <option value="income:fully_allocated">Income: fully allocated</option>
        </select>
      </div>

      {selectionMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button
            type="button"
            onClick={selectAllVisible}
            style={{ fontSize: 13, color: 'var(--teal-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            Select all visible ({visibleRealIds.length})
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{ fontSize: 13, color: 'var(--ink-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
            >
              Clear selection
            </button>
          )}
        </div>
      )}

      {txns.length === 0 && virtualEntries.length === 0 ? (
        <EmptyState title="No transactions yet" description="Log your first expense or income to see it here." />
      ) : filtered.length === 0 ? (
        <EmptyState illu="◌" title="Nothing matches" description="Try a different search or filter." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {monthGroups.map(([month, dgs]) => {
            const monthLabel = formatDate(month + '-15T12:00:00', 'en-US', { month: 'long', year: 'numeric' })
            return (
              <div key={month}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                  <h2 style={{ margin: 0, flex: 1, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)' }}>{monthLabel}</h2>
                  {selectionMode && (
                    <button
                      type="button"
                      onClick={() => selectAllInMonth(month)}
                      style={{ fontSize: 12, color: 'var(--teal-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px 2px 8px' }}
                    >
                      Select month
                    </button>
                  )}
                </div>
                <div className="fern-card" style={{ padding: '8px 16px' }}>
                  {dgs.map(([date, items]) => {
                    const total = items.reduce((s, m) => s + (m.kind === 'income' ? 1 : -1) * Number(m.amount ?? 0), 0)
                    const label = formatDate(date + 'T12:00:00', 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
                    return (
                      <div key={date}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px 6px', fontSize: 12, borderBottom: '1px solid var(--line-soft)' }}>
                          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)' }}>{label}</h4>
                          <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 12, color: total >= 0 ? 'var(--sage-ink)' : 'var(--ink-faint)' }}>
                            {total >= 0 ? '+' : '−'}{fmt(Math.abs(total))}
                          </span>
                        </div>
                        {items.map((m) => {
                    const cat = m.categoryId ? categoryById.get(m.categoryId) : undefined
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
                                  merchantId: m.merchantId,
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
                    const merchant = t.merchantId ? merchantById.get(t.merchantId) : undefined
                    const isCleared = t.cleared === 1
                    const isSelected = selectedIds.has(t.id)
                    const reimbursementSummary = reimbursementSummaries[t.id]
                    const showReimbursementAction = isReimbursementIncome(t, cat)
                    const showManualSettlementAction = isReimbursableExpense(t)
                    const isManuallySettled = reimbursementSummary?.status === 'manually_settled'
                    return (
                      <div
                        key={t.id}
                        className="fern-txn-row"
                        onClick={() => {
                          if (selectionMode) {
                            toggleRow(t.id)
                          } else {
                            setEditingTxn(t)
                            setPrefillData(null)
                            setSheetOpen(true)
                          }
                        }}
                        style={selectionMode && isSelected ? { background: 'var(--bg-sunken)' } : undefined}
                      >
                        {selectionMode && (
                          <div
                            style={{
                              flexShrink: 0,
                              width: 18,
                              height: 18,
                              borderRadius: 5,
                              border: isSelected ? 'none' : '1.5px solid var(--line)',
                              background: isSelected ? 'var(--teal)' : 'transparent',
                              display: 'grid',
                              placeItems: 'center',
                              transition: 'background 0.1s, border 0.1s',
                            }}
                          >
                            {isSelected && <Icon name="check" size={11} style={{ color: '#fff' }} />}
                          </div>
                        )}
                        <CatSwatch color={cat?.color} icon={cat?.icon ?? 'tag'} size={34} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.note ?? merchant?.name ?? cat?.name ?? 'Transaction'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{cat?.name ?? 'Uncategorized'}</span>
                            {merchant && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>· {merchant.name}</span>}
                            {t.recurringId && <Chip tone="recurring"><Icon name="repeat" size={10} /> recurring</Chip>}
                            {reimbursementSummary && (
                              <Chip tone={reimbursementSummary.status === 'reimbursed' || reimbursementSummary.status === 'fully_allocated' || reimbursementSummary.status === 'manually_settled' ? 'recurring' : 'scheduled'}>
                                {reimbursementSummary.label}
                              </Chip>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
                          {t.kind === 'income' ? '+' : '−'}{fmt(Math.abs(t.amount ?? 0))}
                        </div>
                        {!selectionMode && showReimbursementAction && (
                          <button
                            title="Map reimbursement"
                            onClick={(e) => { e.stopPropagation(); handleOpenMapping(t) }}
                            style={{
                              flexShrink: 0,
                              width: 20,
                              height: 20,
                              borderRadius: 6,
                              border: 'none',
                              background: 'var(--teal-bg)',
                              color: 'var(--teal-ink)',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            <Icon name="bank" size={12} />
                          </button>
                        )}
                        {!selectionMode && showManualSettlementAction && (
                          <button
                            title={isManuallySettled ? 'Clear manual settlement' : 'Manually settle reimbursement'}
                            onClick={(e) => {
                              e.stopPropagation()
                              startTransition(async () => {
                                await setExpenseManualSettlement(t.id, !isManuallySettled)
                              })
                            }}
                            style={{
                              flexShrink: 0,
                              width: 20,
                              height: 20,
                              borderRadius: 6,
                              border: isManuallySettled ? 'none' : '1.5px solid var(--line)',
                              background: isManuallySettled ? 'var(--sage-bg)' : 'transparent',
                              color: isManuallySettled ? 'var(--sage-ink)' : 'var(--ink-faint)',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            <Icon name={isManuallySettled ? 'x' : 'check'} size={12} />
                          </button>
                        )}
                        {!selectionMode && (
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
                        )}
                        <button
                          title={isCleared ? 'Mark as pending' : 'Mark as cleared'}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (selectionMode) return
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
                            cursor: selectionMode ? 'default' : 'pointer',
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
            )
          })}

          {visibleMonths < allMonths.length && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <FernButton tone="outline" onClick={() => setVisibleMonths((n) => n + 1)}>
                Load more
              </FernButton>
            </div>
          )}
        </div>
      )}

      {!selectionMode && (
        <Fab
          onClick={() => { setEditingTxn(null); setPrefillData(null); setSheetOpen(true) }}
          label="Log something"
        />
      )}

      {selectionMode && selectedIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'var(--bg-elevated)',
            borderTop: '1.5px solid var(--line)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            {selectedIds.size} selected
          </span>
          <FernButton tone="outline" onClick={exitSelectionMode}>Cancel</FernButton>
          <FernButton tone="teal" onClick={() => setBulkSheetOpen(true)}>
            <Icon name="repeat" size={16} /> Set as recurring
          </FernButton>
        </div>
      )}

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        merchants={merchants}
        recurring={recurring}
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
          merchantId: prefillData.merchantId,
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

      {mappingIncome && (
        <ReimbursementMappingSheet
          key={mappingIncome.id}
          open={mappingSheetOpen}
          onClose={() => { setMappingSheetOpen(false); setMappingIncome(null) }}
          income={mappingIncome}
          expenses={eligibleReimbursementExpenses}
          onSave={handleSaveMapping}
        />
      )}

      {selectedTransactions.length > 0 && (
        <BulkRecurringLinkSheet
          open={bulkSheetOpen}
          onClose={() => setBulkSheetOpen(false)}
          transactions={selectedTransactions}
          categories={categories}
          recurring={recurring}
          onDone={exitSelectionMode}
        />
      )}
    </div>
  )
}
