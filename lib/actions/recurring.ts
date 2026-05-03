'use server'

import { revalidateApp } from './_shared'
import { db } from '../db'
import { recurring, recurringAmounts, transactions } from '../schema'
import { nanoid } from '../utils'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { effectiveAmount, resolvedDayOfMonth } from '../derive'
import { defaultPaymentMethodForKind, type PaymentMethod } from '../payment-method'

export async function addRecurring(data: {
  name: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string | null
  merchantId?: string | null
  cadence: 'weekly' | 'monthly' | 'yearly'
  dayOfMonth?: number | null
  dayOfWeek?: number | null
  startDate: string
  endDate?: string | null
  method?: PaymentMethod
}) {
  const id = nanoid()
  const method = data.method ?? defaultPaymentMethodForKind(data.kind)
  await db.transaction(async (tx) => {
    await tx.insert(recurring).values({
      id,
      ...data,
      method,
      merchantId: data.merchantId ?? null,
    })
    await tx.insert(recurringAmounts).values({
      id: nanoid(),
      recurringId: id,
      amount: data.amount,
      startDate: data.startDate,
    })
  })
  revalidateApp()
}

export async function updateRecurring(
  id: string,
  data: Partial<{
    name: string
    amount: number
    kind: 'expense' | 'income'
    method: PaymentMethod
    categoryId: string | null
    merchantId: string | null
    cadence: 'weekly' | 'monthly' | 'yearly'
    dayOfMonth: number | null
    dayOfWeek: number | null
    startDate: string
    endDate: string | null
  }>,
) {
  await db.transaction(async (tx) => {
    const current = await tx.query.recurring.findFirst({
      where: eq(recurring.id, id),
    })
    if (!current) return

    const { amount, ...rest } = data
    const nextKind = (data.kind ?? current.kind) as 'expense' | 'income'

    let nextMethod: PaymentMethod | undefined
    if (data.method) nextMethod = data.method
    else if (data.kind && data.kind !== current.kind) {
      const wasImplicitDefault = (current.method as PaymentMethod) === defaultPaymentMethodForKind(current.kind)
      nextMethod = wasImplicitDefault ? defaultPaymentMethodForKind(nextKind) : (current.method as PaymentMethod)
    }

    const nextRest: typeof rest & { method?: PaymentMethod } = { ...rest }
    if (nextMethod) nextRest.method = nextMethod

    if (Object.keys(nextRest).length > 0) {
      await tx.update(recurring).set(nextRest).where(eq(recurring.id, id))
    }

    if (nextMethod) {
      await tx.update(transactions).set({ method: nextMethod }).where(eq(transactions.recurringId, id))
      if (nextKind === 'expense' && nextMethod === 'cash') {
        await tx.update(transactions).set({ cleared: 1 }).where(eq(transactions.recurringId, id))
      }
    }

    if (typeof amount === 'number' && Math.abs(amount - current.amount) > 0.005) {
      const today = new Date().toISOString().slice(0, 10)
      const existingToday = await tx.query.recurringAmounts.findFirst({
        where: and(
          eq(recurringAmounts.recurringId, id),
          eq(recurringAmounts.startDate, today),
        ),
      })
      if (existingToday) {
        await tx
          .update(recurringAmounts)
          .set({ amount })
          .where(eq(recurringAmounts.id, existingToday.id))
      } else {
        await tx.insert(recurringAmounts).values({
          id: nanoid(),
          recurringId: id,
          amount,
          startDate: today,
        })
      }
      await syncEffectiveAmount(tx, id)
    }
  })
  revalidateApp()
}

export async function deleteRecurring(id: string) {
  await db.delete(recurring).where(eq(recurring.id, id))
  revalidateApp()
}

