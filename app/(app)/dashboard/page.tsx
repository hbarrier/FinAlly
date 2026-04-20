import { db } from '@/lib/db'
import { desc, gte, sql } from 'drizzle-orm'
import { transactions } from '@/lib/schema'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
    .toISOString()
    .slice(0, 10)

  const [settings, monthTxns, balanceRow, recurringItems, cats, merchantsList] =
    await Promise.all([
      db.query.userSettings.findFirst(),
      db.query.transactions.findMany({
        where: gte(transactions.date, monthStart),
        orderBy: [desc(transactions.createdAt)],
      }),
      db
        .select({
          delta: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.kind} = 'income' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`,
        })
        .from(transactions)
        .then((rows) => rows[0]),
      db.query.recurring.findMany(),
      db.query.categories.findMany(),
      db.query.merchants.findMany(),
    ])

  const fallbackSettings = { id: 1, name: 'You', startingBalance: 0, currency: 'EUR' }
  const effectiveSettings = settings ?? fallbackSettings
  const balance = effectiveSettings.startingBalance + (balanceRow?.delta ?? 0)

  return (
    <DashboardClient
      settings={effectiveSettings}
      monthTransactions={monthTxns}
      balance={balance}
      recurring={recurringItems}
      categories={cats}
      merchants={merchantsList}
    />
  )
}
