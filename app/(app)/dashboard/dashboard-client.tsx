'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Chip } from '@/components/fern/chip'
import { BalanceEvolution } from '@/components/fern/balance-evolution'
import { CategoryBars } from '@/components/fern/category-bars'
import { RecurringCategoryBars } from '@/components/fern/recurring-category-bars'
import { TransactionSheet } from '@/components/fern/sheets/transaction-sheet'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { Money } from '@/components/fern/money'
import { Fab } from '@/components/fern/fab'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  sumByKind,
  spendingByCategory,
  recurringExpensesByCategory,
  fmt,
  formatDate,
  type Category,
  type Transaction,
  type Recurring,
  type RecurringInstance,
} from '@/lib/derive'
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '@/lib/actions/transactions'
import { upsertMonthlyOpeningBalance } from '@/lib/actions/monthly-opening-balances'
import { runAction } from '@/lib/utils'
import type { Merchant } from '@/lib/db-types'

type RangeKey = 'ytd' | '1m' | '6m' | '1y' | '2y' | '5y'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'ytd', label: 'YTD' },
  { key: '1m', label: '1M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '2y', label: '2Y' },
  { key: '5y', label: '5Y' },
]

const RANGE_LABELS: Record<RangeKey, string> = {
  ytd: 'Year to date',
  '1m': 'Last month',
  '6m': 'Last 6 months',
  '1y': 'Last year',
  '2y': 'Last 2 years',
  '5y': 'Last 5 years',
}

interface DashboardClientProps {
  allTransactions: Transaction[]
  monthKey: string
  monthStart: string
  openingBalance: number
  openingBalanceIsExplicit: boolean
  histStartDate: string
  histOpeningBalance: number
  recurring: Recurring[]
  categories: Category[]
  merchants: Merchant[]
  instances: RecurringInstance[]
  recurringEnabled: boolean
  divorceEnabled: boolean
}

