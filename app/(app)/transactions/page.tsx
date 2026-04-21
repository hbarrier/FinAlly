import { db } from '@/lib/db'
import { desc, eq, sql } from 'drizzle-orm'
import { transactions, merchants } from '@/lib/schema'
import { TransactionsClient } from './transactions-client'

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ merchant?: string; year?: string }> }) {
  const { merchant, year } = await searchParams

  const currentYear = new Date().getFullYear()
  const selectedYear = year ? parseInt(year, 10) : currentYear
  const yearStart = `${selectedYear}-01-01`
  const yearEnd = `${selectedYear}-12-31`

  const [txns, cats, merchantsList, recurringList, yearsResult] = await Promise.all([
    db.query.transactions.findMany({
      where: (t, { and, gte, lte }) => and(gte(t.date, yearStart), lte(t.date, yearEnd)),
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    }),
    db.query.categories.findMany(),
    db.query.merchants.findMany({ where: eq(merchants.isActive, 1) }),
    db.query.recurring.findMany(),
    db.select({ year: sql<string>`substr(${transactions.date}, 1, 4)` })
      .from(transactions)
      .groupBy(sql`substr(${transactions.date}, 1, 4)`)
      .orderBy(sql`substr(${transactions.date}, 1, 4) DESC`),
  ])

  const years = yearsResult.map((r) => r.year)

  return (
    <TransactionsClient
      transactions={txns}
      categories={cats}
      merchants={merchantsList}
      recurring={recurringList}
      initialMerchantId={merchant ?? 'all'}
      selectedYear={selectedYear}
      years={years}
    />
  )
}
