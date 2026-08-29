'use server'

import { revalidateApp } from './_shared'
import { db } from '../db'
import { categories, transactions } from '../schema'
import { nanoid, REIMBURSEMENT_CATEGORY_NAME } from '../utils'
import { eq } from 'drizzle-orm'

/** Special categories the reimbursements / divorce modules depend on. */
function isProtected(cat: { name: string; isPensionAlimentaire: number }) {
  return cat.isPensionAlimentaire === 1 || cat.name === REIMBURSEMENT_CATEGORY_NAME
}

export async function addCategory(data: {
  name: string
  icon: string
  color: string
  kind: 'expense' | 'income'
}) {
  await db.insert(categories).values({ id: nanoid(), ...data })
  revalidateApp()
}

export async function updateCategory(
  id: string,
  data: Partial<{ name: string; icon: string; color: string; kind: 'expense' | 'income' }>,
) {
  await db.update(categories).set(data).where(eq(categories.id, id))
  revalidateApp()
}

export async function setCategoryActive(id: string, isActive: boolean) {
  const cat = await db.query.categories.findFirst({ where: eq(categories.id, id) })
  if (!cat) throw new Error('Category not found')
  if (!isActive && isProtected(cat)) {
    throw new Error('This category is required by other features and cannot be deactivated.')
  }
  await db.update(categories).set({ isActive: isActive ? 1 : 0 }).where(eq(categories.id, id))
  revalidateApp()
}

export async function deleteCategory(id: string) {
  const cat = await db.query.categories.findFirst({ where: eq(categories.id, id) })
  if (!cat) return
  if (isProtected(cat)) {
    throw new Error('This category is required by other features and cannot be deleted.')
  }
  const used = await db.query.transactions.findFirst({
    where: eq(transactions.categoryId, id),
    columns: { id: true },
  })
  if (used) {
    throw new Error('Category has transactions — deactivate it instead.')
  }
  await db.delete(categories).where(eq(categories.id, id))
  revalidateApp()
}
