'use server'

import { db } from '../db'
import { categories, reimbursementAllocations, transactions } from '../schema'
import { nanoid } from '../utils'
import { eq, inArray, or } from 'drizzle-orm'
import { revalidateApp } from './_shared'

export async function addTransaction(data: {
  date: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string | null
  merchantId?: string | null
  note?: string | null
  recurringId?: string | null
  reimbursable?: number
  cleared?: number
}) {
  await db.insert(transactions).values({ id: nanoid(), ...data })
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
  },
) {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: transactions.id,
        kind: transactions.kind,
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

    const updateData: typeof data & { manualSettlementAt?: string | null } = { ...data }
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

export async function deleteTransaction(id: string) {
  await db.transaction(async (tx) => {
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
  await db.update(transactions).set({ recurringId }).where(eq(transactions.id, id))
  revalidateApp()
}

export async function detachTransactionFromRecurring(id: string) {
  await db.update(transactions).set({ recurringId: null }).where(eq(transactions.id, id))
  revalidateApp()
}

export async function bulkLinkTransactionsToRecurring(
  ids: string[],
  recurringId: string,
): Promise<void> {
  if (ids.length === 0) return
  await db.update(transactions).set({ recurringId }).where(inArray(transactions.id, ids))
  revalidateApp()
}
