import { cache } from 'react'
import { and, eq, isNull, lte, not, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions } from '@/lib/schema'
import { currentMonth, todayISO } from '@/lib/dates'

export type CategoryStats = {
  /** transaction count per category id */
  usage: Record<string, number>
  /** current-month non-planned expense spend per category id */
  monthSpend: Record<string, number>
}

/**
 * Per-category transaction counts + this-month expense spend, aggregated in SQL
 * instead of shipping the whole transactions table to the client.
 */
export const getCategoryStats = cache(async (): Promise<CategoryStats> => {
  const month = currentMonth()
  const today = todayISO()

  const [usageRows, spendRows] = await Promise.all([
    db
      .select({ categoryId: transactions.categoryId, n: sql<number>`count(*)` })
      .from(transactions)
      .where(not(isNull(transactions.categoryId)))
      .groupBy(transactions.categoryId),
    db
      .select({ categoryId: transactions.categoryId, total: sql<number>`sum(${transactions.amount})` })
      .from(transactions)
      .where(and(
        eq(transactions.kind, 'expense'),
        not(isNull(transactions.categoryId)),
        sql`substr(${transactions.date}, 1, 7) = ${month}`,
        lte(transactions.date, today), // exclude planned (future-dated) rows
      ))
      .groupBy(transactions.categoryId),
  ])

  const usage: Record<string, number> = {}
  for (const r of usageRows) if (r.categoryId) usage[r.categoryId] = Number(r.n)

  const monthSpend: Record<string, number> = {}
  for (const r of spendRows) if (r.categoryId) monthSpend[r.categoryId] = Number(r.total ?? 0)

  return { usage, monthSpend }
})
