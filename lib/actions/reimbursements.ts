'use server'

import { revalidateApp } from './_shared'
import { eq, and, lte, desc, ne, inArray } from 'drizzle-orm'
import { db } from '../db'
import {
  reimbursementAllocations,
  reimbursementRates,
  transactions,
  categories,
} from '../schema'
import {
  calculateReimbursementAllocations,
  getExpectedReimbursementAmount,
} from '../reimbursement-mapping'
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

export async function setExpenseManualSettlement(expenseTxId: string, settled: boolean) {
  const [expense] = await db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      reimbursable: transactions.reimbursable,
    })
    .from(transactions)
    .where(eq(transactions.id, expenseTxId))
    .limit(1)

  if (!expense || expense.kind !== 'expense' || expense.reimbursable !== 1) {
    throw new Error('Only reimbursable expenses can be manually settled.')
  }

  await db
    .update(transactions)
    .set({ manualSettlementAt: settled ? new Date().toISOString() : null })
    .where(eq(transactions.id, expenseTxId))

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

export async function mapReimbursementIncomeToExpense(
  reimbursementTxId: string,
  expenseTxId: string,
) {
  await mapReimbursementIncomeToExpenses(reimbursementTxId, [expenseTxId])
}

export async function mapReimbursementIncomeToExpenses(
  reimbursementTxId: string,
  expenseTxIds: string[],
) {
  await db.transaction(async (tx) => {
    const uniqueExpenseTxIds = [...new Set(expenseTxIds)]

    const [income] = await tx
      .select({
        id: transactions.id,
        date: transactions.date,
        amount: transactions.amount,
        kind: transactions.kind,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryKind: categories.kind,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.id, reimbursementTxId))
      .limit(1)

    if (
      !income ||
      income.kind !== 'income' ||
      income.categoryName !== 'Remboursements' ||
      income.categoryKind !== 'income'
    ) {
      throw new Error('Only reimbursement income transactions can be mapped.')
    }

    if (uniqueExpenseTxIds.length === 0) {
      await tx
        .delete(reimbursementAllocations)
        .where(eq(reimbursementAllocations.reimbursementTxId, reimbursementTxId))
      return
    }

    const selectedExpenses = await tx
      .select({
        id: transactions.id,
        date: transactions.date,
        amount: transactions.amount,
        kind: transactions.kind,
        reimbursable: transactions.reimbursable,
      })
      .from(transactions)
      .where(inArray(transactions.id, uniqueExpenseTxIds))

    if (selectedExpenses.length !== uniqueExpenseTxIds.length) {
      throw new Error('One or more selected expenses could not be found.')
    }

    if (selectedExpenses.some((expense) => expense.kind !== 'expense' || expense.reimbursable !== 1)) {
      throw new Error('Only reimbursable expense transactions can be mapped.')
    }

    if (selectedExpenses.some((expense) => expense.date > income.date)) {
      throw new Error('A reimbursement cannot be mapped to a future expense.')
    }

    const rates = await tx.select().from(reimbursementRates)
    if (selectedExpenses.some((expense) => getExpectedReimbursementAmount(expense, rates) == null)) {
      throw new Error('No reimbursement rate applies to this expense date.')
    }

    const existingExpenseAllocations = await tx
      .select({
        expenseTxId: reimbursementAllocations.expenseTxId,
        amount: reimbursementAllocations.amount,
      })
      .from(reimbursementAllocations)
      .where(and(
        inArray(reimbursementAllocations.expenseTxId, uniqueExpenseTxIds),
        ne(reimbursementAllocations.reimbursementTxId, reimbursementTxId),
      ))

    const allocationsByExpenseId = new Map<string, { amount: number }[]>()
    for (const allocation of existingExpenseAllocations) {
      const expenseAllocations = allocationsByExpenseId.get(allocation.expenseTxId) ?? []
      expenseAllocations.push({ amount: allocation.amount })
      allocationsByExpenseId.set(allocation.expenseTxId, expenseAllocations)
    }

    const allocationsToSave = calculateReimbursementAllocations(
      income,
      selectedExpenses.map((expense) => ({
        ...expense,
        existingAllocations: allocationsByExpenseId.get(expense.id) ?? [],
      })),
      rates,
    )

    await tx
      .delete(reimbursementAllocations)
      .where(eq(reimbursementAllocations.reimbursementTxId, reimbursementTxId))

    await tx.insert(reimbursementAllocations).values(
      allocationsToSave.map((allocation) => ({
        id: nanoid(),
        reimbursementTxId,
        expenseTxId: allocation.expenseTxId,
        amount: allocation.amount,
      })),
    )
  })

  revalidateApp()
}
