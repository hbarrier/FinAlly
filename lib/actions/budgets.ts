'use server'

import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { budgets } from '../schema'
import { nanoid } from '../utils'
import { eq } from 'drizzle-orm'

export async function upsertBudget(categoryId: string, limitAmount: number) {
  const existing = await db.query.budgets.findFirst({
    where: eq(budgets.categoryId, categoryId),
  })
  if (existing) {
    await db.update(budgets).set({ limitAmount }).where(eq(budgets.categoryId, categoryId))
  } else {
    await db.insert(budgets).values({ id: nanoid(), categoryId, limitAmount })
  }
  revalidatePath('/', 'layout')
}

export async function deleteBudget(categoryId: string) {
  await db.delete(budgets).where(eq(budgets.categoryId, categoryId))
  revalidatePath('/', 'layout')
}