export async function addRecurringAmount(
  recurringId: string,
  amount: number,
  startDate: string,
) {
  await db.transaction(async (tx) => {
    await tx.insert(recurringAmounts).values({
      id: nanoid(),
      recurringId,
      amount,
      startDate,
    })
    await syncEffectiveAmount(tx, recurringId)
  })
  revalidateApp()
}

export async function deleteRecurringAmount(entryId: string, recurringId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(recurringAmounts).where(eq(recurringAmounts.id, entryId))
    await syncEffectiveAmount(tx, recurringId)
  })
  revalidateApp()
}

export async function promoteToRecurring(
  txnId: string,
  data: {
    name: string
    amount: number
    kind: 'expense' | 'income'
    categoryId: string | null
    merchantId: string | null
    method?: PaymentMethod
    cadence: 'weekly' | 'monthly' | 'yearly'
    dayOfMonth: number | null
    dayOfWeek: number | null
    startDate: string
  },
): Promise<{ recurringId: string; linkedCount: number }> {
  const newId = nanoid()
  const method = data.method ?? defaultPaymentMethodForKind(data.kind)

  const linkedCount = await db.transaction(async (tx) => {
    await tx.insert(recurring).values({ id: newId, ...data, method })
    await tx.insert(recurringAmounts).values({
      id: nanoid(),
      recurringId: newId,
      amount: data.amount,
      startDate: data.startDate,
    })

    const candidates = await tx
      .select({ id: transactions.id, date: transactions.date, amount: transactions.amount })
      .from(transactions)
      .where(and(eq(transactions.kind, data.kind), isNull(transactions.recurringId)))

    const matchingIds = candidates
      .filter((t) => {
        if (Math.abs(Number(t.amount) - data.amount) > 0.005) return false
        const d = new Date(t.date + 'T12:00:00')
        if (data.cadence === 'monthly') {
          const target = resolvedDayOfMonth(data.dayOfMonth ?? 1, d)
          return Math.abs(d.getDate() - target) <= 5
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

    if (!matchingIds.includes(txnId)) matchingIds.push(txnId)

    await tx
      .update(transactions)
      .set({
        recurringId: newId,
        method,
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.kind === 'expense' && method === 'cash' ? { cleared: 1 } : {}),
      })
      .where(inArray(transactions.id, matchingIds))

    return matchingIds.length
  })

  revalidateApp()
  return { recurringId: newId, linkedCount }
}

export async function bulkPromoteToRecurring(
  txnIds: string[],
  data: {
    name: string
    amount: number
    kind: 'expense' | 'income'
    categoryId: string | null
    merchantId: string | null
    method?: PaymentMethod
    cadence: 'weekly' | 'monthly' | 'yearly'
    dayOfMonth: number | null
    dayOfWeek: number | null
    startDate: string
  },
): Promise<{ recurringId: string; linkedCount: number }> {
  if (txnIds.length === 0) throw new Error('No transactions provided')
  const newId = nanoid()
  const method = data.method ?? defaultPaymentMethodForKind(data.kind)

  await db.transaction(async (tx) => {
    await tx.insert(recurring).values({ id: newId, ...data, method })
    await tx.insert(recurringAmounts).values({
      id: nanoid(),
      recurringId: newId,
      amount: data.amount,
      startDate: data.startDate,
    })
    await tx
      .update(transactions)
      .set({
        recurringId: newId,
        method,
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.kind === 'expense' && method === 'cash' ? { cleared: 1 } : {}),
      })
      .where(inArray(transactions.id, txnIds))
  })

  revalidateApp()
  return { recurringId: newId, linkedCount: txnIds.length }
}

type DbClient = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db

async function syncEffectiveAmount(client: DbClient, recurringId: string) {
  const allEntries = await client
    .select()
    .from(recurringAmounts)
    .where(eq(recurringAmounts.recurringId, recurringId))

  if (allEntries.length === 0) return

  const current = effectiveAmount(allEntries)
  await client
    .update(recurring)
    .set({ amount: current })
    .where(eq(recurring.id, recurringId))
}
