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
import { SearchableSelect } from '@/components/fern/searchable-select'
import { BudgetSheet } from '@/components/fern/sheets/budget-sheet'
import { BudgetLineSheet } from '@/components/fern/sheets/budget-line-sheet'
import { CategoryMovementsModal } from '@/components/fern/category-movements-modal'
import { COLOR_VARS } from '@/components/fern/color-vars'
import {
  fmt,
  budgetWaterfall,
  balanceToDate,
  plannedToMonthEnd,
  ratioState,
  plannedUncleared,
  type Category,
  type Recurring,
  type RecurringInstance,
  type RatioState,
  type BudgetLineLite,
} from '@/lib/derive'
import { addMonths, currentMonth, monthsBetween } from '@/lib/dates'
import { formatConfig } from '@/lib/format-config'
import { BUDGET_START_MONTH_COOKIE } from '@/lib/settings-options'
import type { PlannedBudgetTxn, RecentBudgetTxn } from '@/lib/queries/month-actuals'
import type { Merchant, BudgetLine, BudgetWithLines, BudgetColorSettings } from '@/lib/db-types'
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
  recentTransactions: RecentBudgetTxn[]
  plannedTransactions: PlannedBudgetTxn[]
  recurringItems: Recurring[]
  recurringInstances: RecurringInstance[]
  recurringEnabled: boolean
  budgetColors: BudgetColorSettings
  initialStartMonth: string
}

type BudgetKind = 'expense' | 'income'

/** A category is budgeted separately for expenses and for income. */
const slotKey = (kind: BudgetKind, categoryId: string) => `${kind}:${categoryId}`

const linesBySlot = (lines: BudgetLine[]) => {
  const map = new Map<string, BudgetLine[]>()
  for (const l of lines) {
    const key = slotKey(l.kind, l.categoryId)
    map.set(key, [...(map.get(key) ?? []), l])
  }
  return map
}

