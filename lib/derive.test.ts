import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  effectiveAmount,
  monthTransactions,
  thisMonthTransactions,
  isPlannedDate,
  completeMonthsWindow,
  sumByKind,
  spendingByCategory,
  monthlyEstimate,
  resolvedDayOfMonth,
  thisMonthRecurring,
  recurringExpensesByCategory,
  roundToTen,
  budgetLineMonthly,
  budgetCategoryMonthly,
  monthActualByCategory,
  simulationTotals,
  simulationLineDisplayAmount,
  groupTransactionsByMonth,
  currentBalance,
  creditSignedAmount,
  savingAccountBalance,
  fmt,
  fmtShort,
  splitCents,
} from './derive'
import type {
  Category, Transaction, RecurringAmount, Recurring, RecurringInstance, SimulationLine,
} from './db-types'

/** Minimal row factories — derive functions only touch a handful of fields. */
const txn = (o: Partial<Transaction>): Transaction =>
  ({
    id: 't', date: '2026-01-01', amount: 0, kind: 'expense', method: 'card',
    categoryId: null, merchantId: null, note: null, recurringId: null,
    recurringAmountId: null, reimbursable: 0, reimbursementTxId: null,
    reimbursementAmountOverride: null, reimbursementComment: null, cleared: 0,
    claimedDate: null, manualSettlementAt: null, createdAt: '2026-01-01T00:00:00Z',
    ...o,
  }) as Transaction

const cat = (o: Partial<Category>): Category =>
  ({
    id: 'c', name: 'Cat', icon: 'tag', color: 'teal', kind: 'expense',
    isPensionAlimentaire: 0, isActive: 1, createdAt: '2026-01-01T00:00:00Z',
    ...o,
  }) as Category

const amount = (o: Partial<RecurringAmount>): RecurringAmount =>
  ({ id: 'a', recurringId: 'r', amount: 0, startDate: '2026-01-01', ...o }) as RecurringAmount

describe('effectiveAmount', () => {
  it('returns 0 for an empty history', () => {
    expect(effectiveAmount([])).toBe(0)
  })

  it('picks the latest entry whose startDate is on or before the reference date', () => {
    const history = [
      amount({ amount: 10, startDate: '2025-01-01' }),
      amount({ amount: 20, startDate: '2025-06-01' }),
      amount({ amount: 30, startDate: '2026-01-01' }),
    ]
    expect(effectiveAmount(history, new Date('2025-07-15'))).toBe(20)
    expect(effectiveAmount(history, new Date('2026-02-01'))).toBe(30)
  })

  it('falls back to the earliest entry when the reference date precedes all of them', () => {
    const history = [
      amount({ amount: 30, startDate: '2026-01-01' }),
      amount({ amount: 10, startDate: '2025-01-01' }),
    ]
    expect(effectiveAmount(history, new Date('2024-01-01'))).toBe(10)
  })
})

