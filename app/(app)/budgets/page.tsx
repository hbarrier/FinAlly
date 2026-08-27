import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Budgets | FinAlly' }
import { desc } from 'drizzle-orm'
import { transactions } from '@/lib/schema'
import { BudgetsClient } from './budgets-client'
import { requireModule } from '@/lib/modules'

export default async function BudgetsPage() {
  await requireModule('budgets')
  const [cats, budgetsList, txns] = await Promise.all([
    db.query.categories.findMany(),
    db.query.budgets.findMany(),
    db.query.transactions.findMany({
      columns: { id: true, categoryId: true, kind: true, amount: true, date: true },
      orderBy: [desc(transactions.date)],
    }),
  ])
  return <BudgetsClient categories={cats} budgets={budgetsList} transactions={txns} />
}
