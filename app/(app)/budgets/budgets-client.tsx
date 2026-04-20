'use client'

import { useMemo, useTransition } from 'react'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Chip } from '@/components/fern/chip'
import { PageHeader } from '@/components/fern/page-header'
import { EmptyState } from '@/components/fern/empty-state'
import { Money } from '@/components/fern/money'
import { fmt, thisMonthTransactions, type Category } from '@/lib/derive'
import type { Budget } from '@/lib/db-types'
import { upsertBudget, deleteBudget } from '@/lib/actions/budgets'

type TransactionSlice = {
  id: string
  date: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string | null
}

interface BudgetsClientProps {
  categories: Category[]
  budgets: Budget[]
  transactions: TransactionSlice[]
}

export function BudgetsClient({ categories, budgets: budgetsList, transactions: txns }: BudgetsClientProps) {
  const [, startTransition] = useTransition()

  const spentByCat = useMemo(() => {
    const map: Record<string, number> = {}
    thisMonthTransactions(txns)
      .filter((t) => t.kind === 'expense')
      .forEach((t) => {
        if (t.categoryId) map[t.categoryId] = (map[t.categoryId] ?? 0) + Number(t.amount ?? 0)
      })
    return map
  }, [txns])

  const budgetByCat = useMemo(
    () => new Map(budgetsList.map((b) => [b.categoryId, b])),
    [budgetsList],
  )

  const spent = (catId: string) => spentByCat[catId] ?? 0

  const totalLimit = budgetsList.reduce((s, b) => s + Number(b.limitAmount ?? 0), 0)
  const totalSpent = budgetsList.reduce((s, b) => s + spent(b.categoryId), 0)

  const expenseCats = categories.filter((c) => c.kind === 'expense')

  return (
    <div>
      <PageHeader
        kicker="This month's limits"
        title={<em>Budgets</em>}
      />

      {budgetsList.length > 0 && (
        <div className="fern-card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 8 }}>
            Budgeted overall
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <Money amount={totalSpent} />
            <div style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)', fontSize: 13 }}>
              of {fmt(totalLimit)}
            </div>
          </div>
          <div className="fern-budget-bar" style={{ marginTop: 14 }}>
            <div
              className={`fern-budget-fill ${totalSpent > totalLimit ? 'over' : totalSpent > totalLimit * 0.8 ? 'warn' : 'ok'}`}
              style={{ width: `${Math.min(100, totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0)}%` }}
            />
          </div>
        </div>
      )}

      <div className="fern-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>By category</h3>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Edit a limit to save</span>
        </div>

        {expenseCats.length === 0 ? (
          <EmptyState
            illu="∅"
            title="No categories yet"
            description="Add some expense categories to set budgets."
            style={{ padding: '40px 20px' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {expenseCats.map((c) => {
              const budget = budgetByCat.get(c.id)
              const s = spent(c.id)
              const limit = budget?.limitAmount ?? 0
              const pct = limit > 0 ? (s / limit) * 100 : 0
              const state = pct > 100 ? 'over' : pct > 80 ? 'warn' : 'ok'
              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <CatSwatch color={c.color} icon={c.icon} size={28} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{c.name}</span>
                    {state === 'over' && <Chip tone="expense">Over</Chip>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
                      <span>{fmt(s)} /</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        €
                        <input
                          className="fern-input"
                          style={{ width: 80, padding: '4px 8px', fontSize: 13, textAlign: 'right' }}
                          type="number"
                          placeholder="0"
                          defaultValue={limit || ''}
                          onBlur={(e) => {
                            const v = Number(e.target.value)
                            startTransition(async () => {
                              if (v > 0) await upsertBudget(c.id, v)
                              else await deleteBudget(c.id)
                            })
                          }}
                        />
                      </span>
                    </div>
                  </div>
                  <div className="fern-budget-bar">
                    <div className={`fern-budget-fill ${state}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
