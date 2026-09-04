import { cache } from 'react'
import { and, isNull, lte, not, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions } from '@/lib/schema'
import { currentMonth, todayISO } from '@/lib/dates'

export type MonthActuals = {
  expense: Record<string, number>
  income: Record<string, number>
}

/**
 * Current-month non-planned actuals per category, split by kind — aggregated in
 * SQL. Mirrors `monthActualByCategory` from lib/derive.ts.
 */
export const getCurrentMonthActuals = cache(async (): Promise<MonthActuals> => {
  const rows = await db
    .select({
      kind: transactions.kind,
      categoryId: transactions.categoryId,
      total: sql<number>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(and(
      not(isNull(transactions.categoryId)),
      sql`substr(${transactions.date}, 1, 7) = ${currentMonth()}`,
      lte(transactions.date, todayISO()),
    ))
    .groupBy(transactions.kind, transactions.categoryId)

  const out: MonthActuals = { expense: {}, income: {} }
  for (const r of rows) {
    if (r.categoryId && r.kind !== 'saving') out[r.kind][r.categoryId] = Number(r.total ?? 0)
  }
  return out
})
