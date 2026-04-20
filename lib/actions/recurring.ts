'use server'

import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { recurring, recurringAmounts, transactions } from '../schema'
import { nanoid } from '../utils'
import { eq, asc, and, isNull, inArray } from 'drizzle-orm'

export async function addRecurring(data: {
  name: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string | null
  cadence: 'weekly' | 'monthly' | 'yearly'
  dayOfMonth?: number | null
  dayOfWeek?: number | null
  startDate: string
  endDate?: string | null
}) {
  const id = nanoid()
  await db.insert(recurring).values({ id, ...data })
  await db.insert(recurringAmounts).values({
    id: nanoid(),
    recurringId: id,
    amount: data.amount,
    startDate: data.startDate,
  })
  revalidatePath('/', 'layout')
}

export async function updateRecurring(
  id: string,
  data: Partial<{
    name: string
    amount: number
    kind: 'expense' | 'income'
    categoryId: string | null
    cadence: 'weekly' | 'monthly' | 'yearly'
    dayOfMonth: number | null
    dayOfWeek: number | null
    startDate: string
    endDate: string | null
  }>,
) {
  await db.update(recurring).set(data).where(eq(recurring.id, id))
  revalidatePath('/', 'layout')
}

export async function deleteRecurring(id: string) {
  await db.delete(recurring).where(eq(recurring.id, id))
  revalidatePath('/', 'layout')
}

export async function addRecurringAmount(
  recurringId: string,
  amount: number,
  startDate: string,
) {
  await db.insert(recurringAmounts).values({
    id: nanoid(),
    recurringId,
    amount,
    startDate,
  })
  await syncEffectiveAmount(recurringId)
  revalidatePath('/', 'layout')
}

export async function deleteRecurringAmount(entryId: string, recurringId: string) {
  await db.delete(recurringAmounts).where(eq(recurringAmounts.id, entryId))
  await syncEffectiveAmount(recurringId)
  revalidatePath('/', 'layout')
}

export async function promoteToRecurring(
  txnId: string,
  data: {
    name: string
    amount: number
    kind: 'expense' | 'income'
    categoryId: string | null
    cadence: 'weekly' | 'monthly' | 'yearly'
    dayOfMonth: number | null
    dayOfWeek: number | null
    startDate: string
  },
): Promise<{ recurringId: string; linkedCount: number }> {
  const newId = nanoid()

  // 1. Create recurring entry + initial amount history
  await db.insert(recurring).values({ id: newId, ...data })
  await db.insert(recurringAmounts).values({
    id: nanoid(),
    recurringId: newId,
    amount: data.amount,
    startDate: data.startDate,
  })

  // 2. Fetch unlinked transactions of the same kind
  const candidates = await db
    .select({ id: transactions.id, date: transactions.date, amount: transactions.amount })
    .from(transactions)
    .where(and(eq(transactions.kind, data.kind), isNull(transactions.recurringId)))

  // 3. Filter by amount + cadence match
  const matchingIds = candidates
    .filter((t) => {
      if (Math.abs(Number(t.amount) - data.amount) > 0.005) return false
      const d = new Date(t.date + 'T12:00:00')
      if (data.cadence === 'monthly') {
        return Math.abs(d.getDate() - (data.dayOfMonth ?? 1)) <= 5
      }
      if (data.cadence === 'weekly') {
        return d.getDay() === (data.dayOfWeek ?? 1)
      }
      if (data.cadence === 'yearly') {
        const src = new Date(data.startDate + 'T12:00:00')
        return d.getMonth() === src.getMonth() && Math.abs(d.getDate() - src.getDate()) <= 5
      }
      return false
    })
    .map((t) => t.id)

  // Always include the source transaction
  if (!matchingIds.includes(txnId)) matchingIds.push(txnId)

  // 4. Bulk-link all matched transactions
  await db
    .update(transactions)
    .set({ recurringId: newId, ...(data.categoryId ? { categoryId: data.categoryId } : {}) })
    .where(inArray(transactions.id, matchingIds))

  revalidatePath('/', 'layout')
  return { recurringId: newId, linkedCount: matchingIds.length }
}

async function syncEffectiveAmount(recurringId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const allEntries = await db
    .select()
    .from(recurringAmounts)
    .where(eq(recurringAmounts.recurringId, recurringId))
    .orderBy(asc(recurringAmounts.startDate))

  if (allEntries.length === 0) return

  // Latest entry with startDate <= today, else the earliest entry overall
  const pastEntries = allEntries.filter((e) => e.startDate <= today)
  const effectiveAmount = pastEntries.length > 0
    ? pastEntries[pastEntries.length - 1].amount
    : allEntries[0].amount

  await db.update(recurring).set({ amount: effectiveAmount }).where(eq(recurring.id, recurringId))
}
