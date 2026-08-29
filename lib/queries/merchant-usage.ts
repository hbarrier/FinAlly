import { cache } from 'react'
import { isNull, not, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions } from '@/lib/schema'

/**
 * Transaction count per merchant id, aggregated in SQL instead of shipping every
 * `{ id, merchantId }` row to the client.
 */
export const getMerchantUsage = cache(async (): Promise<Record<string, number>> => {
  const rows = await db
    .select({ merchantId: transactions.merchantId, n: sql<number>`count(*)` })
    .from(transactions)
    .where(not(isNull(transactions.merchantId)))
    .groupBy(transactions.merchantId)

  const usage: Record<string, number> = {}
  for (const r of rows) if (r.merchantId) usage[r.merchantId] = Number(r.n)
  return usage
})
