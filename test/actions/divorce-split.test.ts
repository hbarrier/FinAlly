import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { makeTestDb, type TestDb } from '../helpers/db'
import { divorceSplitEntries, divorceSplitRentMonths, divorceSplitSettings } from '@/lib/schema'

const h = vi.hoisted(() => ({ db: null as TestDb | null }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))

let cleanup: () => void

beforeEach(async () => {
  const t = await makeTestDb()
  h.db = t.db
  cleanup = t.cleanup
})
afterEach(() => cleanup())

const SKI = { date: '2026-11-05', amount: 200, myPercent: 35, description: 'Ski' }

describe('divorce split expenses', () => {
  it('creates an Audrey expense, updates, flags and deletes it', async () => {
    const { createSplitEntry, updateSplitEntry, setExpensePaid, deleteSplitEntry } = await import('@/lib/actions/divorce-split')
    await createSplitEntry(SKI)
    const [row] = await h.db!.select().from(divorceSplitEntries)
    expect(row).toMatchObject({ ...SKI, type: 'expense', person: 'audrey', mePaid: 0, vincentPaid: 0 })

    await updateSplitEntry(row.id, { ...SKI, amount: 250 })
    await setExpensePaid(row.id, 'me', true)
    const [updated] = await h.db!.select().from(divorceSplitEntries)
    expect(updated).toMatchObject({ amount: 250, mePaid: 1, vincentPaid: 0 })

    await deleteSplitEntry(row.id)
    expect(await h.db!.select().from(divorceSplitEntries)).toHaveLength(0)
  })
})

describe('divorce split rent', () => {
  it('seeds the settings row and updates it', async () => {
    const { updateSplitSettings } = await import('@/lib/actions/divorce-split')
    expect(await h.db!.select().from(divorceSplitSettings)).toEqual([
      { id: 1, rent: 320, apl: 90, myPercent: 35, startMonth: '2026-10' },
    ])
    await updateSplitSettings({ rent: 330, apl: 95, myPercent: 40, startMonth: '2026-09' })
    const [s] = await h.db!.select().from(divorceSplitSettings)
    expect(s).toMatchObject({ rent: 330, apl: 95, myPercent: 40, startMonth: '2026-09' })
  })

  it('upserts a month override and its paid flags independently', async () => {
    const { setRentOverride, setRentPaid } = await import('@/lib/actions/divorce-split')
    await setRentPaid('2026-10', 'vincent', true)
    await setRentOverride('2026-10', { rent: 690, apl: null })
    await setRentPaid('2026-10', 'audrey', true)
    expect(await h.db!.select().from(divorceSplitRentMonths)).toEqual([
      { month: '2026-10', rent: 690, apl: null, vincentPaid: 1, audreyPaid: 1 },
    ])
  })
})
