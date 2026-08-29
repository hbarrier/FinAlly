import { describe, it, expect } from 'vitest'
import {
  getApplicableReimbursementRate,
  getExpectedReimbursementAmount,
  getRemainingExpectedReimbursement,
  getExpenseReimbursementStatus,
  getIncomeReimbursementStatus,
  calculateReimbursementAllocations,
} from './reimbursement-mapping'

const RATES = [
  { percent: 50, startDate: '2024-01-01' },
  { percent: 75, startDate: '2025-06-01' },
]

describe('getApplicableReimbursementRate', () => {
  it('picks the latest rate effective on or before the expense date', () => {
    expect(getApplicableReimbursementRate(RATES, '2025-01-01')?.percent).toBe(50)
    expect(getApplicableReimbursementRate(RATES, '2025-06-01')?.percent).toBe(75)
    expect(getApplicableReimbursementRate(RATES, '2023-01-01')).toBeNull()
  })
})

describe('getExpectedReimbursementAmount', () => {
  it('returns null when no rate applies', () => {
    expect(getExpectedReimbursementAmount({ amount: 100, date: '2023-01-01' }, RATES)).toBeNull()
  })

  it('keeps cents precision (75% of 12.40 = 9.30, not 9)', () => {
    expect(getExpectedReimbursementAmount({ amount: 12.4, date: '2025-07-01' }, RATES)).toBeCloseTo(9.3, 2)
  })

  it('rounds to the nearest cent', () => {
    // 33.33 * 50% = 16.665 -> 16.67
    expect(getExpectedReimbursementAmount({ amount: 33.33, date: '2025-01-01' }, RATES)).toBeCloseTo(16.67, 2)
  })
})

describe('getRemainingExpectedReimbursement', () => {
  it('is expected minus already-allocated, floored at 0', () => {
    const expense = { amount: 100, date: '2025-07-01' } // 75 expected
    expect(getRemainingExpectedReimbursement(expense, RATES, [{ amount: 30 }])).toBeCloseTo(45, 2)
    expect(getRemainingExpectedReimbursement(expense, RATES, [{ amount: 80 }])).toBe(0)
  })
})

describe('status helpers', () => {
  it('expense: manual settlement wins', () => {
    const e = { amount: 100, date: '2025-07-01', manualSettlementAt: '2025-08-01' }
    expect(getExpenseReimbursementStatus(e, RATES, [])).toBe('manually_settled')
  })

  it('expense: no rate -> no_rate', () => {
    expect(getExpenseReimbursementStatus({ amount: 100, date: '2020-01-01' }, RATES, [])).toBe('no_rate')
  })

  it('expense: covered -> reimbursed', () => {
    expect(getExpenseReimbursementStatus({ amount: 100, date: '2025-07-01' }, RATES, [{ amount: 75 }])).toBe('reimbursed')
  })

  it('income: partial vs full allocation', () => {
    expect(getIncomeReimbursementStatus({ amount: 100 }, [{ amount: 40 }])).toBe('partially_allocated')
    expect(getIncomeReimbursementStatus({ amount: 100 }, [{ amount: 100 }])).toBe('fully_allocated')
    expect(getIncomeReimbursementStatus({ amount: 100 }, [])).toBe('unmapped')
  })
})

describe('calculateReimbursementAllocations', () => {
  it('spreads income across expenses oldest-first, capped at each expense expectation', () => {
    const income = { amount: 100 }
    const expenses = [
      { id: 'b', amount: 40, date: '2025-07-10', existingAllocations: [] },
      { id: 'a', amount: 80, date: '2025-07-01', existingAllocations: [] },
    ]
    const result = calculateReimbursementAllocations(income, expenses, RATES)
    // oldest 'a' first: expected 60, gets 60; then 'b' expected 30, gets 30
    expect(result).toEqual([
      { expenseTxId: 'a', amount: 60 },
      { expenseTxId: 'b', amount: 30 },
    ])
  })

  it('stops when income runs out', () => {
    const income = { amount: 50 }
    const expenses = [{ id: 'a', amount: 80, date: '2025-07-01', existingAllocations: [] }]
    // expected 60, but only 50 income left
    expect(calculateReimbursementAllocations(income, expenses, RATES)).toEqual([{ expenseTxId: 'a', amount: 50 }])
  })
})
