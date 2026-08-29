'use server'

import { revalidateApp } from './_shared'
import { db } from '../db'
import { merchants, transactions, recurring, budgetLines, simulationLines } from '../schema'
import { nanoid } from '../utils'
import { and, eq, inArray, isNull } from 'drizzle-orm'

export async function addMerchant(data: {
  name: string
  comment?: string | null
  categoryId?: string | null
}) {
  await db.insert(merchants).values({ id: nanoid(), ...data })
  revalidateApp()
}

export async function updateMerchant(
  id: string,
  data: Partial<{ name: string; comment: string | null; categoryId: string | null; isActive: number }>,
) {
  await db.transaction(async (tx) => {
    await tx.update(merchants).set(data).where(eq(merchants.id, id))

    // If the merchant gets a category, backfill existing uncategorized movements.
    if ('categoryId' in data && data.categoryId) {
      await tx
        .update(transactions)
        .set({ categoryId: data.categoryId })
        .where(and(eq(transactions.merchantId, id), isNull(transactions.categoryId)))
    }
  })
  revalidateApp()
}

export async function deleteMerchant(id: string) {
  await db.delete(merchants).where(eq(merchants.id, id))
  revalidateApp()
}

export async function mergeMerchants(keepId: string, mergeIds: string[]) {
  const toMerge = mergeIds.filter((id) => id !== keepId)
  if (toMerge.length === 0) return

  await db.transaction(async (tx) => {
    // Repoint every table that references a merchant, not just transactions.
    for (const table of [transactions, recurring, budgetLines, simulationLines]) {
      await tx
        .update(table)
        .set({ merchantId: keepId })
        .where(inArray(table.merchantId, toMerge))
    }
    await tx.delete(merchants).where(inArray(merchants.id, toMerge))
  })
  revalidateApp()
}
