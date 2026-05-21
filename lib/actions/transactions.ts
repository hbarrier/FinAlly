'use server'

import { db } from '../db'
import { categories, reimbursementAllocations, transactions } from '../schema'
import { nanoid } from '../utils'
import { and, eq, inArray, or } from 'drizzle-orm'
import { revalidateApp } from './_shared'
import { defaultPaymentMethodForKind, type PaymentMethod } from '../payment-method'
import { upsertLinkedInstance, revertInstanceToExpected } from '../recurring-instances'
import {
  loadRecurringAmountEntriesTx,
  pickEffectiveRecurringAmountEntry,
  syncRecurringEffectiveAmountTx,
  upsertRecurringAmountEntryTx,
} from '../recurring-amounts'

export async function addTransaction(data: {
  date: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string | null
  merchantId?: string | null
  note?: string | null
  recurringId?: string | null
  recurringAmountId?: string | null
  reimbursable?: number
  cleared?: number
  method?: PaymentMethod
}) {
  const method = data.method ?? defaultPaymentMethodForKind(data.kind)
  const cleared =
    typeof data.cleared === 'number'
      ? data.cleared
      : data.kind === 'expense' && method === 'cash'
        ? 1
        : undefined

  const txId = nanoid()
  await db.transaction(async (tx) => {
    await tx.insert(transactions).values({
      id: txId,
      ...data,
      method,
      ...(cleared === undefined ? {} : { cleared }),
    })
    if (data.recurringId) {
      const month = data.date.slice(0, 7)
      await upsertLinkedInstance(tx, data.recurringId, month, txId)
    }
  })
  revalidateApp()
}

export async function updateTransaction(
  id: string,
  data: {
    date?: string
    amount?: number
    kind?: 'expense' | 'income'
    categoryId?: string | null
    merchantId?: string | null
    note?: string | null
    reimbursable?: number
    method?: PaymentMethod
  },
) {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: transactions.id,
        date: transactions.date,
        amount: transactions.amount,
        kind: transactions.kind,
        method: transactions.method,
        recurringId: transactions.recurringId,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryKind: categories.kind,
        reimbursable: transactions.reimbursable,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.id, id))
      .limit(1)

    if (!existing) return

    const nextKind = data.kind ?? existing.kind
    const nextCategoryId = data.categoryId === undefined ? existing.categoryId : data.categoryId
    const nextReimbursable = data.reimbursable === undefined ? existing.reimbursable : data.reimbursable

    let nextMethod: PaymentMethod | undefined
    if (existing.recurringId) {
      const r = await tx.query.recurring.findFirst({
        where: (rr, { eq }) => eq(rr.id, existing.recurringId!),
        columns: { method: true },
      })
      nextMethod = (r?.method as PaymentMethod | undefined) ?? defaultPaymentMethodForKind(nextKind)
    } else if (data.method) {
      nextMethod = data.method
    } else if (data.kind && data.kind !== existing.kind) {
      const wasImplicitDefault = existing.method === defaultPaymentMethodForKind(existing.kind)
      nextMethod = wasImplicitDefault ? defaultPaymentMethodForKind(nextKind) : existing.method
    }

    const nextCategory = nextCategoryId
      ? await tx
          .select({ name: categories.name, kind: categories.kind })
          .from(categories)
          .where(eq(categories.id, nextCategoryId))
          .limit(1)
      : []

    const wasReimbursementIncome =
      existing.kind === 'income' &&
      existing.categoryKind === 'income' &&
      existing.categoryName === 'Remboursements'
    const willBeReimbursementIncome =
      nextKind === 'income' &&
      nextCategory[0]?.kind === 'income' &&
      nextCategory[0]?.name === 'Remboursements'

    const wasReimbursableExpense = existing.kind === 'expense' && existing.reimbursable === 1
    const willBeReimbursableExpense = nextKind === 'expense' && nextReimbursable === 1

    if (wasReimbursementIncome && !willBeReimbursementIncome) {
      await tx
        .delete(reimbursementAllocations)
        .where(eq(reimbursementAllocations.reimbursementTxId, id))
    }

    const updateData: typeof data & { manualSettlementAt?: string | null; cleared?: number; method?: PaymentMethod } = { ...data }
    if (nextMethod) updateData.method = nextMethod
    if (nextKind === 'expense' && nextMethod === 'cash') {
      updateData.cleared = 1
    }
    if (wasReimbursableExpense && !willBeReimbursableExpense) {
      await tx
        .delete(reimbursementAllocations)
        .where(eq(reimbursementAllocations.expenseTxId, id))
      updateData.manualSettlementAt = null
    }

    await tx.update(transactions).set(updateData).where(eq(transactions.id, id))
  })
  revalidateApp()
}

