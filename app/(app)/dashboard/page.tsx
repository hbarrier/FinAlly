import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Dashboard | FinAlly' }
import { and, asc, gte, lt } from 'drizzle-orm'
import { transactions } from '@/lib/schema'
import { DashboardClient } from './dashboard-client'
import { getUserSettings } from '@/lib/queries/user-settings'
import { getMonthOpeningBalance } from '@/lib/queries/opening-balance'

export default async function DashboardPage() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const monthKey = `${yyyy}-${mm}`
  const monthStart = `${monthKey}-01`
  const nextMonthDate = new Date(yyyy, now.getMonth() + 1, 1)
  const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`
  const nextMonthStart = `${nextMonthKey}-01`

  const histDate = new Date(yyyy - 5, now.getMonth(), 1)
  const histMonthKey = `${histDate.getFullYear()}-${String(histDate.getMonth() + 1).padStart(2, '0')}`
  const histStart = `${histMonthKey}-01`

  const [settings, allTxns, recurringItems, cats, merchantsList] = await Promise.all([
    getUserSettings(),
    db.query.transactions.findMany({
      where: and(gte(transactions.date, histStart), lt(transactions.date, nextMonthStart)),
      orderBy: [asc(transactions.date), asc(transactions.createdAt)],
    }),
    db.query.recurring.findMany(),
    db.query.categories.findMany(),
    db.query.merchants.findMany(),
  ])

  const fallbackSettings = { id: 1, name: 'You', startingBalance: 0, currency: 'EUR' }
  const effectiveSettings = settings ?? fallbackSettings
  const startingBalance = Number(effectiveSettings.startingBalance ?? 0)

  const [{ openingBalance, openingBalanceIsExplicit }, { openingBalance: histOpeningBalance }] =
    await Promise.all([
      getMonthOpeningBalance({ monthKey, monthStart, startingBalance }),
      getMonthOpeningBalance({ monthKey: histMonthKey, monthStart: histStart, startingBalance }),
    ])

  return (
    <DashboardClient
      allTransactions={allTxns}
      monthKey={monthKey}
      monthStart={monthStart}
      openingBalance={openingBalance}
      openingBalanceIsExplicit={openingBalanceIsExplicit}
      histStartDate={histStart}
      histOpeningBalance={histOpeningBalance}
      recurring={recurringItems}
      categories={cats}
      merchants={merchantsList}
    />
  )
}
