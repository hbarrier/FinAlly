import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { makeTestDb, type TestDb } from '../helpers/db'
import { categories, merchants, transactions } from '@/lib/schema'

const h = vi.hoisted(() => ({ db: null as TestDb | null }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))

let cleanup: () => void
beforeEach(async () => {
  const t = await makeTestDb()
  h.db = t.db
  cleanup = t.cleanup
  vi.setSystemTime(new Date('2026-03-15T12:00:00-04:00'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('getCategoryStats', () => {
  it('counts transactions per category and sums this-month non-planned expenses', async () => {
    const db = h.db!
    await db.insert(categories).values([
      { id: 'food', name: 'Food', kind: 'expense' },
      { id: 'pay', name: 'Pay', kind: 'income' },
    ])
    await db.insert(transactions).values([
      { id: '1', date: '2026-03-02', amount: 10, kind: 'expense', categoryId: 'food' },
      { id: '2', date: '2026-03-10', amount: 25, kind: 'expense', categoryId: 'food' },
      { id: '3', date: '2026-03-31', amount: 99, kind: 'expense', categoryId: 'food' }, // planned
      { id: '4', date: '2026-02-01', amount: 5, kind: 'expense', categoryId: 'food' },  // last month
      { id: '5', date: '2026-03-05', amount: 2000, kind: 'income', categoryId: 'pay' },
    ])
    const { getCategoryStats } = await import('@/lib/queries/category-stats')
    const stats = await getCategoryStats()

    expect(stats.usage).toEqual({ food: 4, pay: 1 })
    expect(stats.monthSpend.food).toBeCloseTo(35, 2)
    expect(stats.monthSpend.pay).toBeUndefined()
  })
})

describe('getMerchantUsage', () => {
  it('counts transactions per merchant', async () => {
    const db = h.db!
    await db.insert(merchants).values([{ id: 'm1', name: 'A' }, { id: 'm2', name: 'B' }])
    await db.insert(transactions).values([
      { id: '1', date: '2026-01-01', amount: 1, kind: 'expense', merchantId: 'm1' },
      { id: '2', date: '2026-01-02', amount: 1, kind: 'expense', merchantId: 'm1' },
      { id: '3', date: '2026-01-03', amount: 1, kind: 'expense', merchantId: null },
    ])
    const { getMerchantUsage } = await import('@/lib/queries/merchant-usage')
    expect(await getMerchantUsage()).toEqual({ m1: 2 })
  })
})

describe('getCurrentMonthActuals', () => {
  it('splits this-month non-planned actuals by kind and category', async () => {
    const db = h.db!
    await db.insert(categories).values([
      { id: 'food', name: 'Food', kind: 'expense' },
      { id: 'pay', name: 'Pay', kind: 'income' },
    ])
    await db.insert(transactions).values([
      { id: '1', date: '2026-03-02', amount: 40, kind: 'expense', categoryId: 'food' },
      { id: '2', date: '2026-03-20', amount: 500, kind: 'expense', categoryId: 'food' }, // planned
      { id: '3', date: '2026-03-01', amount: 3000, kind: 'income', categoryId: 'pay' },
    ])
    const { getCurrentMonthActuals } = await import('@/lib/queries/month-actuals')
    const a = await getCurrentMonthActuals()
    expect(a.expense.food).toBeCloseTo(40, 2)
    expect(a.income.pay).toBeCloseTo(3000, 2)
  })
})
