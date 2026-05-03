'use client'

import { useMemo, useState, useTransition } from 'react'
import { Chip } from '@/components/fern/chip'
import { Icon } from '@/components/fern/icon'
import {
  ReimbursementMappingSheet,
  type ReimbursementMappingExpense,
} from '@/components/fern/sheets/reimbursement-mapping-sheet'
import { fmt, formatDate } from '@/lib/derive'
import type { ReimbursementRate as Rate, Transaction } from '@/lib/db-types'
import {
  addReimbursementRate,
  deleteReimbursementRate,
  mapReimbursementIncomeToExpenses,
  setExpenseManualSettlement,
  updateReimbursementRate,
} from '@/lib/actions/reimbursements'

type IncomeStatus = 'unmapped' | 'partially_allocated' | 'fully_allocated'
type ExpenseStatus =
  | 'not_reimbursed'
  | 'partially_reimbursed'
  | 'reimbursed'
  | 'manually_settled'
  | 'no_rate'

type IncomeReviewItem = Pick<Transaction, 'id' | 'date' | 'amount' | 'note' | 'method' | 'createdAt'> & {
  allocatedAmount: number
  unallocatedAmount: number
  status: IncomeStatus
  label: string
}

type ExpenseReviewItem = {
  id: string
  date: string
  amount: number
  merchantName: string | null
  categoryName: string | null
  manualSettlementAt: string | null
  expectedAmount: number | null
  allocatedAmount: number
  remainingExpectedAmount: number | null
  status: ExpenseStatus
  label: string
}

interface Props {
  incomes: IncomeReviewItem[]
  expenses: ExpenseReviewItem[]
  mappingExpenses: ReimbursementMappingExpense[]
  rates: Rate[]
}

const INCOME_GROUPS: { status: IncomeStatus; title: string; tone: 'scheduled' | 'recurring' }[] = [
  { status: 'unmapped', title: 'Unmapped income', tone: 'scheduled' },
  { status: 'partially_allocated', title: 'Partially allocated income', tone: 'scheduled' },
  { status: 'fully_allocated', title: 'Fully allocated income', tone: 'recurring' },
]

const EXPENSE_GROUPS: { status: ExpenseStatus; title: string; tone: 'scheduled' | 'recurring' | 'expense' }[] = [
  { status: 'not_reimbursed', title: 'Not reimbursed', tone: 'expense' },
  { status: 'partially_reimbursed', title: 'Partially reimbursed', tone: 'scheduled' },
  { status: 'no_rate', title: 'Missing rate', tone: 'scheduled' },
  { status: 'reimbursed', title: 'Reimbursed', tone: 'recurring' },
  { status: 'manually_settled', title: 'Manually settled', tone: 'recurring' },
]