export async function updateTransactionWithRecurringAmountOption(
  id: string,
  data: {
    date?: string
    amount?: number
    kind?: 'expense' | 'income'
    categoryId?: string | null
    merchantId?: string | null
    note?: string | null
    reimbursable?: number
    method?: PaymentMethod
  },
  opts: {
    propagateRecurringAmount?: boolean
  },
) {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: transactions.id,
        date: transactions.date,
        amount: transactions.amount,
        kind: transactions.kind,
        method: transactions.method,
        recurringId: transactions.recurringId,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryKind: categories.kind,
        reimbursable: transactions.reimbursable,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.id, id))
      .limit(1)

    if (!existing) return

    const nextDate = data.date ?? existing.date
    const nextAmount = data.amount ?? existing.amount

    const nextKind = data.kind ?? existing.kind
    const nextCategoryId = data.categoryId === undefined ? existing.categoryId : data.categoryId
    const nextReimbursable = data.reimbursable === undefined ? existing.reimbursable : data.reimbursable

    let nextMethod: PaymentMethod | undefined
    if (existing.recurringId) {
      const r = await tx.query.recurring.findFirst({
        where: (rr, { eq }) => eq(rr.id, existing.recurringId!),
        columns: { method: true },
      })
      nextMethod = (r?.method as PaymentMethod | undefined) ?? defaultPaymentMethodForKind(nextKind)
    } else if (data.method) {
      nextMethod = data.method
    } else if (data.kind && data.kind !== existing.kind) {
      const wasImplicitDefault = existing.method === defaultPaymentMethodForKind(existing.kind)
      nextMethod = wasImplicitDefault ? defaultPaymentMethodForKind(nextKind) : existing.method
    }

    const nextCategory = nextCategoryId
      ? await tx
          .select({ name: categories.name, kind: categories.kind })
          .from(categories)
          .where(eq(categories.id, nextCategoryId))
          .limit(1)
      : []

    const wasReimbursementIncome =
      existing.kind === 'income' &&
      existing.categoryKind === 'income' &&
      existing.categoryName === 'Remboursements'
    const willBeReimbursementIncome =
      nextKind === 'income' &&
      nextCategory[0]?.kind === 'income' &&
      nextCategory[0]?.name === 'Remboursements'

    const wasReimbursableExpense = existing.kind === 'expense' && existing.reimbursable === 1
    const willBeReimbursableExpense = nextKind === 'expense' && nextReimbursable === 1

    if (wasReimbursementIncome && !willBeReimbursementIncome) {
      await tx
        .delete(reimbursementAllocations)
        .where(eq(reimbursementAllocations.reimbursementTxId, id))
    }

    const updateData: typeof data & {
      manualSettlementAt?: string | null
      cleared?: number
      method?: PaymentMethod
      recurringAmountId?: string | null
    } = { ...data }
    if (nextMethod) updateData.method = nextMethod
    if (nextKind === 'expense' && nextMethod === 'cash') {
      updateData.cleared = 1
    }
    if (wasReimbursableExpense && !willBeReimbursableExpense) {
      await tx
        .delete(reimbursementAllocations)
        .where(eq(reimbursementAllocations.expenseTxId, id))
      updateData.manualSettlementAt = null
    }

    if (existing.recurringId) {
      const recurringId = existing.recurringId
      const shouldPropagate =
        !!opts.propagateRecurringAmount &&
        typeof data.amount === 'number' &&
        Math.abs(Number(data.amount) - Number(existing.amount)) > 0.005

      if (shouldPropagate) {
        const entryId = await upsertRecurringAmountEntryTx(tx, {
          recurringId,
          startDate: nextDate,
          amount: nextAmount,
          idFactory: nanoid,
        })
        await syncRecurringEffectiveAmountTx(tx, recurringId)
        updateData.recurringAmountId = entryId
      } else {
        const allEntries = await loadRecurringAmountEntriesTx(tx, recurringId)
        updateData.recurringAmountId = pickEffectiveRecurringAmountEntry(allEntries, nextDate)?.id ?? null
      }
    } else {
      updateData.recurringAmountId = null
    }

    await tx.update(transactions).set(updateData).where(eq(transactions.id, id))
  })

  revalidateApp()
}

