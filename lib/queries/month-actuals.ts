import { cache } from 'react'
import { and, gt, gte, inArray, isNull, lte, not } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions } from '@/lib/schema'
import { addMonths, currentMonth, firstDayOfMonth, lastDayOfMonth, todayISO } from '@/lib/dates'

export type PlannedBudgetTxn = { amount: number; kind: 'expense' | 'income' }

/** Expense/income transactions dated after today through the end of the current month. */
export const getPlannedTransactionsToMonthEnd = cache(async (ref: Date = new Date()): Promise<PlannedBudgetTxn[]> => {
  const rows = await db
    .select({ amount: transactions.amount, kind: transactions.kind })
    .from(transactions)
    .where(and(
      inArray(transactions.kind, ['expense', 'income']),
      gt(transactions.date, todayISO(ref)),
      lte(transactions.date, lastDayOfMonth(currentMonth(ref))),
    ))
  return rows.map((r) => ({ amount: Number(r.amount ?? 0), kind: r.kind as 'expense' | 'income' }))
})

export type RecentBudgetTxn = {
  id: string
  date: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string
  merchantId: string | null
  recurringId: string | null
  cleared: number
}

/**
 * Non-planned expense/income transactions from the trailing 12 calendar months (including the
 * current one) — raw rows, feeding the budget waterfall (`budgetWaterfall` in lib/derive.ts) for
 * both the Monthly and Yearly tabs.
 */
export const getRecentTransactionsForBudget = cache(async (ref: Date = new Date()): Promise<RecentBudgetTxn[]> => {
  const since = firstDayOfMonth(addMonths(currentMonth(ref), -11))
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      kind: transactions.kind,
      categoryId: transactions.categoryId,
      merchantId: transactions.merchantId,
      recurringId: transactions.recurringId,
      cleared: transactions.cleared,
    })
    .from(transactions)
    .where(and(
      not(isNull(transactions.categoryId)),
      inArray(transactions.kind, ['expense', 'income']),
      gte(transactions.date, since),
      lte(transactions.date, todayISO(ref)),
    ))

  const out: RecentBudgetTxn[] = []
  for (const r of rows) {
    if (!r.categoryId || (r.kind !== 'expense' && r.kind !== 'income')) continue
    out.push({
      id: r.id,
      date: r.date,
      amount: Number(r.amount ?? 0),
      kind: r.kind,
      categoryId: r.categoryId,
      merchantId: r.merchantId,
      recurringId: r.recurringId,
      cleared: r.cleared,
    })
  }
  return out
})