export function ReimbursementsClient({ incomes, expenses, mappingExpenses, rates }: Props) {
  const [, startTransition] = useTransition()
  const [mappingIncome, setMappingIncome] = useState<IncomeReviewItem | null>(null)

  const [showRateForm, setShowRateForm] = useState(false)
  const [ratePercent, setRatePercent] = useState('')
  const [rateDate, setRateDate] = useState(new Date().toISOString().slice(0, 10))
  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [editPercent, setEditPercent] = useState('')
  const [editDate, setEditDate] = useState('')

  const incomeByStatus = useMemo(
    () => groupByStatus(incomes),
    [incomes],
  )
  const expensesByStatus = useMemo(
    () => groupByStatus(expenses),
    [expenses],
  )

  const unresolvedIncomeCount =
    (incomeByStatus.unmapped?.length ?? 0) +
    (incomeByStatus.partially_allocated?.length ?? 0)
  const unresolvedExpenseCount =
    (expensesByStatus.not_reimbursed?.length ?? 0) +
    (expensesByStatus.partially_reimbursed?.length ?? 0) +
    (expensesByStatus.no_rate?.length ?? 0)

  const currentRate = rates[0] ?? null

  const handleSaveMapping = (expenseIds: string[]) => {
    if (!mappingIncome) return
    startTransition(async () => {
      await mapReimbursementIncomeToExpenses(mappingIncome.id, expenseIds)
    })
  }

  const handleToggleManualSettlement = (expense: ExpenseReviewItem) => {
    startTransition(async () => {
      await setExpenseManualSettlement(expense.id, expense.status !== 'manually_settled')
    })
  }

  const handleAddRate = () => {
    const pct = Number(ratePercent.replace(',', '.'))
    if (!pct || !rateDate) return
    startTransition(async () => {
      await addReimbursementRate(pct, rateDate)
    })
    setShowRateForm(false)
    setRatePercent('')
    setRateDate(new Date().toISOString().slice(0, 10))
  }

  const handleStartEditRate = (rate: Rate) => {
    setEditingRateId(rate.id)
    setEditPercent(String(rate.percent))
    setEditDate(rate.startDate)
    setShowRateForm(false)
  }

  const handleSaveEditRate = () => {
    if (!editingRateId) return
    const pct = Number(editPercent.replace(',', '.'))
    if (!pct || !editDate) return
    startTransition(async () => {
      await updateReimbursementRate(editingRateId, pct, editDate)
    })
    setEditingRateId(null)
  }

  const handleDeleteRate = (id: string) => {
    startTransition(async () => {
      await deleteReimbursementRate(id)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '32px 0' }}>
      <header style={{ display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono-fern)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal-ink)', fontWeight: 700 }}>
            Reimbursement review
          </div>
          <h1 style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 700, color: 'var(--ink)', margin: '6px 0 0' }}>
            Allocate income, close expenses.
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '8px 0 0', maxWidth: 620 }}>
            Review recorded reimbursement income and reimbursable expenses without using the old expense-driven creation flow.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <MetricCard label="Income to allocate" value={unresolvedIncomeCount} tone="teal" />
          <MetricCard label="Expenses to review" value={unresolvedExpenseCount} tone="rose" />
          <MetricCard label="Manual closures" value={expensesByStatus.manually_settled?.length ?? 0} tone="sage" />
        </div>
      </header>

      <section>
        <SectionHeader
          title="Reimbursement income"
          description="Unmapped and partial income are the main allocation queue."
        />
        <div style={{ display: 'grid', gap: 12 }}>
          {INCOME_GROUPS.map((group) => (
            <ReviewGroup
              key={group.status}
              title={group.title}
              count={incomeByStatus[group.status]?.length ?? 0}
              tone={group.tone}
            >
              {(incomeByStatus[group.status] ?? []).map((income) => (
                <IncomeCard
                  key={income.id}
                  income={income}
                  onMap={() => setMappingIncome(income)}
                />
              ))}
            </ReviewGroup>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Reimbursable expenses"
          description="Manual settlements are tracked separately from unresolved reimbursement work."
        />
        <div style={{ display: 'grid', gap: 12 }}>
          {EXPENSE_GROUPS.map((group) => (
            <ReviewGroup
              key={group.status}
              title={group.title}
              count={expensesByStatus[group.status]?.length ?? 0}
              tone={group.tone}
            >
              {(expensesByStatus[group.status] ?? []).map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  onToggleManualSettlement={() => handleToggleManualSettlement(expense)}
                />
              ))}
            </ReviewGroup>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Reimbursement rates"
          description="Expected reimbursement still follows the active rate for each expense date."
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            {rates.length} configured rate{rates.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => { setShowRateForm((v) => !v); setEditingRateId(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--terracotta-ink)', background: 'var(--terracotta-bg)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
          >
            <Icon name="plus" size={12} /> New rate
          </button>
        </div>

        {showRateForm && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <RateInput label="Rate (%)" value={ratePercent} onChange={setRatePercent} />
            <RateDateInput label="Starts on" value={rateDate} onChange={setRateDate} />
            <button type="button" onClick={handleAddRate} style={{ background: 'var(--terracotta)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Add
            </button>
            <button type="button" onClick={() => setShowRateForm(false)} style={{ background: 'var(--bg-sunken)', color: 'var(--ink-soft)', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}

        {currentRate ? (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, overflow: 'hidden' }}>
            {rates.map((rate, index) => (
              editingRateId === rate.id ? (
                <RateEditRow
                  key={rate.id}
                  percent={editPercent}
                  date={editDate}
                  onPercentChange={setEditPercent}
                  onDateChange={setEditDate}
                  onSave={handleSaveEditRate}
                  onCancel={() => setEditingRateId(null)}
                />
              ) : (
                <div key={rate.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: index === 0 ? '14px 16px' : '10px 16px', borderBottom: index < rates.length - 1 ? '1px solid var(--line)' : undefined }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{index === 0 ? 'Current rate' : 'Historical rate'}</div>
                    <div style={{ fontSize: index === 0 ? 22 : 14, fontWeight: 700, color: index === 0 ? 'var(--teal-ink)' : 'var(--ink)' }}>
                      {rate.percent}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>from {formatDate(rate.startDate)}</span>
                    <button type="button" onClick={() => handleStartEditRate(rate)} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 4 }} title="Edit">
                      <Icon name="edit" size={14} />
                    </button>
                    {index > 0 && (
                      <button type="button" onClick={() => handleDeleteRate(rate.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 4 }} title="Delete">
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        ) : (
          <EmptyPanel message="No reimbursement rate configured yet." />
        )}
      </section>

      {mappingIncome && (
        <ReimbursementMappingSheet
          key={mappingIncome.id}
          open={mappingIncome != null}
          onClose={() => setMappingIncome(null)}
          income={{
            id: mappingIncome.id,
            date: mappingIncome.date,
            amount: mappingIncome.amount,
            kind: 'income',
            method: mappingIncome.method,
            categoryId: null,
            merchantId: null,
            note: mappingIncome.note,
            recurringId: null,
            recurringAmountId: null,
            reimbursable: 0,
            reimbursementTxId: null,
            cleared: 0,
            claimedDate: null,
            manualSettlementAt: null,
            createdAt: mappingIncome.createdAt ?? '',
          }}
          expenses={mappingExpenses}
          onSave={handleSaveMapping}
        />
      )}
    </div>
  )
}

function groupByStatus<T extends { status: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    groups[item.status] = groups[item.status] ?? []
    groups[item.status].push(item)
    return groups
  }, {})
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'teal' | 'rose' | 'sage' }) {
  const color = tone === 'teal' ? 'var(--teal-ink)' : tone === 'rose' ? 'var(--rose-ink)' : 'var(--sage-ink)'
  const bg = tone === 'teal' ? 'var(--teal-bg)' : tone === 'rose' ? 'var(--rose-bg)' : 'var(--sage-bg)'
  return (
    <div style={{ background: bg, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '3px 0 0' }}>{description}</p>
    </div>
  )
}

function ReviewGroup({
  title,
  count,
  tone,
  children,
}: {
  title: string
  count: number
  tone: 'scheduled' | 'recurring' | 'expense'
  children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--line-soft)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
        <Chip tone={tone}>{count}</Chip>
      </div>
      {count === 0 ? (
        <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--ink-faint)' }}>Nothing here.</div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  )
}

function IncomeCard({ income, onMap }: { income: IncomeReviewItem; onMap: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{income.note ?? 'Reimbursement income'}</strong>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{formatDate(income.date)}</span>
          <Chip tone={income.status === 'fully_allocated' ? 'recurring' : 'scheduled'}>{income.label}</Chip>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>
          Allocated {fmt(income.allocatedAmount)} · Unallocated {fmt(income.unallocatedAmount)}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sage-ink)', fontFamily: 'var(--mono-fern)' }}>
        +{fmt(income.amount)}
      </div>
      <button type="button" onClick={onMap} style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, border: 'none', color: 'var(--teal-ink)', background: 'var(--teal-bg)', cursor: 'pointer' }} title="Map reimbursement">
        <Icon name="bank" size={14} />
      </button>
    </div>
  )
}

function ExpenseCard({
  expense,
  onToggleManualSettlement,
}: {
  expense: ExpenseReviewItem
  onToggleManualSettlement: () => void
}) {
  const isManuallySettled = expense.status === 'manually_settled'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{expense.merchantName ?? expense.categoryName ?? 'Reimbursable expense'}</strong>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{formatDate(expense.date)}</span>
          <Chip tone={expense.status === 'reimbursed' || expense.status === 'manually_settled' ? 'recurring' : 'scheduled'}>{expense.label}</Chip>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>
          Expected {expense.expectedAmount == null ? '—' : fmt(expense.expectedAmount)}
          {' '}· Allocated {fmt(expense.allocatedAmount)}
          {' '}· Remaining {expense.remainingExpectedAmount == null ? '—' : fmt(expense.remainingExpectedAmount)}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--rose-ink)', fontFamily: 'var(--mono-fern)' }}>
        -{fmt(expense.amount)}
      </div>
      <button
        type="button"
        onClick={onToggleManualSettlement}
        style={{
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          width: 28,
          height: 28,
          borderRadius: 8,
          border: isManuallySettled ? 'none' : '1.5px solid var(--line)',
          color: isManuallySettled ? 'var(--sage-ink)' : 'var(--ink-faint)',
          background: isManuallySettled ? 'var(--sage-bg)' : 'transparent',
          cursor: 'pointer',
        }}
        title={isManuallySettled ? 'Clear manual settlement' : 'Manually settle'}
      >
        <Icon name={isManuallySettled ? 'x' : 'check'} size={14} />
      </button>
    </div>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '20px 16px', color: 'var(--ink-soft)', fontSize: 13, textAlign: 'center' }}>
      {message}
    </div>
  )
}

function RateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ flex: '1 1 160px' }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input className="fern-input" placeholder="ex: 75" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function RateDateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ flex: '1 1 180px' }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input className="fern-input" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function RateEditRow({
  percent,
  date,
  onPercentChange,
  onDateChange,
  onSave,
  onCancel,
}: {
  percent: string
  date: string
  onPercentChange: (value: string) => void
  onDateChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <RateInput label="Rate (%)" value={percent} onChange={onPercentChange} />
      <RateDateInput label="Starts on" value={date} onChange={onDateChange} />
      <button type="button" onClick={onSave} style={{ background: 'var(--teal)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', height: 38 }}>
        <Icon name="check" size={14} />
      </button>
      <button type="button" onClick={onCancel} style={{ background: 'var(--bg-sunken)', color: 'var(--ink-soft)', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', height: 38 }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}
