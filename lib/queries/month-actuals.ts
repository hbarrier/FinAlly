import { cache } from 'react'
import { and, gte, inArray, isNull, lte, not } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions } from '@/lib/schema'
import { addMonths, currentMonth, firstDayOfMonth, todayISO } from '@/lib/dates'

export type RecentBudgetTxn = {
  id: string
  date: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string
  merchantId: string | null
  recurringId: string | null
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
    })
  }
  return out
})
