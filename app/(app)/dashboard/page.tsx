import { db } from '@/lib/db'
import { and, desc, gte, lt } from 'drizzle-orm'
import { transactions } from '@/lib/schema'
import { DashboardClient } from './dashboard-client'
import { getUserSettings } from '@/lib/queries/user-settings'
import { getMonthOpeningBalance } from '@/lib/queries/opening-balance'

export default async function DashboardPage() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const monthKey = `${yyyy}-${mm}` // local calendar month
  const monthStart = `${monthKey}-01`
  const nextMonthDate = new Date(yyyy, now.getMonth() + 1, 1)
  const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`
  const nextMonthStart = `${nextMonthKey}-01`

  const [settings, monthTxns, recurringItems, cats, merchantsList] =
    await Promise.all([
      getUserSettings(),
      db.query.transactions.findMany({
        where: and(
          gte(transactions.date, monthStart),
          lt(transactions.date, nextMonthStart),
        ),
        orderBy: [desc(transactions.createdAt)],
      }),
      db.query.recurring.findMany(),
      db.query.categories.findMany(),
      db.query.merchants.findMany(),
    ])

  const fallbackSettings = { id: 1, name: 'You', startingBalance: 0, currency: 'EUR' }
  const effectiveSettings = settings ?? fallbackSettings

  const { openingBalance, openingBalanceIsExplicit } = await getMonthOpeningBalance({
    monthKey,
    monthStart,
    startingBalance: Number(effectiveSettings.startingBalance ?? 0),
  })

  return (
    <DashboardClient
      settings={effectiveSettings}
      monthTransactions={monthTxns}
      monthKey={monthKey}
      monthStart={monthStart}
      openingBalance={openingBalance}
      openingBalanceIsExplicit={openingBalanceIsExplicit}
      recurring={recurringItems}
      categories={cats}
      merchants={merchantsList}
    />
  )
}
