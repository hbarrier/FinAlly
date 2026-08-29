import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { makeTestDb, type TestDb } from '../helpers/db'
import { categories, recurring, recurringInstances, transactions, simulationLines } from '@/lib/schema'

const h = vi.hoisted(() => ({ db: null as TestDb | null }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))

let cleanup: () => void
beforeEach(async () => {
  const t = await makeTestDb()
  h.db = t.db
  cleanup = t.cleanup
})
afterEach(() => cleanup())

describe('server-action input validation', () => {
  it('addTransaction rejects a negative amount and a malformed date', async () => {
    const { addTransaction } = await import('@/lib/actions/transactions')
    await expect(addTransaction({
      date: '2026-01-10', amount: -5, kind: 'expense', categoryId: null,
    })).rejects.toThrow(/positive/i)
    await expect(addTransaction({
      date: '10/01/2026', amount: 5, kind: 'expense', categoryId: null,
    })).rejects.toThrow(/YYYY-MM-DD/)
  })

  it('addRecurring rejects an out-of-range day of month', async () => {
    const { addRecurring } = await import('@/lib/actions/recurring')
    await expect(addRecurring({
      name: 'Rent', amount: 900, kind: 'expense', categoryId: null,
      cadence: 'monthly', dayOfMonth: 45, startDate: '2026-01-01',
    })).rejects.toThrow()
  })

  it('addSimulationLine allows amount 0 but rejects negative', async () => {
    const db = h.db!
    await db.insert(categories).values({ id: 'c1', name: 'C', kind: 'expense' })
    const { addSimulation, addSimulationLine } = await import('@/lib/actions/simulations')
    const { id } = await addSimulation({ name: 'S', description: null })
    await expect(addSimulationLine(id, {
      name: null, kind: 'expense', categoryId: 'c1', merchantId: null,
      amount: 0, frequency: 'monthly',
    })).resolves.toBeUndefined()
    await expect(addSimulationLine(id, {
      name: null, kind: 'expense', categoryId: 'c1', merchantId: null,
      amount: -1, frequency: 'monthly',
    })).rejects.toThrow(/negative/i)
  })
})

describe('importTransactions', () => {
  it('inserts rows and links their recurring instances in one transaction', async () => {
    const db = h.db!
    await db.insert(recurring).values({
      id: 'r1', name: 'Netflix', amount: 12, kind: 'expense', cadence: 'monthly', startDate: '2026-01-01',
    })
    const { importTransactions } = await import('@/lib/actions/import')

    await importTransactions({
      merchantMappings: [{
        csvName: 'NETFLIX', action: 'create-same', existingMerchantId: null,
        customName: 'NETFLIX', recurringId: 'r1',
      }],
      rows: [{ merchantCsvName: 'NETFLIX', date: '2026-02-03', amount: 12 }],
    })

    const txns = await db.select().from(transactions)
    expect(txns).toHaveLength(1)
    expect(txns[0].recurringId).toBe('r1')
    expect(txns[0].cleared).toBe(1)

    const inst = await db.select().from(recurringInstances).where(eq(recurringInstances.recurringId, 'r1'))
    expect(inst.find((i) => i.month === '2026-02')?.status).toBe('linked')
  })
})

describe('simulation seeding is idempotent', () => {
  it('seedZeroCategoryLines does not duplicate on a second call', async () => {
    const db = h.db!
    await db.insert(categories).values([
      { id: 'c1', name: 'Food', kind: 'expense' },
      { id: 'c2', name: 'Pay', kind: 'income' },
    ])
    const { addSimulation, seedZeroCategoryLines } = await import('@/lib/actions/simulations')
    const { id } = await addSimulation({ name: 'S', description: null })

    await seedZeroCategoryLines(id)
    await seedZeroCategoryLines(id)

    const lines = await db.select().from(simulationLines).where(eq(simulationLines.simulationId, id))
    expect(lines).toHaveLength(2)
  })

  it('populateSimulationFromInputs never double-seeds', async () => {
    const db = h.db!
    await db.insert(categories).values({ id: 'c1', name: 'Food', kind: 'expense' })
    await db.insert(recurring).values({
      id: 'r1', name: 'Rent', amount: 900, kind: 'expense', cadence: 'monthly', startDate: '2020-01-01',
    })
    const { addSimulation, populateSimulationFromInputs } = await import('@/lib/actions/simulations')
    const { id } = await addSimulation({ name: 'S', description: null })
    const inputs = {
      recurring: { monthlyExpenses: true, monthlyIncome: false, yearlyExpenses: false, yearlyIncome: false },
      avg: { expenses: false, income: false, periodMonths: 6 as const, rollup: 'all' as const, thresholdMonthly: 0 },
    }

    await populateSimulationFromInputs(id, inputs)
    const after1 = await db.select().from(simulationLines).where(eq(simulationLines.simulationId, id))
    await populateSimulationFromInputs(id, inputs)
    const after2 = await db.select().from(simulationLines).where(eq(simulationLines.simulationId, id))

    expect(after2.length).toBe(after1.length)
    expect(after1.filter((l) => l.origin === 'recurring')).toHaveLength(1)
  })
})
