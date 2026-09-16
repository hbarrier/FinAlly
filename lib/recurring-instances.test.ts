import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { makeTestDb, type TestDb } from '../test/helpers/db'
import { categories, recurring, recurringInstances } from './schema'

const h = vi.hoisted(() => ({ db: null as TestDb | null }))
vi.mock('./db', () => ({ get db() { return h.db } }))

let cleanup: () => void
beforeEach(async () => {
  const t = await makeTestDb()
  h.db = t.db
  cleanup = t.cleanup
})
afterEach(() => cleanup())

describe('ensureInstancesForRecurring / pruneExpiredInstances', () => {
  it('does not create an instance for a month whose occurrence day falls after endDate', async () => {
    const db = h.db!
    const { ensureInstancesForRecurring } = await import('./recurring-instances')
    await db.insert(categories).values({ id: 'c1', name: 'C', kind: 'income' })
    await db.insert(recurring).values({
      id: 'r1', name: 'Pension Alimentaire', amount: 2025, kind: 'income', method: 'transfer',
      categoryId: 'c1', cadence: 'monthly', dayOfMonth: 20,
      startDate: '2023-01-01', endDate: '2026-09-01',
    })
    const r = (await db.query.recurring.findFirst({ where: eq(recurring.id, 'r1') }))!
    await ensureInstancesForRecurring(db, r, '2026-08', '2026-09')

    const rows = await db.select().from(recurringInstances).where(eq(recurringInstances.recurringId, 'r1'))
    expect(rows.map((row) => row.month)).toEqual(['2026-08'])
  })

  it('deletes a stale expected instance once endDate is moved before its occurrence day', async () => {
    const db = h.db!
    const { ensureInstancesForRecurring, pruneExpiredInstances } = await import('./recurring-instances')
    await db.insert(categories).values({ id: 'c1', name: 'C', kind: 'income' })
    await db.insert(recurring).values({
      id: 'r1', name: 'Pension Alimentaire', amount: 2025, kind: 'income', method: 'transfer',
      categoryId: 'c1', cadence: 'monthly', dayOfMonth: 20,
      startDate: '2023-01-01', endDate: null,
    })
    let r = (await db.query.recurring.findFirst({ where: eq(recurring.id, 'r1') }))!
    await ensureInstancesForRecurring(db, r, '2026-09', '2026-09')
    expect(
      await db.select().from(recurringInstances)
        .where(and(eq(recurringInstances.recurringId, 'r1'), eq(recurringInstances.month, '2026-09'))),
    ).toHaveLength(1)

    await db.update(recurring).set({ endDate: '2026-09-01' }).where(eq(recurring.id, 'r1'))
    r = (await db.query.recurring.findFirst({ where: eq(recurring.id, 'r1') }))!
    await pruneExpiredInstances(db, r)

    expect(
      await db.select().from(recurringInstances)
        .where(and(eq(recurringInstances.recurringId, 'r1'), eq(recurringInstances.month, '2026-09'))),
    ).toHaveLength(0)
  })

  it('keeps a linked instance even if it is now past endDate', async () => {
    const db = h.db!
    const { pruneExpiredInstances } = await import('./recurring-instances')
    await db.insert(categories).values({ id: 'c1', name: 'C', kind: 'income' })
    await db.insert(recurring).values({
      id: 'r1', name: 'Pension Alimentaire', amount: 2025, kind: 'income', method: 'transfer',
      categoryId: 'c1', cadence: 'monthly', dayOfMonth: 20,
      startDate: '2023-01-01', endDate: '2026-09-01',
    })
    await db.insert(recurringInstances).values({
      id: 'i1', recurringId: 'r1', month: '2026-09', status: 'linked', transactionId: null,
    })
    const r = (await db.query.recurring.findFirst({ where: eq(recurring.id, 'r1') }))!
    await pruneExpiredInstances(db, r)

    expect(await db.select().from(recurringInstances).where(eq(recurringInstances.id, 'i1'))).toHaveLength(1)
  })
})
