'use server'

import { revalidateApp } from './_shared'
import { db } from '../db'
import { budgets } from '../schema'
import { nanoid } from '../utils'
import { eq } from 'drizzle-orm'

export async function upsertBudget(categoryId: string, limitAmount: number) {
  await db
    .insert(budgets)
    .values({ id: nanoid(), categoryId, limitAmount })
    .onConflictDoUpdate({
      target: budgets.categoryId,
      set: { limitAmount },
    })
  revalidateApp()
}

export async function deleteBudget(categoryId: string) {
  await db.delete(budgets).where(eq(budgets.categoryId, categoryId))
  revalidateApp()
}