export async function deleteTransaction(id: string) {
  await db.transaction(async (tx) => {
    await revertInstanceToExpected(tx, id)
    await tx
      .delete(reimbursementAllocations)
      .where(or(
        eq(reimbursementAllocations.reimbursementTxId, id),
        eq(reimbursementAllocations.expenseTxId, id),
      ))
    await tx.delete(transactions).where(eq(transactions.id, id))
  })
  revalidateApp()
}

export async function clearTransaction(id: string, cleared: boolean) {
  await db.update(transactions).set({ cleared: cleared ? 1 : 0 }).where(eq(transactions.id, id))
  revalidateApp()
}

export async function linkTransactionToRecurring(id: string, recurringId: string) {
  await db.transaction(async (tx) => {
    const r = await tx.query.recurring.findFirst({
      where: (rr, { eq }) => eq(rr.id, recurringId),
      columns: { method: true },
    })
    const method = (r?.method as PaymentMethod | undefined) ?? 'card'

    const t = await tx.query.transactions.findFirst({
      where: (tt, { eq }) => eq(tt.id, id),
      columns: { kind: true, date: true },
    })

    await tx
      .update(transactions)
      .set({
        recurringId,
        method,
        ...(t?.kind === 'expense' && method === 'cash' ? { cleared: 1 } : {}),
      })
      .where(eq(transactions.id, id))

    if (t?.date) {
      await upsertLinkedInstance(tx, recurringId, t.date.slice(0, 7), id)
    }
  })
  revalidateApp()
}

export async function detachTransactionFromRecurring(id: string) {
  await db.transaction(async (tx) => {
    await revertInstanceToExpected(tx, id)
    await tx.update(transactions).set({ recurringId: null }).where(eq(transactions.id, id))
  })
  revalidateApp()
}

export async function bulkLinkTransactionsToRecurring(
  ids: string[],
  recurringId: string,
): Promise<void> {
  if (ids.length === 0) return
  await db.transaction(async (tx) => {
    const r = await tx.query.recurring.findFirst({
      where: (rr, { eq }) => eq(rr.id, recurringId),
      columns: { method: true },
    })
    const method = (r?.method as PaymentMethod | undefined) ?? 'card'

    const txns = await tx
      .select({ id: transactions.id, date: transactions.date })
      .from(transactions)
      .where(inArray(transactions.id, ids))

    await tx.update(transactions).set({ recurringId, method }).where(inArray(transactions.id, ids))
    if (method === 'cash') {
      await tx
        .update(transactions)
        .set({ cleared: 1 })
        .where(and(inArray(transactions.id, ids), eq(transactions.kind, 'expense')))
    }

    for (const t of txns) {
      await upsertLinkedInstance(tx, recurringId, t.date.slice(0, 7), t.id)
    }
  })
  revalidateApp()
}
