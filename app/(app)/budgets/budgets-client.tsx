'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Chip } from '@/components/fern/chip'
import { Icon } from '@/components/fern/icon'
import { FernButton } from '@/components/fern/button'
import { PageHeader } from '@/components/fern/page-header'
import { EmptyState } from '@/components/fern/empty-state'
import { Money } from '@/components/fern/money'
import { BudgetSheet } from '@/components/fern/sheets/budget-sheet'
import { fmt, thisMonthTransactions, type Category } from '@/lib/derive'
import type { Budget, BudgetWithAmounts } from '@/lib/db-types'
import { confirmDialog } from '@/lib/dialogs-store'
import {
  createBudget,
  updateBudget,
  deleteBudget,
  setActiveBudget,
  setBudgetAmount,
  deleteBudgetAmount,
} from '@/lib/actions/budgets'
import { runAction } from '@/lib/utils'

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
  selected: BudgetWithAmounts | null
  transactions: TransactionSlice[]
}

export function BudgetsClient({ categories, budgets, selected, transactions: txns }: BudgetsClientProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null)

  const spentByCat = useMemo(() => {
    const map: Record<string, number> = {}
    thisMonthTransactions(txns)
      .filter((t) => t.kind === 'expense')
      .forEach((t) => {
        if (t.categoryId) map[t.categoryId] = (map[t.categoryId] ?? 0) + Number(t.amount ?? 0)
      })
    return map
  }, [txns])

  const amounts = useMemo(() => selected?.amounts ?? [], [selected])
  const budgetByCat = useMemo(() => new Map(amounts.map((a) => [a.categoryId, a])), [amounts])

  const spent = (catId: string) => spentByCat[catId] ?? 0

  const totalLimit = amounts.reduce((s, a) => s + Number(a.limitAmount ?? 0), 0)
  const totalSpent = amounts.reduce((s, a) => s + spent(a.categoryId), 0)

  const expenseCats = categories.filter((c) => c.kind === 'expense')

  const handleSaveBudget = (data: { name: string; description: string | null }) => {
    startTransition(
      runAction(async () => {
        if (editing === 'edit' && selected) {
          await updateBudget(selected.id, data)
        } else {
          const { id } = await createBudget(data)
          router.push(`/budgets?b=${id}`)
        }
      }),
    )
    setEditing(null)
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!(await confirmDialog({ message: `Delete budget "${selected.name}"?`, confirmLabel: 'Delete', tone: 'danger' }))) return
    startTransition(
      runAction(async () => {
        await deleteBudget(selected.id)
        router.push('/budgets')
      }),
    )
  }

  return (
    <div>
      <PageHeader
        kicker="This month's limits"
        title={<em>Budgets</em>}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {budgets.length > 0 && (
              <select
                className="fern-input"
                style={{ width: 'auto' }}
                value={selected?.id ?? ''}
                onChange={(e) => router.push(`/budgets?b=${e.target.value}`)}
              >
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            )}
            {selected && !selected.isActive && (
              <FernButton
                tone="outline"
                onClick={() => startTransition(runAction(async () => { await setActiveBudget(selected.id) }))}
              >
                Set as active
              </FernButton>
            )}
            {selected && (
              <FernButton tone="outline" onClick={() => setEditing('edit')}>
                <Icon name="edit" size={14} /> Edit
              </FernButton>
            )}
            {selected && (
              <FernButton tone="danger" onClick={handleDelete}>
                <Icon name="trash" size={14} /> Delete
              </FernButton>
            )}
            <FernButton tone="outline" onClick={() => setEditing('new')}>
              <Icon name="plus" size={14} /> New budget
            </FernButton>
          </div>
        }
      />

      {selected?.description && (
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginTop: -12, marginBottom: 20 }}>
          {selected.description}
        </p>
      )}

      {!selected ? (
        <EmptyState
          illu="∅"
          title="No budgets yet"
          description="Create a budget to set monthly spending limits per category."
          action={<FernButton onClick={() => setEditing('new')}>Create budget</FernButton>}
        />
      ) : (
        <>
          {amounts.length > 0 && (
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
                                startTransition(runAction(async () => {
                                  if (v > 0) await setBudgetAmount(selected.id, c.id, v)
                                  else await deleteBudgetAmount(selected.id, c.id)
                                }))
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
        </>
      )}

      <BudgetSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        item={editing === 'edit' ? selected : null}
        onSave={handleSaveBudget}
      />
    </div>
  )
}
