'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { CategoryBars } from '@/components/fern/category-bars'
import { BalanceEvolution } from '@/components/fern/balance-evolution'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { SegmentedControl } from '@/components/fern/segmented-control'
import { EmptyState } from '@/components/fern/empty-state'
import { SimulationSheet } from '@/components/fern/sheets/simulation-sheet'
import { SimulationLineSheet } from '@/components/fern/sheets/simulation-line-sheet'
import {
  fmt,
  currentBalance,
  simulationTotals,
  simulationLinesByCategory,
  currentRecurringMonthlyNet,
  simulationBalanceProjection,
  type SimulationView,
  type Category,
  type Recurring,
  type Transaction,
} from '@/lib/derive'
import type { Merchant, SimulationLine, SimulationWithLines } from '@/lib/db-types'
import {
  addSimulationLine,
  deleteSimulation,
  deleteSimulationLine,
  duplicateSimulation,
  updateSimulation,
  updateSimulationLine,
} from '@/lib/actions/simulations'

const VIEWS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

interface SimulationDetailClientProps {
  simulation: SimulationWithLines
  categories: Category[]
  merchants: Merchant[]
  recurringOptions: Recurring[]
  recurringEnabled: boolean
  startingBalance: number
  transactions: Transaction[]
}

export function SimulationDetailClient({
  simulation,
  categories,
  merchants,
  recurringOptions,
  recurringEnabled,
  startingBalance,
  transactions,
}: SimulationDetailClientProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editingSimulation, setEditingSimulation] = useState(false)
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [addingKind, setAddingKind] = useState<'expense' | 'income' | null>(null)
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly')
  const [includeYearlySplit, setIncludeYearlySplit] = useState(false)

  const view: SimulationView =
    viewMode === 'yearly' ? 'yearly' : includeYearlySplit ? 'monthly-with-yearly' : 'monthly'

  const totals = useMemo(() => simulationTotals(simulation.lines, view), [simulation.lines, view])
  const revenueBars = useMemo(
    () => simulationLinesByCategory(simulation.lines, categories, 'income', view),
    [simulation.lines, categories, view],
  )
  const expenseBars = useMemo(
    () => simulationLinesByCategory(simulation.lines, categories, 'expense', view),
    [simulation.lines, categories, view],
  )

  const currentRecurringNet = useMemo(() => currentRecurringMonthlyNet(recurringOptions), [recurringOptions])
  const simulationNetMonthly = useMemo(
    () => {
      const t = simulationTotals(simulation.lines, 'monthly-with-yearly')
      return t.income - t.expense
    },
    [simulation.lines],
  )
  const delta = viewMode === 'yearly' ? (simulationNetMonthly - currentRecurringNet) * 12 : simulationNetMonthly - currentRecurringNet

  const balanceSeries = useMemo(
    () => simulationBalanceProjection(currentBalance(startingBalance, transactions), simulationNetMonthly),
    [startingBalance, transactions, simulationNetMonthly],
  )

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const merchantById = useMemo(() => new Map(merchants.map((m) => [m.id, m])), [merchants])
  const recurringById = useMemo(() => new Map(recurringOptions.map((r) => [r.id, r])), [recurringOptions])

  const editingLineItem = editingLine ? simulation.lines.find((l) => l.id === editingLine) ?? null : null

  const handleSaveSimulation = (data: { name: string; description: string | null }) => {
    startTransition(async () => {
      try {
        await updateSimulation(simulation.id, { name: data.name, description: data.description })
      } catch (e) {
        alert(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  const handleDuplicate = () => {
    startTransition(async () => {
      try {
        const clone = await duplicateSimulation(simulation.id)
        router.push(`/simulations/${clone.id}`)
      } catch (e) {
        alert(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  const handleDeleteSimulation = () => {
    if (!confirm('Delete this simulation?')) return
    startTransition(async () => {
      try {
        await deleteSimulation(simulation.id)
        router.push('/simulations')
      } catch (e) {
        alert(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  const handleSaveLine = (data: Parameters<typeof addSimulationLine>[1]) => {
    startTransition(async () => {
      try {
        if (editingLine) {
          // sourceRecurringId is intentionally left untouched on edits — it's
          // provenance ("copied from X"), not something an edit form should overwrite.
          await updateSimulationLine(editingLine, {
            name: data.name,
            kind: data.kind,
            categoryId: data.categoryId,
            merchantId: data.merchantId,
            amount: data.amount,
            frequency: data.frequency,
          })
        } else {
          await addSimulationLine(simulation.id, data)
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : 'An error occurred')
      }
    })
    setEditingLine(null)
    setAddingKind(null)
  }

  const handleDeleteLine = (id: string) => {
    if (!confirm('Delete this line?')) return
    startTransition(async () => {
      try {
        await deleteSimulationLine(id)
      } catch (e) {
        alert(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  const revenues = simulation.lines.filter((l) => l.kind === 'income')
  const expenses = simulation.lines.filter((l) => l.kind === 'expense')

  return (
    <div>
      <Link href="/simulations" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-faint)', textDecoration: 'none', marginBottom: 8 }}>
        <Icon name="chevronLeft" size={12} /> Simulations
      </Link>

      <PageHeader
        kicker="What-if scenario"
        title={<em>{simulation.name}</em>}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <FernButton tone="outline" onClick={() => setEditingSimulation(true)}>
              <Icon name="edit" size={14} /> Edit
            </FernButton>
            <FernButton tone="outline" onClick={handleDuplicate}>
              <Icon name="repeat" size={14} /> Duplicate
            </FernButton>
            <FernButton tone="danger" onClick={handleDeleteSimulation}>
              <Icon name="trash" size={14} /> Delete
            </FernButton>
          </div>
        }
      />

      {simulation.description && (
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginTop: -12, marginBottom: 20 }}>{simulation.description}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <SegmentedControl value={viewMode} onChange={(v) => setViewMode(v as 'monthly' | 'yearly')} options={VIEWS} />
        {viewMode === 'monthly' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-faint)', cursor: 'pointer' }}>
            <input type="checkbox" checked={includeYearlySplit} onChange={(e) => setIncludeYearlySplit(e.target.checked)} />
            Include yearly (amortized)
          </label>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="fern-card">
          <div className="fern-page-kicker">{viewMode === 'yearly' ? 'Yearly' : 'Monthly'} · In</div>
          <div className="fern-display" style={{ fontSize: 32, color: 'var(--sage-ink)', marginTop: 4 }}>+{fmt(totals.income)}</div>
        </div>
        <div className="fern-card">
          <div className="fern-page-kicker">{viewMode === 'yearly' ? 'Yearly' : 'Monthly'} · Out</div>
          <div className="fern-display" style={{ fontSize: 32, color: 'var(--rose-ink)', marginTop: 4 }}>−{fmt(totals.expense)}</div>
        </div>
        <div className="fern-card">
          <div className="fern-page-kicker">Net</div>
          <div className="fern-display" style={{ fontSize: 32, color: totals.income - totals.expense >= 0 ? 'var(--sage-ink)' : 'var(--rose-ink)', marginTop: 4 }}>
            {totals.income - totals.expense >= 0 ? '+' : '−'}{fmt(Math.abs(totals.income - totals.expense))}
          </div>
          {recurringEnabled && (
            <div style={{ color: 'var(--ink-faint)', fontSize: 11, marginTop: 6 }}>
              {delta >= 0 ? '+' : '−'}{fmt(Math.abs(delta))} vs. your current recurring
            </div>
          )}
        </div>
      </div>

      <div className="fern-card" style={{ marginBottom: 24 }}>
        <div className="fern-page-kicker" style={{ marginBottom: 8 }}>Projected balance · next 12 months</div>
        <BalanceEvolution series={balanceSeries} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="fern-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Revenues</h3>
            <FernButton tone="outline" onClick={() => setAddingKind('income')} style={{ padding: '6px 10px', fontSize: 12 }}>
              <Icon name="plus" size={12} /> Add revenue
            </FernButton>
          </div>
          {revenueBars.length === 0 ? (
            <div style={{ color: 'var(--ink-faint)', padding: '12px 0', fontSize: 13 }}>None yet</div>
          ) : (
            <CategoryBars items={revenueBars} />
          )}
        </div>
        <div className="fern-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Expenses</h3>
            <FernButton tone="outline" onClick={() => setAddingKind('expense')} style={{ padding: '6px 10px', fontSize: 12 }}>
              <Icon name="plus" size={12} /> Add expense
            </FernButton>
          </div>
          {expenseBars.length === 0 ? (
            <div style={{ color: 'var(--ink-faint)', padding: '12px 0', fontSize: 13 }}>None yet</div>
          ) : (
            <CategoryBars items={expenseBars} />
          )}
        </div>
      </div>

      {simulation.lines.length === 0 ? (
        <EmptyState
          illu="◇"
          title="No lines yet"
          description="Add revenues and expenses from scratch, or copy them from a recurring item."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <LineList title="Revenue lines" lines={revenues} categoryById={categoryById} merchantById={merchantById} recurringById={recurringById} onEdit={setEditingLine} onDelete={handleDeleteLine} />
          <LineList title="Expense lines" lines={expenses} categoryById={categoryById} merchantById={merchantById} recurringById={recurringById} onEdit={setEditingLine} onDelete={handleDeleteLine} />
        </div>
      )}

      <SimulationSheet
        open={editingSimulation}
        onClose={() => setEditingSimulation(false)}
        item={simulation}
        recurringEnabled={recurringEnabled}
        onSave={handleSaveSimulation}
      />

      <SimulationLineSheet
        open={!!editingLine || !!addingKind}
        onClose={() => { setEditingLine(null); setAddingKind(null) }}
        categories={categories}
        merchants={merchants}
        recurringOptions={recurringOptions}
        recurringEnabled={recurringEnabled}
        item={editingLineItem}
        initialKind={addingKind ?? undefined}
        onSave={handleSaveLine}
      />
    </div>
  )
}

function LineList({
  title,
  lines,
  categoryById,
  merchantById,
  recurringById,
  onEdit,
  onDelete,
}: {
  title: string
  lines: SimulationLine[]
  categoryById: Map<string, Category>
  merchantById: Map<string, Merchant>
  recurringById: Map<string, Recurring>
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="fern-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
        <span className="fern-page-kicker">{lines.length} items</span>
      </div>
      {lines.length === 0 ? (
        <div style={{ color: 'var(--ink-faint)', padding: '20px 0', textAlign: 'center', fontSize: 13 }}>None yet</div>
      ) : (
        lines.map((l) => {
          const cat = l.categoryId ? categoryById.get(l.categoryId) : undefined
          const merchant = l.merchantId ? merchantById.get(l.merchantId) : undefined
          const source = l.sourceRecurringId ? recurringById.get(l.sourceRecurringId) : undefined
          return (
            <div key={l.id} onClick={() => onEdit(l.id)} style={{ cursor: 'pointer' }}>
              <div className="fern-txn-row">
                <CatSwatch color={cat?.color} icon={cat?.icon ?? 'tag'} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                    {l.name || cat?.name || 'Uncategorized'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                    {[cat?.name, merchant?.name].filter(Boolean).join(' · ')}
                    {l.frequency === 'yearly' ? ' · Yearly' : ' · Monthly'}
                    {source && ` · from ${source.name}`}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: l.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
                  {l.kind === 'income' ? '+' : '−'}{fmt(l.amount)}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(l.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'grid', placeItems: 'center', padding: 4 }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
