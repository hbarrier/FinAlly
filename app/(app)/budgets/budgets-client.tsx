'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { Chip } from '@/components/fern/chip'
import { Icon } from '@/components/fern/icon'
import { FernButton } from '@/components/fern/button'
import { PageHeader } from '@/components/fern/page-header'
import { EmptyState } from '@/components/fern/empty-state'
import { Money } from '@/components/fern/money'
import { BudgetSheet } from '@/components/fern/sheets/budget-sheet'
import { BudgetLineSheet } from '@/components/fern/sheets/budget-line-sheet'
import {
  fmt,
  budgetCategoryMonthly,
  budgetLineMonthly,
  type Category,
} from '@/lib/derive'
import type { MonthActuals } from '@/lib/queries/month-actuals'
import type { Merchant, BudgetLine, BudgetWithLines } from '@/lib/db-types'
import { confirmDialog } from '@/lib/dialogs-store'
import {
  createBudget,
  updateBudget,
  deleteBudget,
  addBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
} from '@/lib/actions/budgets'
import { useServerAction } from '@/hooks/use-server-action'

interface BudgetsClientProps {
  categories: Category[]
  merchants: Merchant[]
  budget: BudgetWithLines | null
  actuals: MonthActuals
}

const barState = (spent: number, limit: number): 'ok' | 'warn' | 'over' =>
  limit > 0 && spent > limit ? 'over' : limit > 0 && spent > limit * 0.8 ? 'warn' : 'ok'

