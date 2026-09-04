import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { makeTestDb, type TestDb } from '../helpers/db'
import { savingAccounts, transactions, recurring } from '@/lib/schema'

const h = vi.hoisted(() => ({ db: null as TestDb | null }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

let cleanup: () => void
beforeEach(async () => {
  const t = await makeTestDb()
  h.db = t.db
  cleanup = t.cleanup
})
afterEach(() => cleanup())

async function newAccount(name: string, startBalance = 0): Promise<string> {
  const { addSavingAccount } = await import('@/lib/actions/saving-accounts')
  await addSavingAccount({ name, startBalance })
  const [row] = await h.db!.select().from(savingAccounts).where(eq(savingAccounts.name, name))
  return row.id
}

describe('saving accounts', () => {
  it('a credit -> saving transfer moves both balances and is categorised Savings', async () => {
    const { addTransaction } = await import('@/lib/actions/transactions')
    const { getSavingAccountBalances } = await import('@/lib/queries/saving-accounts')
    const a = await newAccount('Livret A', 1000)

    await addTransaction({
      date: '2026-02-01', amount: 200, kind: 'saving', categoryId: null,
      sourceSavingAccountId: null, destSavingAccountId: a,
    })

    const [tx] = await h.db!.select().from(transactions)
    expect(tx.kind).toBe('saving')
    expect(tx.method).toBe('transfer')
    expect(tx.destSavingAccountId).toBe(a)
    expect(tx.categoryId).toBe('cat_savings')

    const balances = await getSavingAccountBalances()
    expect(balances.get(a)).toBe(1200)
  })

  it('blocks an outbound transfer that exceeds the source balance', async () => {
    const { addTransaction } = await import('@/lib/actions/transactions')
    const a = await newAccount('Livret A', 100)
    await expect(
      addTransaction({
        date: '2026-02-01', amount: 500, kind: 'saving', categoryId: null,
        sourceSavingAccountId: a, destSavingAccountId: null,
      }),
    ).rejects.toThrow(/not enough/i)
  })

  it('rejects a transfer with the same source and destination', async () => {
    const { addTransaction } = await import('@/lib/actions/transactions')
    const a = await newAccount('Livret A', 100)
    await expect(
      addTransaction({
        date: '2026-02-01', amount: 10, kind: 'saving', categoryId: null,
        sourceSavingAccountId: a, destSavingAccountId: a,
      }),
    ).rejects.toThrow(/different/i)
  })

  it('deleteSavingAccount is blocked once a transfer references it', async () => {
    const { addTransaction } = await import('@/lib/actions/transactions')
    const { deleteSavingAccount } = await import('@/lib/actions/saving-accounts')
    const a = await newAccount('Livret A', 0)
    const b = await newAccount('Livret B', 0)

    await deleteSavingAccount(b) // no transfers -> ok
    expect((await h.db!.select().from(savingAccounts)).map((r) => r.id)).toEqual([a])

    await addTransaction({
      date: '2026-02-01', amount: 50, kind: 'saving', categoryId: null,
      sourceSavingAccountId: null, destSavingAccountId: a,
    })
    await expect(deleteSavingAccount(a)).rejects.toThrow(/cannot be deleted/i)
  })

  it('a recurring saving transfer is stored as kind=saving with the Savings category and no overdraw check', async () => {
    const { addRecurring } = await import('@/lib/actions/recurring')
    const a = await newAccount('Livret A', 0) // empty on purpose

    await addRecurring({
      name: 'Monthly savings', amount: 100, kind: 'saving', categoryId: null,
      cadence: 'monthly', dayOfMonth: 1, startDate: '2026-01-01',
      sourceSavingAccountId: null, destSavingAccountId: a,
    })

    const [r] = await h.db!.select().from(recurring)
    expect(r.kind).toBe('saving')
    expect(r.method).toBe('transfer')
    expect(r.categoryId).toBe('cat_savings')
    expect(r.destSavingAccountId).toBe(a)
  })

  it('a saving -> saving transfer leaves the credit delta at zero', async () => {
    const { addTransaction } = await import('@/lib/actions/transactions')
    const { getMonthOpeningBalance } = await import('@/lib/queries/opening-balance')
    const a = await newAccount('A', 500)
    const b = await newAccount('B', 0)

    await addTransaction({
      date: '2026-01-15', amount: 100, kind: 'saving', categoryId: null,
      sourceSavingAccountId: a, destSavingAccountId: b,
    })

    const { openingBalance } = await getMonthOpeningBalance({
      monthKey: '2026-02', monthStart: '2026-02-01', startingBalance: 1000,
    })
    expect(openingBalance).toBe(1000)
  })
})