export function BudgetsClient({
  categories,
  merchants,
  budget,
  recentTransactions,
  plannedTransactions,
  recurringItems,
  recurringInstances,
  recurringEnabled,
  budgetColors,
  initialStartMonth,
}: BudgetsClientProps) {
  const router = useRouter()
  const { run, pending } = useServerAction()
  const [editingBudget, setEditingBudget] = useState<'new' | 'edit' | null>(null)
  const [editingLine, setEditingLine] = useState<{ line: BudgetLine | null; category: Category; kind: BudgetKind } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly')
  const [showAll, setShowAll] = useState<Record<BudgetKind, boolean>>({ expense: false, income: false })
  const [movementsFor, setMovementsFor] = useState<{ category: Category; kind: BudgetKind; line: BudgetLineLite } | null>(null)
  const thisMonth = currentMonth()
  const [startMonth, setStartMonth] = useState(initialStartMonth)

  const changeStartMonth = (month: string) => {
    setStartMonth(month)
    document.cookie = `${BUDGET_START_MONTH_COOKIE}=${month}; path=/; max-age=31536000; samesite=lax`
  }

  const lines = useMemo(() => budget?.lines ?? [], [budget])
  const merchantById = useMemo(() => new Map(merchants.map((m) => [m.id, m])), [merchants])

  const monthlyLines = useMemo(() => lines.filter((l) => l.frequency === 'monthly'), [lines])
  const yearlyLines = useMemo(() => lines.filter((l) => l.frequency === 'yearly'), [lines])
  const monthlyLinesBySlot = useMemo(() => linesBySlot(monthlyLines), [monthlyLines])
  const yearlyLinesBySlot = useMemo(() => linesBySlot(yearlyLines), [yearlyLines])

  const waterfall = useMemo(
    () =>
      budgetWaterfall(lines, recentTransactions, categories, startMonth, thisMonth, {
        expense: budgetColors.expense.threshold,
        income: budgetColors.income.threshold,
      }),
    [lines, recentTransactions, categories, startMonth, thisMonth, budgetColors],
  )
  const balance = useMemo(
    () => balanceToDate(recentTransactions, startMonth, thisMonth),
    [recentTransactions, startMonth, thisMonth],
  )
  const plannedMonthEnd = useMemo(
    () => plannedToMonthEnd(plannedTransactions, recurringItems, recurringInstances, thisMonth),
    [plannedTransactions, recurringItems, recurringInstances, thisMonth],
  )
  const plannedIncome = useMemo(
    () => plannedUncleared(lines, recurringItems, recurringInstances, recentTransactions, startMonth, thisMonth, 'income'),
    [lines, recurringItems, recurringInstances, recentTransactions, startMonth, thisMonth],
  )
  const plannedExpense = useMemo(
    () => plannedUncleared(lines, recurringItems, recurringInstances, recentTransactions, startMonth, thisMonth, 'expense'),
    [lines, recurringItems, recurringInstances, recentTransactions, startMonth, thisMonth],
  )
  const plannedFor = useCallback(
    (c: Category, kind: BudgetKind) => {
      const source = kind === 'income' ? plannedIncome : plannedExpense
      const byCategory = activeTab === 'monthly' ? source.monthlyByCategory : source.yearlyByCategory
      return byCategory.get(c.id) ?? 0
    },
    [plannedIncome, plannedExpense, activeTab],
  )
  const colorFor = useCallback(
    (kind: 'expense' | 'income', state: RatioState, variant: 'solid' | 'bg' | 'ink' = 'solid') =>
      COLOR_VARS[budgetColors[kind].colors[state]][variant],
    [budgetColors],
  )
  const monthlyCatById = useMemo(
    () => new Map(waterfall.monthly.categories.map((c) => [slotKey(c.kind, c.category.id), c])),
    [waterfall],
  )
  const yearlyCatById = useMemo(
    () => new Map(waterfall.yearly.categories.map((c) => [slotKey(c.kind, c.category.id), c])),
    [waterfall],
  )
  const catBySlot = activeTab === 'monthly' ? monthlyCatById : yearlyCatById
  const linesBySlotForTab = activeTab === 'monthly' ? monthlyLinesBySlot : yearlyLinesBySlot

  const monthOptions = useMemo(() => {
    const months = monthsBetween(addMonths(thisMonth, -11), thisMonth)
    return months
      .map((m) => {
        const [y, mm] = m.split('-').map(Number)
        const d = new Date(y, mm - 1, 1)
        const label = d.toLocaleDateString(formatConfig().locale, { month: 'short', year: 'numeric' })
        return { value: m, label: m === thisMonth ? `${label} (ongoing)` : label }
      })
      .reverse()
  }, [thisMonth])

  /** Categories listed under `kind`: those with a budget or actuals for it, or every
   *  active category once the section is expanded with "Display all". */
  const sectionCats = useCallback(
    (kind: BudgetKind) => {
      const budgetedFor = (c: Category) => catBySlot.get(slotKey(kind, c.id))?.budgeted ?? 0
      const all = categories
        .filter((c) => c.isSavings !== 1 && (c.isActive === 1 || linesBySlotForTab.has(slotKey(kind, c.id))))
        .sort((a, b) => budgetedFor(b) - budgetedFor(a))
      const shown = showAll[kind] ? all : all.filter((c) => catBySlot.has(slotKey(kind, c.id)))
      return { shown, hidden: all.length - shown.length }
    },
    [categories, catBySlot, linesBySlotForTab, showAll],
  )
  const expenseSection = useMemo(() => sectionCats('expense'), [sectionCats])
  const incomeSection = useMemo(() => sectionCats('income'), [sectionCats])
  const allSlotKeys = useMemo(
    () => [
      ...expenseSection.shown.map((c) => slotKey('expense', c.id)),
      ...incomeSection.shown.map((c) => slotKey('income', c.id)),
    ],
    [expenseSection, incomeSection],
  )

  const movements = useMemo(() => {
    if (!movementsFor) return []
    const catLines = catBySlot.get(slotKey(movementsFor.kind, movementsFor.category.id))?.lines ?? []
    return catLines.find((cl) => cl.line.id === movementsFor.line.id)?.movements ?? []
  }, [movementsFor, catBySlot])

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

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const renderCategory = (c: Category, kind: BudgetKind) => {
    const key = slotKey(kind, c.id)
    const catResult = catBySlot.get(key)
    const actual = catResult?.actual ?? 0
    const limit = catResult?.budgeted ?? 0
    const catLines = catResult?.lines ?? []
    const isOpen = expanded.has(key)
    const state = ratioState(actual, limit, budgetColors[kind].threshold)
    const isBad = kind === 'income' ? limit > 0 && state === 'under' : state === 'atOrOver'
    const barPct = limit > 0 ? Math.min(100, (actual / limit) * 100) : actual > 0 ? 100 : 0
    const catPlanned = plannedFor(c, kind)
    const combined = actual + catPlanned
    const combinedPct = limit > 0 ? Math.min(100, (combined / limit) * 100) : combined > 0 ? 100 : 0
    const combinedState = ratioState(combined, limit, budgetColors[kind].threshold)
    return (
      <div key={key}>
        <div
          onClick={() => toggle(key)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer' }}
        >
          <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={14} />
          <CatSwatch color={c.color} icon={c.icon} size={28} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{c.name}</span>
          {isBad && <Chip tone="expense">{kind === 'income' ? 'Behind target' : 'Over'}</Chip>}
          <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'var(--mono-fern)' }}>
            {fmt(limit)} / {fmt(actual)}
          </span>
        </div>
        <div className="fern-budget-bar" style={{ display: 'flex' }}>
          <div className="fern-budget-fill" style={{ width: `${barPct}%`, background: colorFor(kind, state) }} />
          {catPlanned > 0 && (
            <div
              className="fern-budget-fill"
              style={{ width: `${Math.max(0, combinedPct - barPct)}%`, background: colorFor(kind, combinedState, 'bg') }}
            />
          )}
        </div>
        {isOpen && (
          <div style={{ marginTop: 10, marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {catLines.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No lines yet</div>
            )}
            {catLines.map(({ line: l, actual: lineActual }) => {
              const label = l.merchantId ? merchantById.get(l.merchantId)?.name ?? l.name ?? 'Line' : l.name ?? 'Line'
              return (
                <div
                  key={l.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0' }}
                >
                  <button
                    type="button"
                    onClick={() => setEditingLine({ line: l as BudgetLine, category: c, kind })}
                    style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', padding: 0 }}
                  >
                    {label}
                  </button>
                  <Chip tone={l.recurring ? 'recurring' : undefined}>{l.recurring ? 'Recurring' : 'Ad-hoc'}</Chip>
                  <span style={{ fontFamily: 'var(--mono-fern)', color: 'var(--ink-soft)', minWidth: 64, textAlign: 'right' }}>
                    {fmt(Number(l.amount ?? 0))}
                  </span>
                  {typeof lineActual === 'number' && (
                    <button
                      type="button"
                      onClick={() => setMovementsFor({ category: c, kind, line: l })}
                      style={{
                        fontFamily: 'var(--mono-fern)', fontSize: 11, minWidth: 72, textAlign: 'right',
                        color: lineActual > Number(l.amount ?? 0) ? 'var(--rose-ink)' : 'var(--ink-faint)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      }}
                    >
                      {fmt(lineActual)} spent
                    </button>
                  )}
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
              onClick={() => setEditingLine({ line: null, category: c, kind })}
              style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--teal-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
            >
              <Icon name="plus" size={12} /> Add line
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderTotalCard = ({
    kind,
    label,
    tab,
    total,
    planned = 0,
  }: {
    kind: 'expense' | 'income'
    label: string
    tab: 'monthly' | 'yearly'
    total: { budgeted: number; actual: number }
    planned?: number
  }) => {
    const threshold = budgetColors[kind].threshold
    const state = ratioState(total.actual, total.budgeted, threshold)
    const actualPct = total.budgeted > 0 ? Math.min(100, (total.actual / total.budgeted) * 100) : total.actual > 0 ? 100 : 0
    const combined = total.actual + planned
    const combinedPct = total.budgeted > 0 ? Math.min(100, (combined / total.budgeted) * 100) : combined > 0 ? 100 : 0
    const combinedState = ratioState(combined, total.budgeted, threshold)
    return (
      <div
        key={`${kind}-${tab}`}
        className={`fern-card selectable${activeTab === tab ? ' selected' : ''}`}
        style={{ flex: '1 1 260px' }}
        onClick={() => setActiveTab(tab)}
      >
        <div style={{ fontSize: 12, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Money amount={total.actual} />
          <div style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)', fontSize: 13 }}>
            of {fmt(total.budgeted)}
          </div>
        </div>
        {planned > 0 && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 2 }}>
            <div style={{ fontFamily: 'var(--mono-fern)', fontSize: 13, color: colorFor(kind, combinedState, 'ink') }}>
              {fmt(combined)} with recurring
            </div>
            <div style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono-fern)', fontSize: 13 }}>
              of {fmt(total.budgeted)}
            </div>
          </div>
        )}
        <div className="fern-budget-bar" style={{ marginTop: 14, display: 'flex' }}>
          <div className="fern-budget-fill" style={{ width: `${actualPct}%`, background: colorFor(kind, state) }} />
          {planned > 0 && (
            <div
              className="fern-budget-fill"
              style={{ width: `${Math.max(0, combinedPct - actualPct)}%`, background: colorFor(kind, combinedState, 'bg') }}
            />
          )}
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 13, fontFamily: 'var(--mono-fern)', color: colorFor(kind, state, 'ink') }}>
            {total.actual > total.budgeted
              ? `${fmt(total.actual - total.budgeted)} over budget`
              : `${fmt(total.budgeted - total.actual)} under budget`}
          </div>
        </div>
      </div>
    )
  }

  const renderBalanceCard = ({
    label,
    row,
    amount,
    income,
    expense,
  }: {
    label: string
    row: number
    amount: number
    income: number
    expense: number
  }) => {
    const state = ratioState(expense, income, budgetColors.expense.threshold)
    return (
      <div className="fern-card" style={{ gridColumn: 3, gridRow: row, background: colorFor('expense', state, 'bg') }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--mono-fern)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: 8 }}>
          {label}
        </div>
        <Money amount={amount} />
        <div style={{ marginTop: 12, fontSize: 13, fontFamily: 'var(--mono-fern)', color: 'var(--ink-soft)' }}>
          +{fmt(income)} · −{fmt(expense)}
        </div>
      </div>
    )
  }

  const renderSection = (kind: BudgetKind, title: string, section: { shown: Category[]; hidden: number }) => (
    <div className="fern-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
        {(showAll[kind] || section.hidden > 0) && (
          <FernButton tone="outline" onClick={() => setShowAll((prev) => ({ ...prev, [kind]: !prev[kind] }))}>
            {showAll[kind] ? 'Hide empty' : `Display all (${section.hidden})`}
          </FernButton>
        )}
      </div>
      {section.shown.length === 0 ? (
        <EmptyState
          illu="∅"
          title={`No ${title.toLowerCase()} to show`}
          description="Nothing budgeted or recorded for this period. Use Display all to budget a category."
          style={{ padding: '40px 20px' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {section.shown.map((c) => renderCategory(c, kind))}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <PageHeader
        kicker={activeTab === 'monthly' ? 'This month vs budget' : `Since ${monthOptions.find((o) => o.value === startMonth)?.label ?? startMonth} vs budget`}
        title={<em>Budget</em>}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {budget && (
              <>
                <div style={{ minWidth: 170 }}>
                  <SearchableSelect value={startMonth} onChange={(v) => v && changeStartMonth(v)} options={monthOptions} placeholder="Starting month" />
                </div>
                <FernButton tone="outline" onClick={() => setExpanded(new Set(allSlotKeys))}>Expand all</FernButton>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr minmax(200px, 0.7fr)', gap: 16, marginBottom: 24 }}>
            {renderBalanceCard({
              label: 'Balance to date',
              row: 1,
              amount: balance.balance,
              income: balance.income,
              expense: balance.expense,
            })}
            {renderBalanceCard({
              label: 'Balance at month end',
              row: 2,
              amount: balance.balance + plannedMonthEnd.income - plannedMonthEnd.expense,
              income: balance.income + plannedMonthEnd.income,
              expense: balance.expense + plannedMonthEnd.expense,
            })}
            {renderTotalCard({
              kind: 'expense',
              label: 'Expenses · Monthly',
              tab: 'monthly',
              total: waterfall.monthly.expense,
              planned: plannedExpense.monthly,
            })}
            {renderTotalCard({
              kind: 'expense',
              label: 'Expenses · Yearly',
              tab: 'yearly',
              total: waterfall.yearly.expense,
              planned: plannedExpense.yearly,
            })}
            {renderTotalCard({
              kind: 'income',
              label: 'Revenue · Monthly',
              tab: 'monthly',
              total: waterfall.monthly.income,
              planned: plannedIncome.monthly,
            })}
            {renderTotalCard({
              kind: 'income',
              label: 'Revenue · Yearly',
              tab: 'yearly',
              total: waterfall.yearly.income,
              planned: plannedIncome.yearly,
            })}
          </div>

          {renderSection('expense', 'Expenses', expenseSection)}
          {renderSection('income', 'Revenues', incomeSection)}
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
        kind={editingLine?.kind ?? 'expense'}
        merchants={merchants}
        recurringItems={recurringItems}
        recurringEnabled={recurringEnabled}
        item={editingLine?.line ?? null}
        initialFrequency={activeTab}
        onSave={(data) => {
          if (!budget || !editingLine) return
          const { category, kind, line } = editingLine
          run(async () => {
            if (line) {
              await updateBudgetLine(line.id, {
                name: data.name,
                merchantId: data.merchantId,
                amount: data.amount,
                frequency: data.frequency,
                recurring: data.recurring,
                sourceRecurringId: data.sourceRecurringId,
              })
            } else {
              await addBudgetLine(budget.id, {
                name: data.name,
                kind,
                categoryId: category.id,
                merchantId: data.merchantId,
                amount: data.amount,
                frequency: data.frequency,
                recurring: data.recurring,
                sourceRecurringId: data.sourceRecurringId,
              })
            }
          })
        }}
      />

      <CategoryMovementsModal
        open={movementsFor !== null}
        onClose={() => setMovementsFor(null)}
        title={
          movementsFor
            ? movementsFor.line.merchantId
              ? merchantById.get(movementsFor.line.merchantId)?.name ?? movementsFor.line.name ?? 'Line'
              : movementsFor.line.name ?? 'Line'
            : ''
        }
        movements={movements}
        merchants={merchants}
      />
    </div>
  )
}