export function DashboardClient({
  allTransactions,
  monthKey,
  monthStart,
  openingBalance,
  openingBalanceIsExplicit,
  histStartDate,
  histOpeningBalance,
  recurring,
  categories,
  merchants,
  instances,
  recurringEnabled,
  divorceEnabled,
}: DashboardClientProps) {
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [rangeKey, setRangeKey] = useState<RangeKey>('ytd')
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [selectedRecurringCatId, setSelectedRecurringCatId] = useState<string | null>(null)
  const [flattenSizes, setFlattenSizes] = useState(false)
  const [includeYearlyAmortized, setIncludeYearlyAmortized] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const today = useMemo(() => new Date(), [])
  const todayIso = today.toISOString().slice(0, 10)
  const monthEndDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const monthEndIso = `${monthKey}-${String(monthEndDay).padStart(2, '0')}`

  const monthTxns = useMemo(
    () => allTransactions.filter((t) => t.date.startsWith(monthKey + '-')),
    [allTransactions, monthKey],
  )

  // For chart: exclude uncleared recurring-linked transactions (auto-generated, unrecognized)
  const chartTxns = useMemo(
    () => allTransactions.filter((t) => !t.recurringId || t.cleared === 1),
    [allTransactions],
  )

  // Precompute end-of-day running balance from histStart to today
  const dailyBalances = useMemo(() => {
    const sorted = [...chartTxns].sort((a, b) => a.date.localeCompare(b.date))
    const result: { date: string; balance: number }[] = []
    let bal = histOpeningBalance
    let idx = 0

    const end = new Date(todayIso + 'T00:00:00Z')
    const cursor = new Date(histStartDate + 'T00:00:00Z')
    while (cursor <= end) {
      const iso = cursor.toISOString().slice(0, 10)
      while (idx < sorted.length && sorted[idx].date <= iso) {
        const t = sorted[idx]
        bal += (t.kind === 'income' ? 1 : -1) * Number(t.amount || 0)
        idx++
      }
      result.push({ date: iso, balance: bal })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return result
  }, [chartTxns, histOpeningBalance, histStartDate, todayIso])

  const { rangeStart, rangeEnd } = useMemo(() => {
    const y = today.getFullYear()
    const m = today.getMonth()
    const toISO = (d: Date) => d.toISOString().slice(0, 10)
    switch (rangeKey) {
      case 'ytd':
        return { rangeStart: `${y}-01-01`, rangeEnd: todayIso }
      case '1m':
        return {
          rangeStart: toISO(new Date(y, m - 1, 1)),
          rangeEnd: toISO(new Date(y, m, 0)),
        }
      case '6m':
        return { rangeStart: toISO(new Date(y, m - 5, 1)), rangeEnd: todayIso }
      case '1y':
        return { rangeStart: toISO(new Date(y - 1, m, 1)), rangeEnd: todayIso }
      case '2y':
        return { rangeStart: toISO(new Date(y - 2, m, 1)), rangeEnd: todayIso }
      case '5y':
        return { rangeStart: toISO(new Date(y - 5, m, 1)), rangeEnd: todayIso }
    }
  }, [rangeKey, today, todayIso])

  const chartSeries = useMemo(
    () => dailyBalances.filter((p) => p.date >= rangeStart && p.date <= rangeEnd),
    [dailyBalances, rangeStart, rangeEnd],
  )

  const balanceToday = useMemo(
    () =>
      openingBalance +
      monthTxns
        .filter((t) => t.date >= monthStart && t.date <= todayIso)
        .reduce((s, t) => s + (t.kind === 'income' ? 1 : -1) * Number(t.amount || 0), 0),
    [openingBalance, monthTxns, monthStart, todayIso],
  )

  const balanceProjected = useMemo(
    () =>
      openingBalance +
      monthTxns
        .filter((t) => t.date >= monthStart && t.date <= monthEndIso)
        .reduce((s, t) => s + (t.kind === 'income' ? 1 : -1) * Number(t.amount || 0), 0),
    [openingBalance, monthTxns, monthStart, monthEndIso],
  )

  const { income, expense, net, cats } = useMemo(() => {
    const inc = sumByKind(monthTxns, 'income')
    const exp = sumByKind(monthTxns, 'expense')
    return {
      income: inc,
      expense: exp,
      net: inc - exp,
      cats: spendingByCategory(monthTxns, categories),
    }
  }, [monthTxns, categories])

  const recurringCats = useMemo(
    () => recurringExpensesByCategory(recurring, categories, instances, allTransactions, monthKey, includeYearlyAmortized),
    [recurring, categories, instances, allTransactions, monthKey, includeYearlyAmortized],
  )

  const recurringMonthTotal = useMemo(
    () => recurringCats.reduce((s, g) => s + g.total, 0),
    [recurringCats],
  )

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const merchantById = useMemo(
    () => new Map(merchants.map((m) => [m.id, m])),
    [merchants],
  )

  const selectedCat = selectedCatId ? categoryById.get(selectedCatId) : null
  const catTxns = useMemo(
    () => monthTxns.filter((t) => t.kind === 'expense' && t.categoryId === selectedCatId),
    [monthTxns, selectedCatId],
  )

  const selectedRecurringGroup = selectedRecurringCatId
    ? recurringCats.find((g) => g.id === selectedRecurringCatId) ?? null
    : null

  const monthName = today.toLocaleString('en-US', { month: 'long' })
  const hasData = allTransactions.length > 0 || recurring.length > 0
  const chartStart = chartSeries[0]?.balance
  const chartEnd = chartSeries[chartSeries.length - 1]?.balance

  const handleSave = async (data: Parameters<typeof addTransaction>[0]) => {
    startTransition(runAction(async () => {
      if (editingTxn) {
        await updateTransaction(editingTxn.id, data)
      } else {
        await addTransaction(data)
      }
    }))
    setSheetOpen(false)
    setEditingTxn(null)
  }

  const handleDelete = async () => {
    if (!editingTxn) return
    startTransition(runAction(async () => {
      await deleteTransaction(editingTxn.id)
    }))
    setSheetOpen(false)
    setEditingTxn(null)
  }

  return (
    <div>
      <PageHeader
        kicker={formatDate(today.toISOString(), 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={<>Hello, <em>welcome to your</em> FinAlly <em>application</em>.</>}
        actions={
          <FernButton onClick={() => { setEditingTxn(null); setSheetOpen(true) }}>
            <Icon name="plus" size={16} /> Log something
          </FernButton>
        }
      />

      {/* Hero row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Balance card */}
        <div className="fern-card">
          <div style={{ fontSize: 12, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 8 }}>
            Balance · {monthName} {today.getFullYear()}
          </div>
          <Money amount={balanceToday} />
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)' }}>
              Opening{openingBalanceIsExplicit ? '' : ' (derived)'}:
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--ink-faint)' }}>€</span>
              <input
                key={openingBalance}
                className="fern-input"
                style={{ width: 110, padding: '4px 8px', fontSize: 13, textAlign: 'right' }}
                type="number"
                defaultValue={openingBalance}
                onBlur={(e) => {
                  const v = Number(e.target.value)
                  if (!Number.isFinite(v)) return
                  startTransition(runAction(async () => {
                    await upsertMonthlyOpeningBalance(monthKey, v)
                  }))
                }}
              />
            </span>
            <span style={{ marginLeft: 'auto', color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)' }}>
              Projected: <strong style={{ color: 'var(--ink)' }}>{fmt(balanceProjected)}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Chip tone="income"><Icon name="arrowUp" size={12} /> In</Chip>
              <strong style={{ color: 'var(--sage-ink)' }}>{fmt(income)}</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Chip tone="expense"><Icon name="arrowDown" size={12} /> Out</Chip>
              <strong style={{ color: 'var(--rose-ink)' }}>{fmt(expense)}</strong>
            </span>
            <span style={{ marginLeft: 'auto', color: net >= 0 ? 'var(--sage-ink)' : 'var(--rose-ink)' }}>
              Net {net >= 0 ? '+' : '−'}{fmt(Math.abs(net), { noSymbol: true })}€
            </span>
          </div>
        </div>

        {/* Balance evolution card */}
        <div className="fern-card">
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 4 }}>
                {RANGE_LABELS[rangeKey]}
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Balance evolution</h3>
            </div>
            <div style={{ display: 'flex', background: 'var(--bg-sunken)', borderRadius: 8, padding: 2, gap: 1, flexShrink: 0 }}>
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRangeKey(r.key)}
                  style={{
                    padding: '3px 7px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: rangeKey === r.key ? 600 : 500,
                    background: rangeKey === r.key ? 'var(--bg-elevated)' : 'none',
                    color: rangeKey === r.key ? 'var(--ink)' : 'var(--ink-faint)',
                    boxShadow: rangeKey === r.key ? 'var(--fern-shadow-sm)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--mono-fern)',
                    transition: 'all 0.1s',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {hasData && chartSeries.length >= 2 ? (
            <>
              <BalanceEvolution series={chartSeries} />
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
                {chartStart !== undefined && (
                  <span style={{ color: 'var(--ink-faint)' }}>
                    Start · <strong style={{ color: 'var(--ink)' }}>{fmt(chartStart)}</strong>
                  </span>
                )}
                {chartEnd !== undefined && (
                  <span style={{ color: 'var(--ink-faint)', marginLeft: 'auto' }}>
                    {rangeKey === '1m' ? 'End' : 'Now'} · <strong style={{ color: 'var(--ink)' }}>{fmt(chartEnd)}</strong>
                  </span>
                )}
              </div>
            </>
          ) : (
            <div style={{ height: 200, display: 'grid', placeItems: 'center', color: 'var(--ink-faint)', textAlign: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 40, fontStyle: 'italic', marginBottom: 6 }}>—</div>
                <div style={{ fontSize: 13 }}>Log a few transactions to see your balance evolve</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom grid */}
      <div style={{ display: 'grid', gridTemplateColumns: recurringEnabled ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Category rings */}
        <div className="fern-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 4 }}>This month</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Where it went</h3>
            </div>
            {cats.length > 0 && (
              <Link href="/transactions" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-soft)', textDecoration: 'none', padding: '4px 8px', borderRadius: 8, background: 'var(--bg-sunken)' }}>
                See all <Icon name="chevronRight" size={14} />
              </Link>
            )}
          </div>
          {cats.length > 0 ? (
            <CategoryBars items={cats} onCategoryClick={setSelectedCatId} />
          ) : (
            <EmptyState
              illu="∅"
              title="No expenses yet"
              description="Log your first expense to see your categories."
              style={{ padding: '40px 20px' }}
              action={
                <FernButton
                  tone="outline"
                  onClick={() => setSheetOpen(true)}
                  style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, fontSize: 13, background: 'transparent', color: 'var(--ink)' }}
                >
                  <Icon name="plus" size={14} /> Add expense
                </FernButton>
              }
            />
          )}
        </div>

        {/* Upcoming recurring */}
        {recurringEnabled && (
        <div className="fern-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 4 }}>This month</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Recurring</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--mono-fern)', marginRight: 2 }}>
                {fmt(recurringMonthTotal)}
              </span>
              <button
                type="button"
                aria-pressed={flattenSizes}
                onClick={() => setFlattenSizes((v) => !v)}
                style={{
                  fontSize: 12,
                  color: flattenSizes ? 'var(--sage-ink)' : 'var(--ink-soft)',
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: flattenSizes ? 'var(--sage-bg)' : 'var(--bg-sunken)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Equal width
              </button>
              <button
                type="button"
                aria-pressed={includeYearlyAmortized}
                onClick={() => setIncludeYearlyAmortized((v) => !v)}
                style={{
                  fontSize: 12,
                  color: includeYearlyAmortized ? 'var(--sage-ink)' : 'var(--ink-soft)',
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: includeYearlyAmortized ? 'var(--sage-bg)' : 'var(--bg-sunken)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                + Yearly
              </button>
              <Link href="/recurring" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-soft)', textDecoration: 'none', padding: '4px 8px', borderRadius: 8, background: 'var(--bg-sunken)' }}>
                Manage <Icon name="chevronRight" size={14} />
              </Link>
            </div>
          </div>
          {recurringCats.length > 0 ? (
            <RecurringCategoryBars items={recurringCats} flattenSizes={flattenSizes} onCategoryClick={setSelectedRecurringCatId} />
          ) : (
            <EmptyState
              illu="◎"
              title="Nothing scheduled"
              description="Set up a recurring bill."
              style={{ padding: '40px 20px' }}
              action={
                <Link href="/recurring" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', textDecoration: 'none', fontSize: 13, color: 'var(--ink)' }}>
                  <Icon name="repeat" size={14} /> Add recurring
                </Link>
              }
            />
          )}
        </div>
        )}
      </div>

      {showScrollTop && (
        <button
          type="button"
          className="fern-fab fern-fab-top"
          aria-label="Scroll to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <Icon name="arrowUp" size={22} />
        </button>
      )}

      <Fab onClick={() => { setEditingTxn(null); setSheetOpen(true) }} label="Log something" />

      <TransactionSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingTxn(null) }}
        categories={categories}
        merchants={merchants}
        item={editingTxn}
        showReimbursable={divorceEnabled}
        onSave={handleSave}
        onDelete={editingTxn ? handleDelete : undefined}
      />

      <Dialog open={!!selectedCatId} onOpenChange={(open) => { if (!open) setSelectedCatId(null) }}>
        <DialogContent style={{ maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedCat && <CatSwatch color={selectedCat.color} icon={selectedCat.icon} size={20} />}
              {selectedCat?.name ?? 'Category'}
            </DialogTitle>
          </DialogHeader>
          <div style={{ overflowY: 'auto', flex: 1, marginTop: 8 }}>
            {catTxns.length === 0 ? (
              <div style={{ color: 'var(--ink-faint)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No transactions</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {catTxns.map((t) => {
                  const label = t.merchantId ? merchantById.get(t.merchantId)?.name : t.note
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {label || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)' }}>{t.date}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
                        −{fmt(Number(t.amount))}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              href="/transactions"
              onClick={() => setSelectedCatId(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, background: 'var(--bg-sunken)', color: 'var(--ink)', textDecoration: 'none' }}
            >
              Go to movements <Icon name="chevronRight" size={14} />
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRecurringCatId} onOpenChange={(open) => { if (!open) setSelectedRecurringCatId(null) }}>
        <DialogContent style={{ maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedRecurringGroup && <CatSwatch color={selectedRecurringGroup.color} icon={selectedRecurringGroup.icon} size={20} />}
              {selectedRecurringGroup?.name ?? 'Category'}
            </DialogTitle>
          </DialogHeader>
          <div style={{ overflowY: 'auto', flex: 1, marginTop: 8 }}>
            {!selectedRecurringGroup || selectedRecurringGroup.items.length === 0 ? (
              <div style={{ color: 'var(--ink-faint)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No recurring expenses</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {selectedRecurringGroup.items.map((it) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', opacity: it.tier === 'cleared' ? 1 : it.tier === 'amortized' ? 0.7 : 0.6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)' }}>
                        {it.tier === 'amortized' ? '1/12 of yearly amount' : (it.date ?? 'Not yet cleared')}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
                      −{fmt(it.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              href="/recurring"
              onClick={() => setSelectedRecurringCatId(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, background: 'var(--bg-sunken)', color: 'var(--ink)', textDecoration: 'none' }}
            >
              Manage <Icon name="chevronRight" size={14} />
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
