'use server'

import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { merchants, transactions } from '../schema'
import { nanoid } from '../utils'
import { eq, inArray } from 'drizzle-orm'

export async function addMerchant(data: {
  name: string
  comment?: string | null
  categoryId?: string | null
}) {
  await db.insert(merchants).values({ id: nanoid(), ...data })
  revalidatePath('/', 'layout')
}

export async function updateMerchant(
  id: string,
  data: Partial<{ name: string; comment: string | null; categoryId: string | null; isActive: number }>,
) {
  await db.update(merchants).set(data).where(eq(merchants.id, id))
  revalidatePath('/', 'layout')
}

export async function deleteMerchant(id: string) {
  await db.delete(merchants).where(eq(merchants.id, id))
  revalidatePath('/', 'layout')
}

export async function mergeMerchants(keepId: string, mergeIds: string[]) {
  await db.update(transactions).set({ merchantId: keepId }).where(inArray(transactions.merchantId, mergeIds))
  await db.delete(merchants).where(inArray(merchants.id, mergeIds))
  revalidatePath('/', 'layout')
}
