import { db } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { transactions } from '@/lib/schema'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const [settings, txns, recurringItems, cats] = await Promise.all([
    db.query.userSettings.findFirst(),
    db.query.transactions.findMany({ orderBy: [desc(transactions.createdAt)] }),
    db.query.recurring.findMany(),
    db.query.categories.findMany(),
  ])

  return (
    <DashboardClient
      settings={settings ?? { id: 1, name: 'You', startingBalance: 0, currency: 'EUR' }}
      transactions={txns}
      recurring={recurringItems}
      categories={cats}
    />
  )
}
