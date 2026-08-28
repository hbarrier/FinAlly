import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Budgets | FinAlly' }
import { desc } from 'drizzle-orm'
import { transactions, budgets } from '@/lib/schema'
import { BudgetsClient } from './budgets-client'
import { requireModule } from '@/lib/modules'

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>
}) {
  await requireModule('budgets')
  const { b: bParam } = await searchParams
  const [cats, budgetsList, txns] = await Promise.all([
    db.query.categories.findMany(),
    db.query.budgets.findMany({ with: { amounts: true }, orderBy: [desc(budgets.createdAt)] }),
    db.query.transactions.findMany({
      columns: { id: true, categoryId: true, kind: true, amount: true, date: true },
      orderBy: [desc(transactions.date)],
    }),
  ])

  const selected =
    budgetsList.find((x) => x.id === bParam) ??
    budgetsList.find((x) => x.isActive) ??
    budgetsList[0] ??
    null

  return (
    <BudgetsClient
      categories={cats}
      budgets={budgetsList.map((b) => ({ id: b.id, name: b.name, description: b.description, isActive: b.isActive, createdAt: b.createdAt }))}
      selected={selected}
      transactions={txns}
    />
  )
}
