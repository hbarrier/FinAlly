import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { makeTestDb, type TestDb } from '../helpers/db'
import {
  merchants,
  transactions,
  recurring,
  budgets,
  budgetLines,
  simulations,
  simulationLines,
} from '@/lib/schema'

const h = vi.hoisted(() => ({ db: null as TestDb | null }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))

let cleanup: () => void

beforeAll(async () => {
  const t = await makeTestDb()
  h.db = t.db
  cleanup = t.cleanup
})
afterAll(() => cleanup())

describe('mergeMerchants', () => {
  it('repoints transactions, recurring, budget lines and simulation lines, then deletes the merged merchants', async () => {
    const db = h.db!
    const { mergeMerchants } = await import('@/lib/actions/merchants')

    await db.insert(merchants).values([
      { id: 'keep', name: 'Keep' },
      { id: 'dupe', name: 'Dupe' },
    ])
    await db.insert(transactions).values({
      id: 'tx1', date: '2026-01-10', amount: 10, kind: 'expense', merchantId: 'dupe',
    })
    await db.insert(recurring).values({
      id: 'r1', name: 'Bill', amount: 5, kind: 'expense', cadence: 'monthly',
      startDate: '2026-01-01', merchantId: 'dupe',
    })
    await db.insert(budgets).values({ id: 'b1', name: 'B', isActive: 1 })
    // a category is required for a budget line
    await db.run('INSERT INTO categories (id, name, kind) VALUES (\'c1\', \'Cat\', \'expense\')')
    await db.insert(budgetLines).values({
      id: 'bl1', budgetId: 'b1', kind: 'expense', categoryId: 'c1', amount: 5,
      frequency: 'monthly', merchantId: 'dupe',
    })
    await db.insert(simulations).values({ id: 's1', name: 'S' })
    await db.insert(simulationLines).values({
      id: 'sl1', simulationId: 's1', kind: 'expense', amount: 5, frequency: 'monthly', merchantId: 'dupe',
    })

    await mergeMerchants('keep', ['dupe'])

    expect((await db.select().from(transactions).where(eq(transactions.id, 'tx1')))[0].merchantId).toBe('keep')
    expect((await db.select().from(recurring).where(eq(recurring.id, 'r1')))[0].merchantId).toBe('keep')
    expect((await db.select().from(budgetLines).where(eq(budgetLines.id, 'bl1')))[0].merchantId).toBe('keep')
    expect((await db.select().from(simulationLines).where(eq(simulationLines.id, 'sl1')))[0].merchantId).toBe('keep')
    expect(await db.select().from(merchants).where(eq(merchants.id, 'dupe'))).toHaveLength(0)
    expect(await db.select().from(merchants).where(eq(merchants.id, 'keep'))).toHaveLength(1)
  })

  it('ignores keepId when it appears in mergeIds (does not delete the survivor)', async () => {
    const db = h.db!
    const { mergeMerchants } = await import('@/lib/actions/merchants')
    await db.insert(merchants).values({ id: 'solo', name: 'Solo' })

    await mergeMerchants('solo', ['solo'])

    expect(await db.select().from(merchants).where(eq(merchants.id, 'solo'))).toHaveLength(1)
  })
})
