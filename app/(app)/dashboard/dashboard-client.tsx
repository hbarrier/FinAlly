'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Chip } from '@/components/fern/chip'
import { BalanceEvolution } from '@/components/fern/balance-evolution'
import { CategoryBars } from '@/components/fern/category-bars'
import { TransactionSheet } from '@/components/fern/sheets/transaction-sheet'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { EmptyState } from '@/components/fern/empty-state'
import { Money } from '@/components/fern/money'
import { Fab } from '@/components/fern/fab'
import {
  thisMonthRecurring,
  sumByKind,
  spendingByCategory,
  fmt,
  fmtShort,
  formatDate,
  type Category,
  type Transaction,
  type Recurring,
} from '@/lib/derive'
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '@/lib/actions/transactions'
import { upsertMonthlyOpeningBalance } from '@/lib/actions/monthly-opening-balances'

import type { Merchant, UserSettings as Settings } from '@/lib/db-types'

interface DashboardClientProps {
  settings: Settings
  monthTransactions: Transaction[]
  monthKey: string
  monthStart: string
  openingBalance: number
  openingBalanceIsExplicit: boolean
  recurring: Recurring[]
  categories: Category[]
  merchants: Merchant[]
}

export function DashboardClient({
  settings,
  monthTransactions: monthTxns,
  monthKey,
  monthStart,
  openingBalance,
  openingBalanceIsExplicit,
  recurring,
  categories,
  merchants,
}: DashboardClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [clearedOnly, setClearedOnly] = useState(false)
  const [, startTransition] = useTransition()

  const today = useMemo(() => new Date(), [])
  const todayIso = today.toISOString().slice(0, 10)
  const monthEndDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const monthEndIso = `${monthKey}-${String(monthEndDay).padStart(2, '0')}`

  const filteredMonthTxns = useMemo(
    () => (clearedOnly ? monthTxns.filter((t) => t.cleared === 1) : monthTxns),
    [monthTxns, clearedOnly],
  )

  const series = useMemo(() => {
    const txns = [...filteredMonthTxns].sort((a, b) => a.date.localeCompare(b.date))
    const out: number[] = []
    let bal = openingBalance
    let idx = 0
    for (let day = 1; day <= monthEndDay; day++) {
      const iso = `${monthKey}-${String(day).padStart(2, '0')}`
      while (idx < txns.length && txns[idx].date <= iso) {
        const t = txns[idx]
        bal += (t.kind === 'income' ? 1 : -1) * Number(t.amount || 0)
        idx++
      }
      out.push(bal)
    }
    return out
  }, [filteredMonthTxns, openingBalance, monthKey, monthEndDay])

  const balanceToday = useMemo(() => {
    return (
      openingBalance +
      filteredMonthTxns
        .filter((t) => t.date >= monthStart && t.date <= todayIso)
        .reduce((s, t) => s + (t.kind === 'income' ? 1 : -1) * Number(t.amount || 0), 0)
    )
  }, [openingBalance, filteredMonthTxns, monthStart, todayIso])

  const balanceProjected = useMemo(() => {
    return (
      openingBalance +
      filteredMonthTxns
        .filter((t) => t.date >= monthStart && t.date <= monthEndIso)
        .reduce((s, t) => s + (t.kind === 'income' ? 1 : -1) * Number(t.amount || 0), 0)
    )
  }, [openingBalance, filteredMonthTxns, monthStart, monthEndIso])

  const { income, expense, net, cats, upcoming } = useMemo(() => {
    const inc = sumByKind(filteredMonthTxns, 'income')
    const exp = sumByKind(filteredMonthTxns, 'expense')
    return {
      income: inc,
      expense: exp,
      net: inc - exp,
      cats: spendingByCategory(filteredMonthTxns, categories),
      upcoming: thisMonthRecurring(recurring, today).slice(0, 6),
    }
  }, [filteredMonthTxns, categories, recurring, today])

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const monthName = today.toLocaleString('en-US', { month: 'long' })
  const dayOfMonth = today.getDate()
  const totalDays = monthEndDay

  const hasData = monthTxns.length > 0 || recurring.length > 0

  const handleSave = async (data: Parameters<typeof addTransaction>[0]) => {
    startTransition(async () => {
      if (editingTxn) {
        await updateTransaction(editingTxn.id, data)
      } else {
        await addTransaction(data)
      }
    })
    setSheetOpen(false)
    setEditingTxn(null)
  }

  const handleDelete = async () => {
    if (!editingTxn) return
    startTransition(async () => {
      await deleteTransaction(editingTxn.id)
    })
    setSheetOpen(false)
    setEditingTxn(null)
  }

  return (
    <div>
      <PageHeader
        kicker={formatDate(today.toISOString(), 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={<>Hello, <em>{settings.name}</em>.</>}
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
                className="fern-input"
                style={{ width: 110, padding: '4px 8px', fontSize: 13, textAlign: 'right' }}
                type="number"
                defaultValue={openingBalance}
                onBlur={(e) => {
                  const v = Number(e.target.value)
                  if (!Number.isFinite(v)) return
                  startTransition(async () => {
                    await upsertMonthlyOpeningBalance(monthKey, v)
                  })
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

        {/* Cash flow card */}
        <div className="fern-card">
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 4 }}>
                {monthName} · day {dayOfMonth}/{totalDays}
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Balance evolution</h3>
            </div>
            <div className="fern-type-toggle" style={{ marginTop: -2 }}>
              <button
                type="button"
                className={clearedOnly ? '' : 'active income'}
                onClick={() => setClearedOnly(false)}
              >
                All
              </button>
              <button
                type="button"
                className={clearedOnly ? 'active expense' : ''}
                onClick={() => setClearedOnly(true)}
              >
                Cleared
              </button>
            </div>
          </div>
          {hasData ? (
            <>
              <BalanceEvolution series={series.length > 1 ? series : [openingBalance, openingBalance]} />
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--ink-faint)' }}>Start · <strong style={{ color: 'var(--ink)' }}>{fmt(openingBalance)}</strong></span>
                <span style={{ color: 'var(--ink-faint)' }}>Now · <strong style={{ color: 'var(--ink)' }}>{fmt(balanceToday)}</strong></span>
                <span style={{ color: 'var(--ink-faint)' }}>End · <strong style={{ color: 'var(--ink)' }}>{fmt(balanceProjected)}</strong></span>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
            <CategoryBars items={cats} />
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
        <div className="fern-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 4 }}>This month</div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Recurring</h3>
            </div>
            <Link href="/recurring" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-soft)', textDecoration: 'none', padding: '4px 8px', borderRadius: 8, background: 'var(--bg-sunken)' }}>
              Manage <Icon name="chevronRight" size={14} />
            </Link>
          </div>
          {upcoming.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcoming.map((u, i) => {
                const cat = u.categoryId ? categoryById.get(u.categoryId) : undefined
                const dateStr = u.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const isPast = u.date < today
                return (
                  <div key={u.id + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', opacity: isPast ? 0.45 : 1 }}>
                    {cat && <CatSwatch color={cat.color} icon={cat.icon} size={28} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)' }}>{dateStr}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: u.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
                      {u.kind === 'income' ? '+' : '−'}{fmtShort(u.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              illu="◎"
              title="Nothing scheduled"
              description="Set up a recurring bill or payday."
              style={{ padding: '40px 20px' }}
              action={
                <Link href="/recurring" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--line)', background: 'transparent', textDecoration: 'none', fontSize: 13, color: 'var(--ink)' }}>
                  <Icon name="repeat" size={14} /> Add recurring
                </Link>
              }
            />
          )}
        </div>
      </div>

      <Fab
        onClick={() => { setEditingTxn(null); setSheetOpen(true) }}
        label="Log something"
      />

      <TransactionSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingTxn(null) }}
        categories={categories}
        merchants={merchants}
        item={editingTxn}
        onSave={handleSave}
        onDelete={editingTxn ? handleDelete : undefined}
      />
    </div>
  )
}
