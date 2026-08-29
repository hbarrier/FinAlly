'use server'

import { revalidateApp } from './_shared'
import { eq, and, ne, inArray } from 'drizzle-orm'
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
import { nanoid, REIMBURSEMENT_CATEGORY_NAME } from '../utils'
import { parse, zId, zDateISO } from '../schemas'
import { z } from 'zod'

const zPercent = z.number().finite().gt(0).max(100)

export async function addReimbursementRate(percent: number, startDate: string) {
  parse(zPercent, percent)
  parse(zDateISO, startDate)
  await db.insert(reimbursementRates).values({ id: nanoid(), percent, startDate })
  revalidateApp()
}

export async function updateReimbursementRate(id: string, percent: number, startDate: string) {
  parse(zId, id)
  parse(zPercent, percent)
  parse(zDateISO, startDate)
  await db.update(reimbursementRates).set({ percent, startDate }).where(eq(reimbursementRates.id, id))
  revalidateApp()
}

export async function deleteReimbursementRate(id: string) {
  parse(zId, id)
  await db.delete(reimbursementRates).where(eq(reimbursementRates.id, id))
  revalidateApp()
}

export async function setExpenseManualSettlement(expenseTxId: string, settled: boolean) {
  parse(zId, expenseTxId)
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
  parse(zId, reimbursementTxId)
  parse(z.array(zId), expenseTxIds)
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
      income.categoryName !== REIMBURSEMENT_CATEGORY_NAME ||
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
