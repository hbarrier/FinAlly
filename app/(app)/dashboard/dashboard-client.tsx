'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Chip } from '@/components/fern/chip'
import { CashflowRiver } from '@/components/fern/cashflow-river'
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

import type { Merchant, UserSettings as Settings } from '@/lib/db-types'

interface DashboardClientProps {
  settings: Settings
  monthTransactions: Transaction[]
  balance: number
  recurring: Recurring[]
  categories: Category[]
  merchants: Merchant[]
}

export function DashboardClient({
  settings,
  monthTransactions: monthTxns,
  balance,
  recurring,
  categories,
  merchants,
}: DashboardClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [, startTransition] = useTransition()

  const today = useMemo(() => new Date(), [])
  const { income, expense, net, cats, upcoming } = useMemo(() => {
    const inc = sumByKind(monthTxns, 'income')
    const exp = sumByKind(monthTxns, 'expense')
    return {
      income: inc,
      expense: exp,
      net: inc - exp,
      cats: spendingByCategory(monthTxns, categories),
      upcoming: thisMonthRecurring(recurring, today).slice(0, 8),
    }
  }, [monthTxns, categories, recurring, today])

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const monthName = today.toLocaleString('en-US', { month: 'long' })
  const dayOfMonth = today.getDate()
  const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()

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
            Total balance
          </div>
          <Money amount={balance} />
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
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 4 }}>
              {monthName} · day {dayOfMonth}/{totalDays}
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Cash flow this month</h3>
          </div>
          {hasData ? (
            <>
              <CashflowRiver income={income || 1} expense={expense || 1} days={totalDays} />
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--sage-ink)' }}>◉ In · {fmt(income)}</span>
                <span style={{ color: 'var(--rose-ink)' }}>◉ Out · {fmt(expense)}</span>
              </div>
            </>
          ) : (
            <div style={{ height: 200, display: 'grid', placeItems: 'center', color: 'var(--ink-faint)', textAlign: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 40, fontStyle: 'italic', marginBottom: 6 }}>—</div>
                <div style={{ fontSize: 13 }}>Log a few transactions to see your flow</div>
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
              {upcoming.slice(0, 6).map((u, i) => {
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