export function BudgetsClient({ categories, merchants, budget, actuals }: BudgetsClientProps) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const [editingBudget, setEditingBudget] = useState<'new' | 'edit' | null>(null)
  const [editingLine, setEditingLine] = useState<{ line: BudgetLine | null; category: Category } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const lines = useMemo(() => budget?.lines ?? [], [budget])
  const merchantById = useMemo(() => new Map(merchants.map((m) => [m.id, m])), [merchants])

  const linesByCat = useMemo(() => {
    const map = new Map<string, BudgetLine[]>()
    for (const l of lines) {
      const arr = map.get(l.categoryId) ?? []
      arr.push(l)
      map.set(l.categoryId, arr)
    }
    return map
  }, [lines])

  const expenseActual = actuals.expense
  const incomeActual = actuals.income

  const plannedFor = useCallback(
    (catId: string) => budgetCategoryMonthly(lines, catId, true),
    [lines],
  )

  const visible = useCallback(
    (c: Category) => c.isActive === 1 || linesByCat.has(c.id),
    [linesByCat],
  )
  const expenseCats = useMemo(
    () => categories.filter((c) => c.kind === 'expense' && c.isSavings !== 1 && visible(c)).sort((a, b) => plannedFor(b.id) - plannedFor(a.id)),
    [categories, plannedFor, visible],
  )
  const incomeCats = useMemo(
    () => categories.filter((c) => c.kind === 'income' && visible(c)).sort((a, b) => plannedFor(b.id) - plannedFor(a.id)),
    [categories, plannedFor, visible],
  )
  const allCatIds = useMemo(() => [...expenseCats, ...incomeCats].map((c) => c.id), [expenseCats, incomeCats])

  const totalLimit = expenseCats.reduce((s, c) => s + plannedFor(c.id), 0)
  const totalSpent = expenseCats.reduce((s, c) => s + (expenseActual[c.id] ?? 0), 0)

  const handleSaveBudget = (data: { name: string; description: string | null }) => {
    run(async () => {
      if (editingBudget === 'edit' && budget) {
        await updateBudget(budget.id, data)
      } else {
        await createBudget(data)
        router.push('/budgets')
      }
    })
    setEditingBudget(null)
  }

  const handleNewBudget = async () => {
    if (budget && !(await confirmDialog({
      message: 'This replaces your current budget. Continue?',
      confirmLabel: 'Replace',
      tone: 'danger',
    }))) return
    setEditingBudget('new')
  }

  const handleDelete = async () => {
    if (!budget) return
    if (!(await confirmDialog({ message: `Delete budget "${budget.name}"?`, confirmLabel: 'Delete', tone: 'danger' }))) return
    run(() => deleteBudget(budget.id))
  }

  const toggle = (catId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })

  const renderCategory = (c: Category, actual: number) => {
    const catLines = linesByCat.get(c.id) ?? []
    const limit = plannedFor(c.id)
    const isOpen = expanded.has(c.id)
    const state = barState(actual, limit)
    const barPct = limit > 0 ? Math.min(100, (actual / limit) * 100) : actual > 0 ? 100 : 0
    return (
      <div key={c.id}>
        <div
          onClick={() => toggle(c.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}
        >
          <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={14} />
          <CatSwatch color={c.color} icon={c.icon} size={28} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{c.name}</span>
          {state === 'over' && <Chip tone="expense">Over</Chip>}
          <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'var(--mono-fern)' }}>
            {fmt(actual)} / {fmt(limit)}
          </span>
        </div>
        <div className="fern-budget-bar">
          <div className={`fern-budget-fill ${state}`} style={{ width: `${barPct}%` }} />
        </div>
        {isOpen && (
          <div style={{ marginTop: 10, marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {catLines.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No lines yet</div>
            )}
            {catLines.map((l) => {
              const label = l.merchantId ? merchantById.get(l.merchantId)?.name ?? l.name ?? 'Line' : l.name ?? 'Line'
              return (
                <div
                  key={l.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}
                >
                  <button
                    type="button"
                    onClick={() => setEditingLine({ line: l, category: c })}
                    style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', padding: 0 }}
                  >
                    {label}
                  </button>
                  <Chip>{l.frequency === 'yearly' ? 'Yearly' : 'Monthly'}</Chip>
                  <Chip tone={l.recurring ? 'recurring' : undefined}>{l.recurring ? 'Recurring' : 'Ad-hoc'}</Chip>
                  <span style={{ fontFamily: 'var(--mono-fern)', color: 'var(--ink-soft)', minWidth: 64, textAlign: 'right' }}>
                    {fmt(Number(l.amount ?? 0))}
                  </span>
                  <span style={{ fontFamily: 'var(--mono-fern)', fontSize: 11, color: 'var(--ink-faint)', minWidth: 52, textAlign: 'right' }}>
                    {fmt(budgetLineMonthly(l, true))}/mo
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteBudgetLine(l.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 2 }}
                    aria-label="Delete line"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              onClick={() => setEditingLine({ line: null, category: c })}
              style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--teal-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
            >
              <Icon name="plus" size={12} /> Add line
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        kicker="This month vs budget"
        title={<em>Budget</em>}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {budget && (
              <>
                <FernButton tone="outline" onClick={() => setExpanded(new Set(allCatIds))}>Expand all</FernButton>
                <FernButton tone="outline" onClick={() => setExpanded(new Set())}>Collapse all</FernButton>
                <FernButton tone="outline" onClick={() => setEditingBudget('edit')}>
                  <Icon name="edit" size={14} /> Edit
                </FernButton>
                <FernButton tone="danger" onClick={handleDelete}>
                  <Icon name="trash" size={14} /> Delete
                </FernButton>
              </>
            )}
            <FernButton tone="outline" onClick={handleNewBudget}>
              <Icon name="plus" size={14} /> New budget
            </FernButton>
          </div>
        }
      />

      {budget?.description && (
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginTop: -12, marginBottom: 20 }}>
          {budget.description}
        </p>
      )}

      {!budget ? (
        <EmptyState
          illu="∅"
          title="No budget yet"
          description="Create a budget, or push a simulation from the Simulations page."
          action={<FernButton onClick={() => setEditingBudget('new')}>Create budget</FernButton>}
        />
      ) : (
        <>
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
                className={`fern-budget-fill ${barState(totalSpent, totalLimit)}`}
                style={{ width: `${Math.min(100, totalLimit > 0 ? (totalSpent / totalLimit) * 100 : totalSpent > 0 ? 100 : 0)}%` }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 13, fontFamily: 'var(--mono-fern)', color: totalSpent > totalLimit ? 'var(--rose)' : 'var(--sage-ink)' }}>
              {totalSpent > totalLimit
                ? `${fmt(totalSpent - totalLimit)} over budget`
                : `${fmt(totalLimit - totalSpent)} under budget`}
            </div>
          </div>

          <div className="fern-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Expenses</h3>
              <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Category totals are the sum of their lines</span>
            </div>
            {expenseCats.length === 0 ? (
              <EmptyState illu="∅" title="No expense categories" description="Add expense categories first." style={{ padding: '40px 20px' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {expenseCats.map((c) => renderCategory(c, expenseActual[c.id] ?? 0))}
              </div>
            )}
          </div>

          {incomeCats.length > 0 && (
            <div className="fern-card">
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Revenues</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {incomeCats.map((c) => renderCategory(c, incomeActual[c.id] ?? 0))}
              </div>
            </div>
          )}
        </>
      )}

      <BudgetSheet
        open={editingBudget !== null}
        onClose={() => setEditingBudget(null)}
        item={editingBudget === 'edit' ? budget : null}
        onSave={handleSaveBudget}
      />

      <BudgetLineSheet
        open={editingLine !== null}
        onClose={() => setEditingLine(null)}
        category={editingLine?.category ?? null}
        merchants={merchants}
        item={editingLine?.line ?? null}
        onSave={(data) => {
          if (!budget || !editingLine) return
          const { category, line } = editingLine
          run(async () => {
            if (line) {
              await updateBudgetLine(line.id, {
                name: data.name,
                merchantId: data.merchantId,
                amount: data.amount,
                frequency: data.frequency,
                recurring: data.recurring,
              })
            } else {
              await addBudgetLine(budget.id, {
                name: data.name,
                kind: category.kind,
                categoryId: category.id,
                merchantId: data.merchantId,
                amount: data.amount,
                frequency: data.frequency,
                recurring: data.recurring,
              })
            }
          })
        }}
      />
    </div>
  )
}
