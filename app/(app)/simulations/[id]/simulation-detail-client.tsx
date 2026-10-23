'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/fern/icon'
import { CatSwatch } from '@/components/fern/cat-swatch'
import { CategoryBars } from '@/components/fern/category-bars'
import { SimulationComparisonChart } from '@/components/fern/simulation-comparison-chart'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { SegmentedControl } from '@/components/fern/segmented-control'
import { SimulationSheet } from '@/components/fern/sheets/simulation-sheet'
import { SimulationLineSheet } from '@/components/fern/sheets/simulation-line-sheet'
import {
  fmt,
  signedFmt,
  simulationTotals,
  simulationExpenseByPriority,
  simulationLinesByCategory,
  sortSimulationLines,
  groupSimulationLinesByCategory,
  simulationLineDisplayAmount,
  currentRecurringMonthlyNet,
  simulationVsActualsMonthly,
  describeSimulationInputs,
  type SimulationInputs,
  type Category,
  type Recurring,
  type Transaction,
} from '@/lib/derive'
import type { Merchant, SimulationLine, SimulationWithLines } from '@/lib/db-types'
import { alertDialog, confirmDialog } from '@/lib/dialogs-store'
import { Modal } from '@/components/fern/modal'
import {
  addSimulationLine,
  applySimulationLineAverage,
  deleteSimulation,
  deleteSimulationLine,
  duplicateSimulation,
  updateSimulation,
  updateSimulationLine,
} from '@/lib/actions/simulations'
import { createBudgetFromSimulation } from '@/lib/actions/budgets'

/** Per-line provenance chips. `manual` lines carry no chip. Order = legend order. */
const ORIGINS = [
  { key: 'recurring', label: 'recurring', bg: 'var(--teal-bg)', ink: 'var(--teal-ink)' },
  { key: 'average', label: 'averaged', bg: 'var(--butter-bg)', ink: 'var(--butter-ink)' },
  { key: 'rollup', label: 'grouped', bg: 'var(--lilac-bg)', ink: 'var(--lilac-ink)' },
  { key: 'manual', label: 'added by hand', bg: 'var(--line-soft)', ink: 'var(--ink-soft)' },
] as const

const ORIGIN_META = Object.fromEntries(ORIGINS.map((o) => [o.key, o])) as Record<
  string,
  (typeof ORIGINS)[number]
>

type Priority = 'must' | 'should' | 'nice'

/** Per-expense-line importance flag. `next` drives the click-to-cycle order. */
const PRIORITY = {
  must: { letter: 'M', label: 'Must', bg: 'var(--rose-bg)', ink: 'var(--rose-ink)', next: 'should' },
  should: { letter: 'S', label: 'Should', bg: 'var(--butter-bg)', ink: 'var(--butter-ink)', next: 'nice' },
  nice: { letter: 'N', label: 'Nice', bg: 'var(--sage-bg)', ink: 'var(--sage-ink)', next: 'must' },
} as const satisfies Record<Priority, { letter: string; label: string; bg: string; ink: string; next: Priority }>

function PriorityBadge({ priority, onCycle }: { priority: Priority; onCycle: (next: Priority) => void }) {
  const p = PRIORITY[priority]
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onCycle(p.next) }}
      aria-label={`Priority: ${p.label}. Click to change.`}
      title={p.label}
      style={{
        width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
        background: p.bg, color: p.ink, fontFamily: 'var(--mono-fern)', fontSize: 11, fontWeight: 700,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}
    >
      {p.letter}
    </button>
  )
}

const chipStyle = (bg: string, ink: string) => ({
  fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  padding: '1px 5px', borderRadius: 4, background: bg, color: ink,
})

/**
 * Provenance chip for a line. Averaged/grouped lines show CALC (amount still the
 * one computed from history) or MANUAL (amount hand-edited since). Recurring lines
 * keep their chip; manual lines carry none.
 */
