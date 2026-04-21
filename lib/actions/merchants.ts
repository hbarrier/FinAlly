'use server'

import { revalidateApp } from './_shared'
import { db } from '../db'
import { merchants, transactions } from '../schema'
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
  await db.transaction(async (tx) => {
    await tx
      .update(transactions)
      .set({ merchantId: keepId })
      .where(inArray(transactions.merchantId, mergeIds))
    await tx.delete(merchants).where(inArray(merchants.id, mergeIds))
  })
  revalidateApp()
}
