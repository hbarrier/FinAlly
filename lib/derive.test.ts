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
  budgetWaterfall,
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
import { setFormatConfig } from './format-config'
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
      { id: '1', name: null, kind: 'expense' as const, categoryId: 'x', merchantId: null, amount: 30, frequency: 'monthly' as const, recurring: 0, sourceRecurringId: null },
      { id: '2', name: null, kind: 'expense' as const, categoryId: 'x', merchantId: null, amount: 120, frequency: 'yearly' as const, recurring: 0, sourceRecurringId: null },
      { id: '3', name: null, kind: 'expense' as const, categoryId: 'y', merchantId: null, amount: 99, frequency: 'monthly' as const, recurring: 0, sourceRecurringId: null },
    ]
    expect(budgetCategoryMonthly(lines, 'x', true)).toBe(40)
  })
})

describe('budgetWaterfall', () => {
  const cat = (o: Partial<Category>): Category =>
    ({
      id: 'c', name: 'Cat', icon: 'tag', color: 'teal', kind: 'expense',
      isPensionAlimentaire: 0, isSavings: 0, isActive: 1, createdAt: '2026-01-01T00:00:00Z',
      ...o,
    }) as Category

  const line = (o: Partial<{
    id: string; name: string | null; kind: 'expense' | 'income'; categoryId: string
    merchantId: string | null; amount: number; frequency: 'monthly' | 'yearly'
    recurring: number; sourceRecurringId: string | null
  }>) => ({
    id: 'l', name: null, kind: 'expense' as const, categoryId: 'c', merchantId: null,
    amount: 0, frequency: 'monthly' as const, recurring: 0, sourceRecurringId: null,
    ...o,
  })

  const atxn = (o: Partial<{
    id: string; date: string; amount: number; kind: 'expense' | 'income'
    categoryId: string; merchantId: string | null; recurringId: string | null
  }>) => ({
    id: 't', date: '2026-01-01', amount: 0, kind: 'expense' as const, categoryId: 'c',
    merchantId: null, recurringId: null,
    ...o,
  })

  it('never leaks a recurring-linked line\'s transactions into the category generic-line remainder (Transport case)', () => {
    const categories = [cat({ id: 'transport' })]
    const lines = [
      line({ id: 'assurance', categoryId: 'transport', frequency: 'monthly', recurring: 1, sourceRecurringId: 'rec-assurance', amount: 50 }),
      line({ id: 'other-transport', categoryId: 'transport', frequency: 'yearly', amount: 1500 }),
    ]
    const txns = [
      atxn({ id: 't1', date: '2026-09-05', amount: 50.66, categoryId: 'transport', recurringId: 'rec-assurance' }),
      atxn({ id: 't2', date: '2026-03-12', amount: 50.66, categoryId: 'transport', recurringId: 'rec-assurance' }),
      atxn({ id: 't3', date: '2026-06-01', amount: 80, categoryId: 'transport', merchantId: 'parking' }),
    ]
    const { monthly, yearly } = budgetWaterfall(lines, txns, categories, '2025-10', '2026-09')

    const monthlyAssurance = monthly.categories.find((c) => c.category.id === 'transport')?.lines.find((l) => l.line.id === 'assurance')
    expect(monthlyAssurance?.tier).toBe('recurring')
    expect(monthlyAssurance?.actual).toBe(50.66) // only the current-month (t1) instance

    const yearlyTransport = yearly.categories.find((c) => c.category.id === 'transport')
    expect(yearlyTransport?.actual).toBe(80) // ad-hoc only — neither Assurance Auto txn leaks in
    expect(yearlyTransport?.lines.find((l) => l.line.id === 'other-transport')?.actual).toBe(80)
  })

  it('marks a generic-tier line ambiguous when 0 or 2+ generic lines share a category/frequency', () => {
    const categories = [cat({ id: 'misc' })]
    const lines = [
      line({ id: 'g1', categoryId: 'misc', frequency: 'yearly', amount: 100 }),
      line({ id: 'g2', categoryId: 'misc', frequency: 'yearly', amount: 50 }),
    ]
    const txns = [atxn({ id: 't1', date: '2026-05-01', amount: 30, categoryId: 'misc' })]
    const { yearly } = budgetWaterfall(lines, txns, categories, '2025-10', '2026-09')
    const misc = yearly.categories.find((c) => c.category.id === 'misc')
    expect(misc?.lines.every((l) => l.actual === null)).toBe(true)
    expect(misc?.actual).toBe(30) // category total still reflects the true remainder
    expect(misc?.needsOtherLine).toBe(false) // ambiguous (2+ generic lines) is not the "no line at all" gap
  })

  it('flags needsOtherLine when a category has real spend but zero generic lines for the frequency (Equipement Logement case)', () => {
    const categories = [cat({ id: 'equip' })]
    const lines = [line({ id: 'yearly-generic', categoryId: 'equip', frequency: 'yearly', amount: 1000 })]
    const currentMonth = '2026-09'
    const txns = [
      atxn({ id: 't1', date: `${currentMonth}-05`, amount: 270.2, categoryId: 'equip', merchantId: 'store' }),
      atxn({ id: 't2', date: `${currentMonth}-06`, amount: 124.9, categoryId: 'equip', merchantId: 'store' }),
    ]
    const { monthly, yearly } = budgetWaterfall(lines, txns, categories, '2025-10', currentMonth)

    const monthlyEquip = monthly.categories.find((c) => c.category.id === 'equip')
    expect(monthlyEquip?.lines).toEqual([]) // no monthly line exists at all — this is the display bug
    expect(monthlyEquip?.actual).toBe(395.1)
    expect(monthlyEquip?.needsOtherLine).toBe(true)

    const yearlyEquip = yearly.categories.find((c) => c.category.id === 'equip')
    expect(yearlyEquip?.needsOtherLine).toBe(false) // its one yearly generic line already covers it
  })

  it('counts a merchant\'s current-month spend once (Monthly), excluded from Yearly\'s pool', () => {
    const categories = [cat({ id: 'shopping' })]
    const lines = [
      line({ id: 'monthly-merchant', categoryId: 'shopping', frequency: 'monthly', merchantId: 'amazon', amount: 50 }),
      line({ id: 'yearly-generic', categoryId: 'shopping', frequency: 'yearly', amount: 200 }),
    ]
    const currentMonth = '2026-09'
    const txns = [atxn({ id: 't1', date: `${currentMonth}-10`, amount: 42, categoryId: 'shopping', merchantId: 'amazon' })]
    const { monthly, yearly } = budgetWaterfall(lines, txns, categories, '2025-10', currentMonth)

    const monthlyShopping = monthly.categories.find((c) => c.category.id === 'shopping')
    expect(monthlyShopping?.lines.find((l) => l.line.id === 'monthly-merchant')?.actual).toBe(42)

    const yearlyShopping = yearly.categories.find((c) => c.category.id === 'shopping')
    expect(yearlyShopping?.actual ?? 0).toBe(0) // the same txn must not also appear here
    expect(yearlyShopping?.needsOtherLine).toBe(false) // its one generic line already covers the (empty) remainder
  })

  it('excludes past months\' merchant/ad-hoc spend from Yearly when a monthly line can claim it (Loisirs case)', () => {
    const categories = [cat({ id: 'loisirs' })]
    const lines = [
      line({ id: 'netflix', categoryId: 'loisirs', frequency: 'monthly', sourceRecurringId: 'rec-netflix', amount: 15 }),
      line({ id: 'apple-music', categoryId: 'loisirs', frequency: 'monthly', merchantId: 'apple', amount: 17 }),
      line({ id: 'other-loisirs', categoryId: 'loisirs', frequency: 'monthly', amount: 300 }),
      line({ id: 'amazon-prime', categoryId: 'loisirs', frequency: 'yearly', sourceRecurringId: 'rec-prime', amount: 70 }),
    ]
    const currentMonth = '2026-09'
    const txns = [
      atxn({ id: 'netflix-june', date: '2026-06-05', amount: 15, categoryId: 'loisirs', recurringId: 'rec-netflix' }),
      atxn({ id: 'prime-august', date: '2026-08-01', amount: 70, categoryId: 'loisirs', recurringId: 'rec-prime' }),
      atxn({ id: 'apple-june', date: '2026-06-10', amount: 17, categoryId: 'loisirs', merchantId: 'apple' }),
      atxn({ id: 'cinema-july', date: '2026-07-14', amount: 25, categoryId: 'loisirs' }),
    ]
    const { yearly } = budgetWaterfall(lines, txns, categories, '2026-06', currentMonth)

    const loisirs = yearly.categories.find((c) => c.category.id === 'loisirs')
    expect(loisirs?.actual).toBe(70) // only Prime — Apple Music and the ad-hoc cinema spend stay out
  })

  it('still leaks past months\' ad-hoc spend to Yearly when the category has no monthly line at all', () => {
    const categories = [cat({ id: 'transport' })]
    const lines = [line({ id: 'yearly-generic', categoryId: 'transport', frequency: 'yearly', amount: 1500 })]
    const txns = [atxn({ id: 't1', date: '2026-06-01', amount: 80, categoryId: 'transport', merchantId: 'parking' })]
    const { yearly } = budgetWaterfall(lines, txns, categories, '2026-06', '2026-09')

    const transport = yearly.categories.find((c) => c.category.id === 'transport')
    expect(transport?.actual).toBe(80) // no monthly line exists to claim it, so it still falls to yearly
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
  it('fmt renders a currency amount with a real minus sign (default en/EUR)', () => {
    expect(fmt(1234.5)).toBe('€1,234.50')
    expect(fmt(-1234.5)).toBe('−€1,234.50')
    expect(fmt(0, { noSymbol: true })).toBe('0.00')
  })

  it('fmt follows the active locale + currency', () => {
    setFormatConfig({ locale: 'en', currency: 'USD' })
    expect(fmt(1234.5)).toBe('$1,234.50')
    setFormatConfig({ locale: 'fr', currency: 'EUR' })
    expect(fmt(1234.5)).toMatch(/^1.234,50/)
    expect(fmt(1234.5)).toContain('€')
    setFormatConfig({ locale: 'en', currency: 'EUR' })
  })

  it('fmtShort abbreviates thousands', () => {
    expect(fmtShort(2500)).toBe('€2.5k')
    expect(fmtShort(20000)).toBe('€20k')
    expect(fmtShort(400)).toBe('€400')
  })

  it('splitCents separates whole and cents', () => {
    expect(splitCents(1234.5)).toEqual({ sign: '', whole: '1,234', cents: '50' })
    expect(splitCents(-9.05)).toEqual({ sign: '−', whole: '9', cents: '05' })
  })

  it('splitCents carries into the whole part instead of rendering ,100', () => {
    expect(splitCents(2.999)).toEqual({ sign: '', whole: '3', cents: '00' })
    expect(splitCents(0.999)).toEqual({ sign: '', whole: '1', cents: '00' })
  })
})
