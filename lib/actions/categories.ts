'use server'

import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { categories } from '../schema'
import { nanoid } from '../utils'
import { eq } from 'drizzle-orm'

export async function addCategory(data: {
  name: string
  icon: string
  color: string
  kind: 'expense' | 'income'
}) {
  await db.insert(categories).values({ id: nanoid(), ...data })
  revalidatePath('/', 'layout')
}

export async function updateCategory(
  id: string,
  data: Partial<{ name: string; icon: string; color: string; kind: 'expense' | 'income' }>,
) {
  await db.update(categories).set(data).where(eq(categories.id, id))
  revalidatePath('/', 'layout')
}

export async function deleteCategory(id: string) {
  await db.delete(categories).where(eq(categories.id, id))
  revalidatePath('/', 'layout')
}
