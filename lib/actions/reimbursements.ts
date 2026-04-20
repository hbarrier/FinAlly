'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, lte, desc } from 'drizzle-orm'
import { db } from '../db'
import { reimbursementRates, transactions, categories } from '../schema'
import { nanoid } from '../utils'

export async function addReimbursementRate(percent: number, startDate: string) {
  await db.insert(reimbursementRates).values({ id: nanoid(), percent, startDate })
  revalidatePath('/', 'layout')
}

export async function deleteReimbursementRate(id: string) {
  await db.delete(reimbursementRates).where(eq(reimbursementRates.id, id))
  revalidatePath('/', 'layout')
}

// Find the applicable rate for a given expense date
export async function getApplicableRate(expenseDate: string): Promise<number | null> {
  const rate = await db
    .select()
    .from(reimbursementRates)
    .where(lte(reimbursementRates.startDate, expenseDate))
    .orderBy(desc(reimbursementRates.startDate))
    .limit(1)
  return rate[0]?.percent ?? null
}

// Record a reimbursement: creates an income transaction and links it to the expense
export async function recordReimbursement(
  expenseId: string,
  date: string,
  amount: number,
) {
  // Look up the "Remboursements" category
  const reimb = await db
    .select()
    .from(categories)
    .where(and(eq(categories.name, 'Remboursements'), eq(categories.kind, 'income')))
    .limit(1)

  const categoryId = reimb[0]?.id ?? null

  const newTxId = nanoid()
  await db.insert(transactions).values({
    id: newTxId,
    date,
    amount,
    kind: 'income',
    categoryId,
    note: 'Remboursement',
  })

  await db
    .update(transactions)
    .set({ reimbursementTxId: newTxId })
    .where(eq(transactions.id, expenseId))

  revalidatePath('/', 'layout')
}

// Delete a reimbursement: removes the income transaction and unlinks from the expense
export async function deleteReimbursement(expenseId: string) {
  const expense = await db
    .select({ reimbursementTxId: transactions.reimbursementTxId })
    .from(transactions)
    .where(eq(transactions.id, expenseId))
    .limit(1)

  const txId = expense[0]?.reimbursementTxId
  if (txId) {
    await db.delete(transactions).where(eq(transactions.id, txId))
  }

  await db
    .update(transactions)
    .set({ reimbursementTxId: null })
    .where(eq(transactions.id, expenseId))

  revalidatePath('/', 'layout')
}
