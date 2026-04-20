import { db } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { transactions } from '@/lib/schema'
import { BudgetsClient } from './budgets-client'

export default async function BudgetsPage() {
  const [cats, budgetsList, txns] = await Promise.all([
    db.query.categories.findMany(),
    db.query.budgets.findMany(),
    db.query.transactions.findMany({
      columns: { id: true, categoryId: true, kind: true, amount: true, date: true },
      orderBy: [desc(transactions.date)],
    }),
  ])
  return <BudgetsClient categories={cats} budgets={budgetsList} transactions={txns as any} />
}
