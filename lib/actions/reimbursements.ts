'use server'

import { revalidateApp } from './_shared'
import { eq, and, lte, desc } from 'drizzle-orm'
import { db } from '../db'
import { reimbursementRates, transactions, categories } from '../schema'
import { nanoid } from '../utils'

export async function addReimbursementRate(percent: number, startDate: string) {
  await db.insert(reimbursementRates).values({ id: nanoid(), percent, startDate })
  revalidateApp()
}

export async function updateReimbursementRate(id: string, percent: number, startDate: string) {
  await db.update(reimbursementRates).set({ percent, startDate }).where(eq(reimbursementRates.id, id))
  revalidateApp()
}

export async function deleteReimbursementRate(id: string) {
  await db.delete(reimbursementRates).where(eq(reimbursementRates.id, id))
  revalidateApp()
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

async function findReimbursementCategoryId(
  client: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string | null> {
  const rows = await client
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.name, 'Remboursements'), eq(categories.kind, 'income')))
    .limit(1)
  return rows[0]?.id ?? null
}

// Record a reimbursement: creates an income transaction and links it to the expense
export async function recordReimbursement(
  expenseId: string,
  date: string,
  amount: number,
  claimedDate: string | null,
) {
  await db.transaction(async (tx) => {
    const categoryId = await findReimbursementCategoryId(tx)
    const newTxId = nanoid()
    await tx.insert(transactions).values({
      id: newTxId,
      date,
      amount,
      kind: 'income',
      categoryId,
      note: 'Remboursement',
    })
    await tx
      .update(transactions)
      .set({ reimbursementTxId: newTxId, claimedDate })
      .where(eq(transactions.id, expenseId))
  })
  revalidateApp()
}

// Delete a reimbursement: removes the income transaction and unlinks from the expense
export async function deleteReimbursement(expenseId: string) {
  await db.transaction(async (tx) => {
    const expense = await tx
      .select({ reimbursementTxId: transactions.reimbursementTxId })
      .from(transactions)
      .where(eq(transactions.id, expenseId))
      .limit(1)

    const txId = expense[0]?.reimbursementTxId
    if (txId) {
      await tx.delete(transactions).where(eq(transactions.id, txId))
    }

    await tx
      .update(transactions)
      .set({ reimbursementTxId: null })
      .where(eq(transactions.id, expenseId))
  })
  revalidateApp()
}
