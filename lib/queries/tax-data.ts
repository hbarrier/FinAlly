import { cache } from 'react'
import { db } from '@/lib/db'
import {
  categories,
  merchants,
  transactions,
  reimbursementAllocations,
  taxAllocations,
} from '@/lib/schema'
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { TaxAllocationValue } from '@/lib/db-types'

export type TaxExpenseRow = {
  id: string
  date: string
  amount: number
  merchantName: string | null
  categoryName: string | null
  note: string | null
  allocation: TaxAllocationValue | null
}

export type TaxExpenseContext = {
  expenseTxId: string
  amount: number
  merchantName: string | null
  expenseNote: string | null
}

export type TaxIncomeRow = {
  id: string
  date: string
  amount: number
  type: 'reimbursement' | 'pension'
  note: string | null
  allocation: TaxAllocationValue | null
  coveredExpenses: TaxExpenseContext[]
}

export const getAvailableTaxYears = cache(async (): Promise<string[]> => {
  const cats = await db.select().from(categories)
  const qualifyingIds = cats
    .filter(
      (c) =>
        c.kind === 'income' &&
        (c.name === 'Remboursements' || c.isPensionAlimentaire === 1),
    )
    .map((c) => c.id)

  if (qualifyingIds.length === 0) return []

  const rows = await db
    .selectDistinct({ year: sql<string>`substr(${transactions.date}, 1, 4)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.kind, 'income'),
        inArray(transactions.categoryId, qualifyingIds),
      ),
    )
    .orderBy(desc(sql`substr(${transactions.date}, 1, 4)`))

  return rows.map((r) => r.year)
})

export const getTaxData = cache(async (year: number): Promise<TaxIncomeRow[]> => {
  const from = `${year}-01-01`
  const to = `${year}-12-31`

  // Step 1: qualifying category ids
  const cats = await db.select().from(categories)
  const reimbursementCategoryIds = new Set(
    cats.filter((c) => c.kind === 'income' && c.name === 'Remboursements').map((c) => c.id),
  )
  const pensionCategoryIds = new Set(
    cats.filter((c) => c.kind === 'income' && c.isPensionAlimentaire === 1).map((c) => c.id),
  )
  const qualifyingIds = [
    ...reimbursementCategoryIds,
    ...pensionCategoryIds,
  ]
  if (qualifyingIds.length === 0) return []

  // Step 2: qualifying income transactions for the year
  const incomeTxns = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.kind, 'income'),
        gte(transactions.date, from),
        lte(transactions.date, to),
        inArray(transactions.categoryId, qualifyingIds),
      ),
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt))

  if (incomeTxns.length === 0) return []

  const incomeIds = incomeTxns.map((t) => t.id)

  // Step 3: reimbursement allocations for these income transactions
  const allocRows = await db
    .select()
    .from(reimbursementAllocations)
    .where(inArray(reimbursementAllocations.reimbursementTxId, incomeIds))

  // Step 4: expense transactions for context labels
  const expenseIds = [...new Set(allocRows.map((a) => a.expenseTxId))]
  const expenseTxns =
    expenseIds.length > 0
      ? await db
          .select({
            id: transactions.id,
            note: transactions.note,
            merchantId: transactions.merchantId,
          })
          .from(transactions)
          .where(inArray(transactions.id, expenseIds))
      : []

  // Step 5: merchants
  const merchantIds = [
    ...new Set(
      expenseTxns.map((e) => e.merchantId).filter((id): id is string => id !== null),
    ),
  ]
  const merchantsList =
    merchantIds.length > 0
      ? await db
          .select({ id: merchants.id, name: merchants.name })
          .from(merchants)
          .where(inArray(merchants.id, merchantIds))
      : []
  const merchantById = new Map(merchantsList.map((m) => [m.id, m.name]))

  // Step 6: tax allocations
  const taxAllocRows = await db
    .select()
    .from(taxAllocations)
    .where(inArray(taxAllocations.transactionId, incomeIds))
  const taxAllocByTxId = new Map(taxAllocRows.map((r) => [r.transactionId, r.allocation as TaxAllocationValue]))

  // Step 7: assemble
  const expenseTxById = new Map(expenseTxns.map((e) => [e.id, e]))
  const reimbAllocByIncome = new Map<string, typeof allocRows>()
  for (const a of allocRows) {
    const bucket = reimbAllocByIncome.get(a.reimbursementTxId) ?? []
    bucket.push(a)
    reimbAllocByIncome.set(a.reimbursementTxId, bucket)
  }

  return incomeTxns.map((tx) => {
    const isReimbursement = tx.categoryId !== null && reimbursementCategoryIds.has(tx.categoryId)
    const coveredExpenses: TaxExpenseContext[] = (reimbAllocByIncome.get(tx.id) ?? []).map(
      (a) => {
        const expense = expenseTxById.get(a.expenseTxId)
        return {
          expenseTxId: a.expenseTxId,
          amount: a.amount,
          merchantName: expense?.merchantId ? (merchantById.get(expense.merchantId) ?? null) : null,
          expenseNote: expense?.note ?? null,
        }
      },
    )
    return {
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      type: isReimbursement ? 'reimbursement' : 'pension',
      note: tx.note,
      allocation: taxAllocByTxId.get(tx.id) ?? null,
      coveredExpenses,
    }
  })
})

export const getExpenseTaxData = cache(async (year: number): Promise<TaxExpenseRow[]> => {
  const from = `${year}-01-01`
  const to = `${year}-12-31`

  const expenses = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      note: transactions.note,
      merchantId: transactions.merchantId,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(and(eq(transactions.reimbursable, 1), gte(transactions.date, from), lte(transactions.date, to)))
    .orderBy(transactions.date)

  if (expenses.length === 0) return []

  const expenseIds = expenses.map((e) => e.id)

  const [taxAllocRows, merchantsList, cats] = await Promise.all([
    db.select().from(taxAllocations).where(inArray(taxAllocations.transactionId, expenseIds)),
    db.select({ id: merchants.id, name: merchants.name }).from(merchants),
    db.select({ id: categories.id, name: categories.name }).from(categories),
  ])

  const taxAllocMap = new Map(taxAllocRows.map((r) => [r.transactionId, r.allocation as TaxAllocationValue]))
  const merchantById = new Map(merchantsList.map((m) => [m.id, m.name]))
  const categoryById = new Map(cats.map((c) => [c.id, c.name]))

  return expenses.map((e) => ({
    id: e.id,
    date: e.date,
    amount: e.amount,
    merchantName: e.merchantId ? (merchantById.get(e.merchantId) ?? null) : null,
    categoryName: e.categoryId ? (categoryById.get(e.categoryId) ?? null) : null,
    note: e.note,
    allocation: taxAllocMap.get(e.id) ?? null,
  }))
})