describe('monthTransactions / thisMonthTransactions', () => {
  const rows = [
    txn({ id: 'a', date: '2026-01-05' }),
    txn({ id: 'b', date: '2026-01-31' }),
    txn({ id: 'c', date: '2026-02-01' }),
  ]

  it('filters to the requested YYYY-MM', () => {
    expect(monthTransactions(rows, '2026-01').map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('thisMonthTransactions uses the reference date month', () => {
    expect(thisMonthTransactions(rows, new Date('2026-02-15')).map((t) => t.id)).toEqual(['c'])
  })
})

describe('isPlannedDate', () => {
  it('is true only for dates strictly after the reference day', () => {
    const ref = new Date('2026-01-15T12:00:00Z')
    expect(isPlannedDate('2026-01-16', ref)).toBe(true)
    expect(isPlannedDate('2026-01-15', ref)).toBe(false)
    expect(isPlannedDate('2026-01-14', ref)).toBe(false)
  })

  it('uses the local calendar day, not UTC (suite TZ = America/New_York)', () => {
    // 2026-01-16T02:00Z is still 2026-01-15 21:00 EST.
    const ref = new Date('2026-01-16T02:00:00Z')
    expect(isPlannedDate('2026-01-16', ref)).toBe(true) // tomorrow, locally
    expect(isPlannedDate('2026-01-15', ref)).toBe(false) // today, locally
  })
})

describe('thisMonthTransactions (local basis)', () => {
  afterEach(() => vi.useRealTimers())

  it('bins by the local month even near a UTC boundary', () => {
    vi.setSystemTime(new Date('2026-02-01T02:00:00Z')) // 2026-01-31 21:00 EST
    const rows = [txn({ id: 'jan', date: '2026-01-31' }), txn({ id: 'feb', date: '2026-02-01' })]
    expect(thisMonthTransactions(rows).map((t) => t.id)).toEqual(['jan'])
  })
})

describe('completeMonthsWindow', () => {
  it('spans the N complete calendar months before the current month', () => {
    const w = completeMonthsWindow(3, new Date('2026-04-20'))
    expect(w).toEqual({ start: '2026-01-01', endExclusive: '2026-04-01' })
  })

  it('crosses a year boundary', () => {
    const w = completeMonthsWindow(2, new Date('2026-01-10'))
    expect(w).toEqual({ start: '2025-11-01', endExclusive: '2026-01-01' })
  })
})

describe('sumByKind', () => {
  it('sums only the requested kind', () => {
    const rows = [
      txn({ amount: 100, kind: 'income' }),
      txn({ amount: 40, kind: 'expense' }),
      txn({ amount: 60, kind: 'expense' }),
    ]
    expect(sumByKind(rows, 'income')).toBe(100)
    expect(sumByKind(rows, 'expense')).toBe(100)
  })
})

describe('spendingByCategory', () => {
  it('aggregates expense amounts per category, sorted descending, with fallbacks', () => {
    const cats = [cat({ id: 'food', name: 'Food', color: 'sage', icon: 'fork' })]
    const rows = [
      txn({ amount: 30, categoryId: 'food' }),
      txn({ amount: 20, categoryId: 'food' }),
      txn({ amount: 5, categoryId: 'missing' }),
      txn({ amount: 999, categoryId: 'food', kind: 'income' }),
    ]
    const result = spendingByCategory(rows, cats)
    expect(result).toEqual([
      { id: 'food', amount: 50, name: 'Food', color: 'sage', icon: 'fork' },
      { id: 'missing', amount: 5, name: 'Uncategorized', color: 'teal', icon: 'tag' },
    ])
  })
})

describe('monthlyEstimate', () => {
  it('amortizes yearly cadence to 1/12', () => {
    expect(monthlyEstimate({ amount: 120, cadence: 'yearly', endDate: null } as Recurring)).toBe(10)
  })

  it('returns 0 once the end date has passed', () => {
    const r = { amount: 50, cadence: 'monthly', endDate: '2025-12-31' } as Recurring
    expect(monthlyEstimate(r, new Date('2026-02-01'))).toBe(0)
  })
})

describe('resolvedDayOfMonth', () => {
  it('passes positive days through when the month is long enough', () => {
    expect(resolvedDayOfMonth(15, new Date('2026-02-10'))).toBe(15)
  })

  it('clamps a day past the end of a short month (31 -> 30 in April, 28 in Feb)', () => {
    expect(resolvedDayOfMonth(31, new Date('2026-04-10'))).toBe(30)
    expect(resolvedDayOfMonth(31, new Date('2026-02-10'))).toBe(28)
    expect(resolvedDayOfMonth(29, new Date('2026-02-10'))).toBe(28)
  })

  it('counts negative days back from the end of the month', () => {
    // -1 => last day; February 2026 has 28 days
    expect(resolvedDayOfMonth(-1, new Date('2026-02-10'))).toBe(28)
  })
})

describe('recurringExpensesByCategory', () => {
  const rec = (o: Partial<Recurring>): Recurring =>
    ({
      id: 'r', name: 'Bill', amount: 0, kind: 'expense', method: 'card',
      categoryId: 'c1', merchantId: null, cadence: 'monthly', dayOfMonth: 1,
      startDate: '2020-01-01', endDate: null, monthRules: null, ...o,
    }) as Recurring
  const inst = (o: Partial<RecurringInstance>): RecurringInstance =>
    ({ id: 'i', recurringId: 'r', month: '2026-03', status: 'expected', transactionId: null, ...o }) as RecurringInstance
  const cats = [cat({ id: 'c1', name: 'Insurance' })]

  it('excludes a yearly bill entirely when "+ Yearly" is off (no full lump)', () => {
    const groups = recurringExpensesByCategory(
      [rec({ id: 'y', cadence: 'yearly', amount: 1200 })],
      cats,
      [inst({ id: 'i1', recurringId: 'y' })],
      [],
      '2026-03',
      false,
    )
    expect(groups).toHaveLength(0)
  })

  it('folds a recently-paid yearly bill in at 1/12 when "+ Yearly" is on', () => {
    const groups = recurringExpensesByCategory(
      [rec({ id: 'y', cadence: 'yearly', amount: 1200 })],
      cats,
      [inst({ id: 'i1', recurringId: 'y' })],
      [txn({ id: 'p', recurringId: 'y', kind: 'expense', date: '2026-03-02', amount: 1200 })],
      '2026-03',
      true,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].total).toBeCloseTo(100, 2)
    expect(groups[0].amortized).toBeCloseTo(100, 2)
  })

  it('counts a monthly bill at face value', () => {
    const groups = recurringExpensesByCategory(
      [rec({ id: 'm', amount: 40 })],
      cats,
      [inst({ id: 'i1', recurringId: 'm' })],
      [],
      '2026-03',
      false,
    )
    expect(groups[0].total).toBe(40)
  })
})

describe('thisMonthRecurring', () => {
  const rec = (o: Partial<Recurring>): Recurring =>
    ({
      id: 'r', name: 'Bill', amount: 50, kind: 'expense', method: 'card',
      categoryId: null, merchantId: null, cadence: 'monthly', dayOfMonth: 1,
      startDate: '2020-01-01', endDate: null, monthRules: null,
      ...o,
    }) as Recurring

  it('still fires a day-31 monthly bill in a 30-day month', () => {
    const out = thisMonthRecurring([rec({ dayOfMonth: 31 })], new Date('2026-04-15'))
    expect(out).toHaveLength(1)
    expect(out[0].date.getDate()).toBe(30)
  })

  it('includes earlier-in-month occurrences that have already passed', () => {
    const out = thisMonthRecurring([rec({ dayOfMonth: 3 })], new Date('2026-04-20'))
    expect(out.map((o) => o.date.getDate())).toEqual([3])
  })

  it('excludes items whose end date is before the month', () => {
    const out = thisMonthRecurring([rec({ dayOfMonth: 10, endDate: '2026-03-01' })], new Date('2026-04-20'))
    expect(out).toHaveLength(0)
  })
})

describe('roundToTen', () => {
  it('rounds to the nearest 10', () => {
    expect(roundToTen(114)).toBe(110)
    expect(roundToTen(115)).toBe(120)
  })
})

describe('budgetLineMonthly / budgetCategoryMonthly', () => {
  it('monthly lines count at face value', () => {
    expect(budgetLineMonthly({ amount: 40, frequency: 'monthly' }, false)).toBe(40)
  })

  it('yearly lines amortize only when includeYearly is true', () => {
    expect(budgetLineMonthly({ amount: 120, frequency: 'yearly' }, true)).toBe(10)
    expect(budgetLineMonthly({ amount: 120, frequency: 'yearly' }, false)).toBe(0)
  })

  it('sums a category across its lines', () => {
    const lines = [
      { id: '1', name: null, kind: 'expense' as const, categoryId: 'x', merchantId: null, amount: 30, frequency: 'monthly' as const, recurring: 0 },
      { id: '2', name: null, kind: 'expense' as const, categoryId: 'x', merchantId: null, amount: 120, frequency: 'yearly' as const, recurring: 0 },
      { id: '3', name: null, kind: 'expense' as const, categoryId: 'y', merchantId: null, amount: 99, frequency: 'monthly' as const, recurring: 0 },
    ]
    expect(budgetCategoryMonthly(lines, 'x', true)).toBe(40)
  })
})

describe('monthActualByCategory', () => {
  it('sums non-planned actuals per category for one kind', () => {
    const ref = new Date('2026-01-20T12:00:00Z')
    const rows = [
      txn({ amount: 10, categoryId: 'a', date: '2026-01-05' }),
      txn({ amount: 15, categoryId: 'a', date: '2026-01-10' }),
      txn({ amount: 99, categoryId: 'a', date: '2026-01-28' }), // planned - excluded
      txn({ amount: 7, categoryId: 'b', date: '2026-01-02' }),
      txn({ amount: 5, categoryId: 'a', date: '2026-02-01' }), // other month
    ]
    expect(monthActualByCategory(rows, '2026-01', 'expense', ref)).toEqual({ a: 25, b: 7 })
  })
})

describe('simulationTotals', () => {
  const line = (o: Partial<SimulationLine>): SimulationLine =>
    ({
      id: 'l', simulationId: 's', name: null, kind: 'expense', categoryId: null,
      merchantId: null, amount: 0, frequency: 'monthly', sourceRecurringId: null,
      rollup: 0, origin: 'manual', priority: 'should', excludedTxnIds: null,
      avgMonths: null, amountManual: 0, ...o,
    }) as SimulationLine

  it('monthly view ignores yearly lines', () => {
    const lines = [line({ kind: 'income', amount: 1000 }), line({ kind: 'expense', amount: 600, frequency: 'yearly' })]
    expect(simulationTotals(lines, 'monthly')).toEqual({ income: 1000, expense: 0 })
  })

  it('yearly view multiplies monthly lines by 12', () => {
    const lines = [line({ kind: 'income', amount: 1000 }), line({ kind: 'expense', amount: 600, frequency: 'yearly' })]
    expect(simulationTotals(lines, 'yearly')).toEqual({ income: 12000, expense: 600 })
  })

  it('simulationLineDisplayAmount converts between views', () => {
    expect(simulationLineDisplayAmount(line({ amount: 120, frequency: 'yearly' }), 'monthly')).toBe(10)
    expect(simulationLineDisplayAmount(line({ amount: 50, frequency: 'monthly' }), 'yearly')).toBe(600)
  })
})

describe('groupTransactionsByMonth', () => {
  it('groups by month newest-first with per-month totals', () => {
    const rows = [
      txn({ id: 'a', date: '2026-01-10', amount: 10 }),
      txn({ id: 'b', date: '2026-02-05', amount: 20 }),
      txn({ id: 'c', date: '2026-01-20', amount: 5 }),
    ]
    const groups = groupTransactionsByMonth(rows)
    expect(groups.map((g) => g.month)).toEqual(['2026-02', '2026-01'])
    expect(groups[1].total).toBe(15)
    expect(groups[1].txns.map((t) => t.id)).toEqual(['c', 'a'])
  })
})

describe('currentBalance', () => {
  it('applies income as +, expense as -', () => {
    const rows = [
      txn({ amount: 1000, kind: 'income' }),
      txn({ amount: 250, kind: 'expense' }),
    ]
    expect(currentBalance(500, rows)).toBe(1250)
  })

  it('applies saving transfers only through their credit endpoint', () => {
    const rows = [
      txn({ amount: 200, kind: 'saving', sourceSavingAccountId: null, destSavingAccountId: 'A' }), // credit -> A: -200
      txn({ amount: 50, kind: 'saving', sourceSavingAccountId: 'A', destSavingAccountId: null }), //  A -> credit: +50
      txn({ amount: 30, kind: 'saving', sourceSavingAccountId: 'A', destSavingAccountId: 'B' }), //   A -> B: 0
    ]
    expect(currentBalance(1000, rows)).toBe(850)
  })
})

describe('creditSignedAmount', () => {
  it('signs each movement kind for the credit account', () => {
    expect(creditSignedAmount({ kind: 'income', amount: 100 })).toBe(100)
    expect(creditSignedAmount({ kind: 'expense', amount: 100 })).toBe(-100)
    expect(creditSignedAmount({ kind: 'saving', amount: 100, sourceSavingAccountId: null, destSavingAccountId: 'A' })).toBe(-100)
    expect(creditSignedAmount({ kind: 'saving', amount: 100, sourceSavingAccountId: 'A', destSavingAccountId: null })).toBe(100)
    expect(creditSignedAmount({ kind: 'saving', amount: 100, sourceSavingAccountId: 'A', destSavingAccountId: 'B' })).toBe(0)
  })

  it('never touches the credit account for interest', () => {
    expect(creditSignedAmount({ kind: 'interest', amount: 100, sourceSavingAccountId: null, destSavingAccountId: 'A' })).toBe(0)
  })
})

describe('savingAccountBalance', () => {
  it('adds inbound transfers and subtracts outbound ones', () => {
    const rows = [
      txn({ amount: 200, kind: 'saving', sourceSavingAccountId: null, destSavingAccountId: 'A' }),
      txn({ amount: 50, kind: 'saving', sourceSavingAccountId: 'A', destSavingAccountId: null }),
      txn({ amount: 30, kind: 'saving', sourceSavingAccountId: 'B', destSavingAccountId: 'A' }),
      txn({ amount: 999, kind: 'expense' }),
    ]
    expect(savingAccountBalance(1000, rows, 'A')).toBe(1180)
  })

  it('adds interest credited to the account and ignores interest credited elsewhere', () => {
    const rows = [
      txn({ amount: 200, kind: 'saving', sourceSavingAccountId: null, destSavingAccountId: 'A' }),
      txn({ amount: 5, kind: 'interest', sourceSavingAccountId: null, destSavingAccountId: 'A' }),
      txn({ amount: 3, kind: 'interest', sourceSavingAccountId: null, destSavingAccountId: 'B' }),
    ]
    expect(savingAccountBalance(1000, rows, 'A')).toBe(1205)
  })
})

describe('formatting', () => {
  it('fmt renders a euro amount with a real minus sign', () => {
    expect(fmt(1234.5)).toBe('€1.234,50')
    expect(fmt(-1234.5)).toBe('−€1.234,50')
    expect(fmt(0, { noSymbol: true })).toBe('0,00')
  })

  it('fmtShort abbreviates thousands', () => {
    expect(fmtShort(2500)).toBe('€2.5k')
    expect(fmtShort(20000)).toBe('€20k')
    expect(fmtShort(400)).toBe('€400')
  })

  it('splitCents separates whole and cents', () => {
    expect(splitCents(1234.5)).toEqual({ sign: '', whole: '1.234', cents: '50' })
    expect(splitCents(-9.05)).toEqual({ sign: '−', whole: '9', cents: '05' })
  })

  it('splitCents carries into the whole part instead of rendering ,100', () => {
    expect(splitCents(2.999)).toEqual({ sign: '', whole: '3', cents: '00' })
    expect(splitCents(0.999)).toEqual({ sign: '', whole: '1', cents: '00' })
  })
})
