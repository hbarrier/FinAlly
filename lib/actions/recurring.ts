'use server'

import { z } from 'zod'
import { revalidateApp } from './_shared'
import { db } from '../db'
import { recurring, recurringAmounts, transactions } from '../schema'
import { nanoid } from '../utils'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { resolvedDayOfMonth } from '../derive'
import {
  parse, zId, zName, zKind, zCadence, zAmount, zDateISO, zPaymentMethod, zNullableId, zOptionalId,
} from '../schemas'
import { defaultPaymentMethodForKind, type PaymentMethod } from '../payment-method'
import {
  ensureInstancesForRecurring,
  upsertLinkedInstance,
  currentMonth,
} from '../recurring-instances'
import { syncRecurringEffectiveAmountTx } from '../recurring-amounts'

const zDayOfMonth = z.number().int().min(-2).max(31)

const recurringCreateSchema = z.object({
  name: zName,
  amount: zAmount,
  kind: zKind,
  categoryId: zNullableId,
  merchantId: zOptionalId,
  cadence: zCadence,
  dayOfMonth: zDayOfMonth.nullable().optional(),
  startDate: zDateISO,
  endDate: zDateISO.nullable().optional(),
  method: zPaymentMethod.optional(),
})

const recurringUpdateSchema = z.object({
  name: zName.optional(),
  amount: zAmount.optional(),
  kind: zKind.optional(),
  method: zPaymentMethod.optional(),
  categoryId: zNullableId.optional(),
  merchantId: zNullableId.optional(),
  cadence: zCadence.optional(),
  dayOfMonth: zDayOfMonth.nullable().optional(),
  startDate: zDateISO.optional(),
  endDate: zDateISO.nullable().optional(),
})

const promoteSchema = z.object({
  name: zName,
  amount: zAmount,
  kind: zKind,
  categoryId: zNullableId,
  merchantId: zNullableId,
  method: zPaymentMethod.optional(),
  cadence: zCadence,
  dayOfMonth: zDayOfMonth.nullable(),
  startDate: zDateISO,
})

export async function addRecurring(input: {
  name: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string | null
  merchantId?: string | null
  cadence: 'monthly' | 'yearly'
  dayOfMonth?: number | null
  startDate: string
  endDate?: string | null
  method?: PaymentMethod
}) {
  const data = parse(recurringCreateSchema, input)
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
    const r = await tx.query.recurring.findFirst({ where: eq(recurring.id, id) })
    if (r) await ensureInstancesForRecurring(tx, r, data.startDate.slice(0, 7), currentMonth())
  })
  revalidateApp()
}

export async function updateRecurring(
  id: string,
  input: Partial<{
    name: string
    amount: number
    kind: 'expense' | 'income'
    method: PaymentMethod
    categoryId: string | null
    merchantId: string | null
    cadence: 'monthly' | 'yearly'
    dayOfMonth: number | null
    startDate: string
    endDate: string | null
  }>,
) {
  parse(zId, id)
  const data = parse(recurringUpdateSchema, input)
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
      await syncRecurringEffectiveAmountTx(tx, id)
    }

    // Gap-fill instances when startDate moves earlier
    if (data.startDate && data.startDate < current.startDate) {
      const updated = await tx.query.recurring.findFirst({ where: eq(recurring.id, id) })
      if (updated) {
        await ensureInstancesForRecurring(tx, updated, data.startDate.slice(0, 7), currentMonth())
      }
    }
  })
  revalidateApp()
}

export async function deleteRecurring(id: string) {
  parse(zId, id)
  await db.delete(recurring).where(eq(recurring.id, id))
  revalidateApp()
}

export async function addRecurringAmount(
  recurringId: string,
  amount: number,
  startDate: string,
) {
  parse(zId, recurringId)
  parse(zAmount, amount)
  parse(zDateISO, startDate)
  await db.transaction(async (tx) => {
    await tx.insert(recurringAmounts).values({
      id: nanoid(),
      recurringId,
      amount,
      startDate,
    })
    await syncRecurringEffectiveAmountTx(tx, recurringId)
  })
  revalidateApp()
}

export async function deleteRecurringAmount(entryId: string, recurringId: string) {
  parse(zId, entryId)
  parse(zId, recurringId)
  await db.transaction(async (tx) => {
    await tx.delete(recurringAmounts).where(eq(recurringAmounts.id, entryId))
    await syncRecurringEffectiveAmountTx(tx, recurringId)
  })
  revalidateApp()
}

export async function promoteToRecurring(
  txnId: string,
  input: {
    name: string
    amount: number
    kind: 'expense' | 'income'
    categoryId: string | null
    merchantId: string | null
    method?: PaymentMethod
    cadence: 'monthly' | 'yearly'
    dayOfMonth: number | null
    startDate: string
  },
): Promise<{ recurringId: string; linkedCount: number }> {
  parse(zId, txnId)
  const data = parse(promoteSchema, input)
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

    // Create linked instances for each matched transaction
    const matchedTxns = candidates.filter((t) => matchingIds.includes(t.id))
    if (!matchedTxns.find((t) => t.id === txnId)) {
      const sourceTxn = await tx.query.transactions.findFirst({
        where: (t, { eq }) => eq(t.id, txnId),
        columns: { date: true },
      })
      if (sourceTxn) matchedTxns.push({ id: txnId, date: sourceTxn.date, amount: data.amount })
    }
    for (const t of matchedTxns) {
      await upsertLinkedInstance(tx, newId, t.date.slice(0, 7), t.id)
    }

    // Gap-fill expected instances
    const r = await tx.query.recurring.findFirst({ where: eq(recurring.id, newId) })
    if (r) await ensureInstancesForRecurring(tx, r, data.startDate.slice(0, 7), currentMonth())

    return matchingIds.length
  })

  revalidateApp()
  return { recurringId: newId, linkedCount }
}

export async function bulkPromoteToRecurring(
  txnIds: string[],
  input: {
    name: string
    amount: number
    kind: 'expense' | 'income'
    categoryId: string | null
    merchantId: string | null
    method?: PaymentMethod
    cadence: 'monthly' | 'yearly'
    dayOfMonth: number | null
    startDate: string
  },
): Promise<{ recurringId: string; linkedCount: number }> {
  if (txnIds.length === 0) throw new Error('No transactions provided')
  parse(z.array(zId), txnIds)
  const data = parse(promoteSchema, input)
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

    const txns = await tx
      .select({ id: transactions.id, date: transactions.date })
      .from(transactions)
      .where(inArray(transactions.id, txnIds))

    await tx
      .update(transactions)
      .set({
        recurringId: newId,
        method,
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.kind === 'expense' && method === 'cash' ? { cleared: 1 } : {}),
      })
      .where(inArray(transactions.id, txnIds))

    for (const t of txns) {
      await upsertLinkedInstance(tx, newId, t.date.slice(0, 7), t.id)
    }

    const r = await tx.query.recurring.findFirst({ where: eq(recurring.id, newId) })
    if (r) await ensureInstancesForRecurring(tx, r, data.startDate.slice(0, 7), currentMonth())
  })

  revalidateApp()
  return { recurringId: newId, linkedCount: txnIds.length }
}