function OriginChip({ line }: { line: SimulationLine }) {
  if (line.origin === 'average' || line.origin === 'rollup') {
    return line.amountManual === 1
      ? <span style={chipStyle('var(--butter-bg)', 'var(--butter-ink)')}>manual</span>
      : <span style={chipStyle('var(--sage-bg)', 'var(--sage-ink)')}>calc</span>
  }
  const m = ORIGIN_META[line.origin]
  if (!m || line.origin === 'manual') return null
  return <span style={chipStyle(m.bg, m.ink)}>{m.label}</span>
}

interface SimulationDetailClientProps {
  simulation: SimulationWithLines
  categories: Category[]
  merchants: Merchant[]
  recurringOptions: Recurring[]
  recurringEnabled: boolean
  budgetsEnabled: boolean
  transactions: Transaction[]
}

export function SimulationDetailClient({
  simulation,
  categories,
  merchants,
  recurringOptions,
  recurringEnabled,
  budgetsEnabled,
  transactions,
}: SimulationDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingSimulation, setEditingSimulation] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [addingKind, setAddingKind] = useState<'expense' | 'income' | null>(null)
  const [addingFrequency, setAddingFrequency] = useState<'monthly' | 'yearly' | null>(null)
  const [pushing, setPushing] = useState(false)
  const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly')

  const currentRecurringNet = useMemo(() => currentRecurringMonthlyNet(recurringOptions), [recurringOptions])

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const merchantById = useMemo(() => new Map(merchants.map((m) => [m.id, m])), [merchants])
  const recurringById = useMemo(() => new Map(recurringOptions.map((r) => [r.id, r])), [recurringOptions])

  const monthlyLines = useMemo(() => simulation.lines.filter((l) => l.frequency === 'monthly'), [simulation.lines])
  const yearlyLines = useMemo(() => simulation.lines.filter((l) => l.frequency === 'yearly'), [simulation.lines])

  const editingLineItem = editingLine ? simulation.lines.find((l) => l.id === editingLine) ?? null : null

  const seededWith = useMemo<string[] | null>(() => {
    if (!simulation.inputs) return null
    try {
      return describeSimulationInputs(JSON.parse(simulation.inputs) as SimulationInputs)
    } catch {
      return null
    }
  }, [simulation.inputs])

  const simulationInputs = useMemo<SimulationInputs | null>(() => {
    if (!simulation.inputs) return null
    try {
      return JSON.parse(simulation.inputs) as SimulationInputs
    } catch {
      return null
    }
  }, [simulation.inputs])

  const originCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of simulation.lines) c[l.origin] = (c[l.origin] ?? 0) + 1
    return c
  }, [simulation.lines])

  const handleSaveSimulation = (data: { name: string; description: string | null }) => {
    startTransition(async () => {
      try {
        await updateSimulation(simulation.id, { name: data.name, description: data.description })
      } catch (e) {
        void alertDialog(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  const handleDuplicate = () => {
    startTransition(async () => {
      try {
        const clone = await duplicateSimulation(simulation.id)
        router.push(`/simulations/${clone.id}`)
      } catch (e) {
        void alertDialog(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  const handleDeleteSimulation = async () => {
    if (!(await confirmDialog({ message: 'Delete this simulation?', confirmLabel: 'Delete', tone: 'danger' }))) return
    startTransition(async () => {
      try {
        await deleteSimulation(simulation.id)
        router.push('/simulations')
      } catch (e) {
        void alertDialog(e instanceof Error ? e.message : 'An error occurred')
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
        void alertDialog(e instanceof Error ? e.message : 'An error occurred')
      }
    })
    setEditingLine(null)
    setAddingKind(null)
    setAddingFrequency(null)
  }

  const handleSetPriority = (id: string, priority: Priority) => {
    startTransition(async () => {
      try {
        await updateSimulationLine(id, { priority })
      } catch (e) {
        void alertDialog(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  const handleApplyAverage = (lineId: string, data: { months: number; excludedTxnIds: string[] }) => {
    startTransition(async () => {
      try {
        await applySimulationLineAverage(lineId, data)
      } catch (e) {
        void alertDialog(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  const handleDeleteLine = async (id: string) => {
    if (!(await confirmDialog({ message: 'Delete this line?', confirmLabel: 'Delete', tone: 'danger' }))) return
    startTransition(async () => {
      try {
        await deleteSimulationLine(id)
      } catch (e) {
        void alertDialog(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  const handlePushToBudget = () => {
    startTransition(async () => {
      try {
        await createBudgetFromSimulation({
          simulationId: simulation.id,
          createdOnLabel: new Date().toLocaleDateString(),
        })
        setPushing(false)
        router.push('/budgets')
      } catch (e) {
        void alertDialog(e instanceof Error ? e.message : 'An error occurred')
      }
    })
  }

  return (
    <div>
      <Link href="/simulations" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-faint)', textDecoration: 'none', marginBottom: 8 }}>
        <Icon name="chevronLeft" size={12} /> Simulations
      </Link>

      <PageHeader
        kicker="What-if scenario"
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <em>{simulation.name}</em>
            {seededWith && (
              <button
                type="button"
                onClick={() => setShowInfo(true)}
                aria-label="What's included in this simulation"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'grid', placeItems: 'center', padding: 2 }}
              >
                <Icon name="info" size={18} />
              </button>
            )}
          </span>
        }
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {budgetsEnabled && (
              <FernButton tone="outline" onClick={() => setPushing(true)}>
                <Icon name="pie" size={14} /> Push to budget
              </FernButton>
            )}
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

      {seededWith && (
        <Modal
          open={showInfo}
          onClose={() => setShowInfo(false)}
          title="What's included"
          footer={
            <button type="button" className="fern-btn sheet-primary primary" onClick={() => setShowInfo(false)}>
              Got it
            </button>
          }
        >
          {seededWith.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Seeded with</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {seededWith.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Lines now</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {ORIGINS.filter((o) => originCounts[o.key]).map((o, i) => (
                <span key={o.key}>
                  {i > 0 && ' · '}
                  {originCounts[o.key]} {o.label}
                </span>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {simulation.lines.length === 0 ? (
        <div className="fern-card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--ink-faint)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>◇</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>No lines yet</div>
          <div style={{ fontSize: 13 }}>Add revenues and expenses from scratch, or copy them from a recurring item.</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <SegmentedControl
              value={activeTab}
              onChange={(v) => setActiveTab(v as 'monthly' | 'yearly')}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
              ]}
            />
          </div>

          {activeTab === 'monthly' ? (
            <SimulationFrequencySection
              title="Monthly budget"
              frequency="monthly"
              lines={monthlyLines}
              categories={categories}
              categoryById={categoryById}
              merchantById={merchantById}
              recurringById={recurringById}
              recurringOptions={recurringOptions}
              transactions={transactions}
              recurringEnabled={recurringEnabled}
              currentRecurringNet={currentRecurringNet}
              onAddLine={(kind) => { setAddingKind(kind); setAddingFrequency('monthly') }}
              onEditLine={setEditingLine}
              onDeleteLine={handleDeleteLine}
              onSetPriority={handleSetPriority}
            />
          ) : (
            <SimulationFrequencySection
              title="Yearly budget"
              frequency="yearly"
              lines={yearlyLines}
              allLines={simulation.lines}
              categories={categories}
              categoryById={categoryById}
              merchantById={merchantById}
              recurringById={recurringById}
              recurringOptions={recurringOptions}
              transactions={transactions}
              recurringEnabled={recurringEnabled}
              currentRecurringNet={currentRecurringNet}
              onAddLine={(kind) => { setAddingKind(kind); setAddingFrequency('yearly') }}
              onEditLine={setEditingLine}
              onDeleteLine={handleDeleteLine}
              onSetPriority={handleSetPriority}
            />
          )}
        </>
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
        onClose={() => { setEditingLine(null); setAddingKind(null); setAddingFrequency(null) }}
        categories={categories}
        merchants={merchants}
        recurringOptions={recurringOptions}
        recurringEnabled={recurringEnabled}
        item={editingLineItem}
        initialKind={addingKind ?? undefined}
        initialFrequency={addingFrequency ?? undefined}
        transactions={transactions}
        simulationInputs={simulationInputs}
        onApplyAverage={handleApplyAverage}
        pending={isPending}
        onSave={handleSaveLine}
      />

      {budgetsEnabled && (
        <Modal
          open={pushing}
          onClose={() => setPushing(false)}
          title="Push to budget"
          footer={
            <>
              <button type="button" className="fern-btn sheet-secondary" onClick={() => setPushing(false)}>
                Cancel
              </button>
              <button type="button" className="fern-btn sheet-primary primary" onClick={handlePushToBudget} disabled={isPending}>
                Replace budget
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
            This <strong>replaces any existing budget</strong>. Every line in this simulation
            (with a category) is copied into the budget as-is: recurring lines stay recurring,
            the rest become ad-hoc, and monthly vs yearly is kept. Lines without a category are
            skipped.
          </p>
        </Modal>
      )}
    </div>
  )
}

/** One frequency-pure section of the simulation: totals, comparison chart, category bars, line lists. */
function SimulationFrequencySection({
  title,
  frequency,
  lines,
  allLines,
  categories,
  categoryById,
  merchantById,
  recurringById,
  recurringOptions,
  transactions,
  recurringEnabled,
  currentRecurringNet,
  onAddLine,
  onEditLine,
  onDeleteLine,
  onSetPriority,
}: {
  title: string
  frequency: 'monthly' | 'yearly'
  lines: SimulationLine[]
  /** All simulation lines; when given (yearly), the Net card covers the full year: 12 months + yearly lines. */
  allLines?: SimulationLine[]
  categories: Category[]
  categoryById: Map<string, Category>
  merchantById: Map<string, Merchant>
  recurringById: Map<string, Recurring>
  recurringOptions: Recurring[]
  transactions: Transaction[]
  recurringEnabled: boolean
  currentRecurringNet: number
  onAddLine: (kind: 'expense' | 'income') => void
  onEditLine: (id: string) => void
  onDeleteLine: (id: string) => void
  onSetPriority: (id: string, priority: Priority) => void
}) {
  const [lineView, setLineView] = useState<'amount' | 'category'>('category')
  const freqLabel = frequency === 'yearly' ? 'Yearly' : 'Monthly'

  const totals = useMemo(() => simulationTotals(lines, frequency), [lines, frequency])
  const expenseByPriority = useMemo(() => simulationExpenseByPriority(lines, frequency), [lines, frequency])
  const revenueBars = useMemo(
    () => simulationLinesByCategory(lines, categories, 'income', frequency),
    [lines, categories, frequency],
  )
  const expenseBars = useMemo(
    () => simulationLinesByCategory(lines, categories, 'expense', frequency),
    [lines, categories, frequency],
  )

  const netLines = allLines ?? lines
  const netTotals = useMemo(() => simulationTotals(netLines, frequency), [netLines, frequency])
  const netByPriority = useMemo(() => simulationExpenseByPriority(netLines, frequency), [netLines, frequency])
  const netMin = netTotals.income - netTotals.expense
  const netMax = netTotals.income - (netByPriority.must + netByPriority.should)
  const netTone = !allLines ? undefined : netMin >= 0 ? 'sage' : netMax >= 0 ? 'butter' : 'rose'

  const baseline = frequency === 'yearly' ? currentRecurringNet * 12 : currentRecurringNet
  const delta = netMin - baseline

  const comparison = useMemo(
    () => simulationVsActualsMonthly(lines, transactions, recurringOptions, frequency),
    [lines, transactions, recurringOptions, frequency],
  )

  const originCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of lines) c[l.origin] = (c[l.origin] ?? 0) + 1
    return c
  }, [lines])

  /** Legend entries mirroring the per-line chips actually shown. */
  const chipLegend = useMemo(() => {
    const calc = lines.filter((l) => (l.origin === 'average' || l.origin === 'rollup'))
    return [
      { key: 'recurring', label: 'recurring', bg: 'var(--teal-bg)', on: !!originCounts.recurring },
      { key: 'calc', label: 'calc (from history)', bg: 'var(--sage-bg)', on: calc.some((l) => l.amountManual !== 1) },
      { key: 'manual', label: 'manual (hand-set)', bg: 'var(--butter-bg)', on: calc.some((l) => l.amountManual === 1) },
    ].filter((e) => e.on)
  }, [lines, originCounts])

  const revenues = lines.filter((l) => l.kind === 'income')
  const expenses = lines.filter((l) => l.kind === 'expense')

  return (
    <div>
      <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{title}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="fern-card">
          <div className="fern-page-kicker">{freqLabel} · In</div>
          <div className="fern-display" style={{ fontSize: 32, color: 'var(--sage-ink)', marginTop: 4 }}>+{fmt(totals.income)}</div>
        </div>
        <div className="fern-card">
          <div className="fern-page-kicker">{freqLabel} · Out</div>
          <div className="fern-display" style={{ fontSize: 32, color: 'var(--rose-ink)', marginTop: 4 }}>−{fmt(totals.expense)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8, fontSize: 11, color: 'var(--ink-faint)' }}>
            {(['must', 'should', 'nice'] as const).map((k) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{PRIORITY[k].label}</span>
                <span style={{ fontFamily: 'var(--mono-fern)' }}>−{fmt(expenseByPriority[k])}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="fern-card" style={netTone ? { background: `var(--${netTone}-bg)` } : undefined}>
          <div className="fern-page-kicker">{allLines ? 'Yearly net · 12 months + yearly' : 'Net'}</div>
          {netMin === netMax ? (
            <div className="fern-display" style={{ fontSize: 32, color: netMin >= 0 ? 'var(--sage-ink)' : 'var(--rose-ink)', marginTop: 4 }}>
              {signedFmt(netMin)}
            </div>
          ) : (
            <div className="fern-display" style={{ fontSize: 24, marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: netMin >= 0 ? 'var(--sage-ink)' : 'var(--rose-ink)' }}>{signedFmt(netMin)}</span>
              <span style={{ color: 'var(--ink-faint)', fontSize: 16 }}>–</span>
              <span style={{ color: netMax >= 0 ? 'var(--sage-ink)' : 'var(--rose-ink)' }}>{signedFmt(netMax)}</span>
            </div>
          )}
          <div style={{ color: 'var(--ink-faint)', fontSize: 11, marginTop: 6 }}>
            min: all expenses · max: Must + Should only
          </div>
          {recurringEnabled && (
            <div style={{ color: 'var(--ink-faint)', fontSize: 11, marginTop: 4 }}>
              {delta >= 0 ? '+' : '−'}{fmt(Math.abs(delta))} vs. your current recurring
            </div>
          )}
        </div>
      </div>

      <div className="fern-card" style={{ marginBottom: 24 }}>
        <div className="fern-page-kicker" style={{ marginBottom: 8 }}>Simulation vs. last 12 months</div>
        <SimulationComparisonChart data={comparison} view={frequency} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="fern-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Revenues</h3>
            <FernButton tone="outline" onClick={() => onAddLine('income')} style={{ padding: '6px 10px', fontSize: 12 }}>
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
            <FernButton tone="outline" onClick={() => onAddLine('expense')} style={{ padding: '6px 10px', fontSize: 12 }}>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {chipLegend.map((o) => (
            <span key={o.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-faint)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: o.bg }} />
              {o.label}
            </span>
          ))}
        </div>
        <SegmentedControl
          value={lineView}
          onChange={(v) => setLineView(v as 'amount' | 'category')}
          options={[
            { value: 'amount', label: 'By amount' },
            { value: 'category', label: 'By category' },
          ]}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <LineList title="Revenue lines" lines={revenues} view={lineView} viewMode={frequency} categories={categories} categoryById={categoryById} merchantById={merchantById} recurringById={recurringById} onEdit={onEditLine} onDelete={onDeleteLine} onSetPriority={onSetPriority} />
        <LineList title="Expense lines" lines={expenses} view={lineView} viewMode={frequency} categories={categories} categoryById={categoryById} merchantById={merchantById} recurringById={recurringById} onEdit={onEditLine} onDelete={onDeleteLine} onSetPriority={onSetPriority} />
      </div>
    </div>
  )
}

function LineList({
  title,
  lines,
  view,
  viewMode,
  categories,
  categoryById,
  merchantById,
  recurringById,
  onEdit,
  onDelete,
  onSetPriority,
}: {
  title: string
  lines: SimulationLine[]
  view: 'amount' | 'category'
  viewMode: 'monthly' | 'yearly'
  categories: Category[]
  categoryById: Map<string, Category>
  merchantById: Map<string, Merchant>
  recurringById: Map<string, Recurring>
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onSetPriority: (id: string, priority: Priority) => void
}) {
  const groups = view === 'category' ? groupSimulationLinesByCategory(lines, categories, viewMode) : null
  const rowProps = { viewMode, categoryById, merchantById, recurringById, onEdit, onDelete, onSetPriority }

  return (
    <div className="fern-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
        <span className="fern-page-kicker">{lines.length} items</span>
      </div>
      {lines.length === 0 ? (
        <div style={{ color: 'var(--ink-faint)', padding: '20px 0', textAlign: 'center', fontSize: 13 }}>None yet</div>
      ) : groups ? (
        groups.map((g) => (
          <div key={g.key} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {g.cat && <CatSwatch color={g.cat.color} icon={g.cat.icon ?? 'tag'} size={18} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{g.key}</span>
              </div>
              <span style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', color: 'var(--ink-faint)' }}>{fmt(g.total)}</span>
            </div>
            {g.lines.map((l) => <LineRow key={l.id} l={l} {...rowProps} />)}
          </div>
        ))
      ) : (
        sortSimulationLines(lines, viewMode).map((l) => <LineRow key={l.id} l={l} {...rowProps} />)
      )}
    </div>
  )
}

function LineRow({
  l,
  viewMode,
  categoryById,
  merchantById,
  recurringById,
  onEdit,
  onDelete,
  onSetPriority,
}: {
  l: SimulationLine
  viewMode: 'monthly' | 'yearly'
  categoryById: Map<string, Category>
  merchantById: Map<string, Merchant>
  recurringById: Map<string, Recurring>
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onSetPriority: (id: string, priority: Priority) => void
}) {
  const cat = l.categoryId ? categoryById.get(l.categoryId) : undefined
  const merchant = l.merchantId ? merchantById.get(l.merchantId) : undefined
  const source = l.sourceRecurringId ? recurringById.get(l.sourceRecurringId) : undefined
  return (
    <div onClick={() => onEdit(l.id)} style={{ cursor: 'pointer' }}>
      <div className="fern-txn-row">
        {l.origin === 'rollup' ? (
          <CatSwatch color="lilac" icon="list" size={34} />
        ) : (
          <CatSwatch color={cat?.color} icon={cat?.icon ?? 'tag'} size={34} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {l.name || cat?.name || 'Uncategorized'}
            <OriginChip line={l} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            {[cat?.name, merchant?.name].filter(Boolean).join(' · ')}
            {l.frequency === 'yearly' ? ' · Yearly' : ' · Monthly'}
            {source && ` · from ${source.name}`}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: l.kind === 'income' ? 'var(--sage-ink)' : 'var(--rose-ink)', fontFamily: 'var(--mono-fern)', flexShrink: 0 }}>
          {l.kind === 'income' ? '+' : '−'}{fmt(simulationLineDisplayAmount(l, viewMode))}
        </div>
        {l.kind === 'expense' && (
          <PriorityBadge priority={l.priority ?? 'should'} onCycle={(next) => onSetPriority(l.id, next)} />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(l.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'grid', placeItems: 'center', padding: 4 }}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  )
}
