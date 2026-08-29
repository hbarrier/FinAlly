import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Budget | FinAlly' }
import { desc, eq } from 'drizzle-orm'
import { transactions, merchants } from '@/lib/schema'
import { BudgetsClient } from './budgets-client'
import { requireModule } from '@/lib/modules'

export default async function BudgetsPage() {
  await requireModule('budgets')
  const [cats, merchantsList, budget, txns] = await Promise.all([
    db.query.categories.findMany(),
    db.query.merchants.findMany({ where: eq(merchants.isActive, 1) }),
    db.query.budgets.findFirst({ with: { lines: true } }),
    db.query.transactions.findMany({
      columns: { id: true, categoryId: true, merchantId: true, kind: true, amount: true, date: true, recurringId: true },
      orderBy: [desc(transactions.date)],
    }),
  ])

  return (
    <BudgetsClient
      categories={cats}
      merchants={merchantsList}
      budget={budget ?? null}
      transactions={txns}
    />
  )
}
