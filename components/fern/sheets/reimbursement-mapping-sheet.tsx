'use client'

import { useMemo, useState } from 'react'
import { Chip } from '../chip'
import { Icon } from '../icon'
import { SheetShell } from '../sheet-shell'
import { fmt, formatDate, type Transaction } from '@/lib/derive'
import { calculateReimbursementAllocations } from '@/lib/reimbursement-mapping'

export type ReimbursementMappingExpense = {
  id: string
  date: string
  amount: number
  categoryName: string | null
  merchantName: string | null
  manualSettlementAt: string | null
  applicableRate: number | null
  expectedAmount: number | null
  allocatedAmount: number
  remainingExpectedAmount: number | null
  allocations: { reimbursementTxId: string; amount: number }[]
}

interface ReimbursementMappingSheetProps {
  open: boolean
  onClose: () => void
  income: Transaction
  expenses: ReimbursementMappingExpense[]
  onSave: (expenseIds: string[]) => void
}

export function ReimbursementMappingSheet({
  open,
  onClose,
  income,
  expenses,
  onSave,
}: ReimbursementMappingSheetProps) {
  const eligibleExpenses = useMemo(
    () => expenses.filter((expense) =>
      expense.date <= income.date &&
      (
        !expense.manualSettlementAt ||
        expense.allocations.some((allocation) => allocation.reimbursementTxId === income.id)
      ),
    ),
    [expenses, income.date, income.id],
  )

  const savedExpenseIds = useMemo(
    () => eligibleExpenses
      .filter((expense) =>
        expense.allocations.some((allocation) => allocation.reimbursementTxId === income.id),
      )
      .map((expense) => expense.id),
    [eligibleExpenses, income.id],
  )

  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>(() => savedExpenseIds)

  const previewAllocations = useMemo(() => {
    const selectedIds = new Set(selectedExpenseIds)
    return calculateReimbursementAllocations(
      income,
      eligibleExpenses
        .filter((expense) => selectedIds.has(expense.id))
        .map((expense) => ({
          id: expense.id,
          date: expense.date,
          amount: expense.amount,
          expectedAmount: expense.expectedAmount,
          existingAllocations: expense.allocations
            .filter((allocation) => allocation.reimbursementTxId !== income.id)
            .map((allocation) => ({ amount: allocation.amount })),
        })),
      [],
    )
  }, [eligibleExpenses, income, selectedExpenseIds])

  const previewByExpenseId = useMemo(
    () => new Map(previewAllocations.map((allocation) => [allocation.expenseTxId, allocation.amount])),
    [previewAllocations],
  )
  const previewAllocatedAmount = previewAllocations.reduce(
    (sum, allocation) => sum + allocation.amount,
    0,
  )
  const selectedExpenseIdSet = new Set(selectedExpenseIds)
  const selectionChanged =
    savedExpenseIds.length !== selectedExpenseIds.length ||
    savedExpenseIds.some((expenseId) => !selectedExpenseIdSet.has(expenseId))
  const canSave = selectedExpenseIds.length > 0 || savedExpenseIds.length > 0

  const toggleExpense = (expenseId: string) => {
    setSelectedExpenseIds((current) =>
      current.includes(expenseId)
        ? current.filter((id) => id !== expenseId)
        : [...current, expenseId],
    )
  }

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      title="Map reimbursement"
      primary={{
        label: 'Save mapping',
        icon: 'check',
        onClick: () => {
          if (!canSave) return
          onSave(selectedExpenseIds)
          onClose()
        },
        disabled: !canSave,
        tone: 'teal',
      }}
    >
      <div style={{ background: 'var(--bg-sunken)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="bank" size={18} style={{ color: 'var(--teal-ink)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {income.note ?? 'Reimbursement income'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
            {formatDate(income.date)} · +{fmt(income.amount)}
          </div>
          {(selectedExpenseIds.length > 0 || savedExpenseIds.length > 0) && (
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>
              Preview: {fmt(previewAllocatedAmount)} allocated · {fmt(Math.max(0, Number(income.amount) - previewAllocatedAmount))} unallocated
              {selectionChanged ? ' · unsaved changes' : ''}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="fern-field-label wide">Eligible reimbursable expenses</label>
        {eligibleExpenses.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-faint)', padding: '18px 12px', background: 'var(--bg-sunken)', borderRadius: 10, textAlign: 'center' }}>
            No reimbursable expenses dated on or before this income.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {eligibleExpenses.map((expense) => {
              const disabled =
                expense.expectedAmount == null ||
                expense.remainingExpectedAmount == null
              const title = expense.merchantName ?? expense.categoryName ?? 'Reimbursable expense'
              const selected = selectedExpenseIds.includes(expense.id)
              const previewAmount = previewByExpenseId.get(expense.id) ?? 0
              const currentAllocations = expense.allocations
                .filter((allocation) => allocation.reimbursementTxId === income.id)
              const currentAllocationAmount = currentAllocations
                .reduce((sum, allocation) => sum + allocation.amount, 0)
              const otherAllocationAmount = expense.allocations
                .filter((allocation) => allocation.reimbursementTxId !== income.id)
                .reduce((sum, allocation) => sum + allocation.amount, 0)
              return (
                <button
                  key={expense.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleExpense(expense.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '12px',
                    borderRadius: 10,
                    border: selected ? '1.5px solid var(--teal)' : '1.5px solid var(--line)',
                    background: selected ? 'var(--teal-bg)' : 'var(--bg-elevated)',
                    opacity: disabled ? 0.55 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: selected ? 'none' : '1.5px solid var(--line)',
                      background: selected ? 'var(--teal)' : 'transparent',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {selected && <Icon name="check" size={11} style={{ color: '#fff' }} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {title}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                      {formatDate(expense.date)} · {expense.categoryName ?? 'Uncategorized'} · {fmt(expense.amount)}
                    </span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      <Chip tone="scheduled">
                        {expense.applicableRate == null ? 'No rate' : `${expense.applicableRate}%`}
                      </Chip>
                      {expense.manualSettlementAt && (
                        <Chip tone="recurring">
                          Manually settled
                        </Chip>
                      )}
                      <Chip tone="expense">
                        Expected {expense.expectedAmount == null ? '—' : fmt(expense.expectedAmount)}
                      </Chip>
                      <Chip tone="scheduled">
                        Allocated total {fmt(expense.allocatedAmount)}
                      </Chip>
                      <Chip tone="scheduled">
                        Other incomes {fmt(otherAllocationAmount)}
                      </Chip>
                      {currentAllocations.length > 0 && (
                        <Chip tone="income">
                          This mapping {fmt(currentAllocationAmount)}
                        </Chip>
                      )}
                      <Chip tone="recurring">
                        Remaining {expense.remainingExpectedAmount == null ? '—' : fmt(expense.remainingExpectedAmount)}
                      </Chip>
                      {selected && (
                        <Chip tone="income">
                          {previewAmount > 0 ? `Will allocate ${fmt(previewAmount)}` : 'Selected · no allocation'}
                        </Chip>
                      )}
                      {selected && currentAllocations.length > 0 && currentAllocationAmount === 0 && (
                        <Chip tone="scheduled">
                          Preserved selection
                        </Chip>
                      )}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </SheetShell>
  )
}
