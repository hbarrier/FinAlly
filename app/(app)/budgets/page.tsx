import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { merchants, budgetLines } from '@/lib/schema'
import { getRecentTransactionsForBudget } from '@/lib/queries/month-actuals'
import { getModules } from '@/lib/queries/user-settings'
import { BudgetsClient } from './budgets-client'
import { requireModule } from '@/lib/modules'
import { budgetWaterfall } from '@/lib/derive'
import { currentMonth } from '@/lib/dates'
import { nanoid } from '@/lib/utils'

export const metadata: Metadata = { title: 'Budget | FinAlly' }

export default async function BudgetsPage() {
  await requireModule('budgets')
  const modules = await getModules()
  const recurringEnabled = modules.recurring

  const [cats, merchantsList, budget, recentTransactions, recurringItems] = await Promise.all([
    db.query.categories.findMany(),
    db.query.merchants.findMany({ where: eq(merchants.isActive, 1) }),
    db.query.budgets.findFirst({ with: { lines: true } }),
    getRecentTransactionsForBudget(),
    recurringEnabled ? db.query.recurring.findMany() : Promise.resolve([]),
  ])

  let linesForClient = budget?.lines ?? []

  if (budget) {
    const thisMonth = currentMonth()
    const { monthly, yearly } = budgetWaterfall(budget.lines, recentTransactions, cats, thisMonth, thisMonth)

    const gaps: { category: (typeof cats)[number]; frequency: 'monthly' | 'yearly' }[] = []
    for (const c of monthly.categories) if (c.needsOtherLine) gaps.push({ category: c.category, frequency: 'monthly' })
    for (const c of yearly.categories) if (c.needsOtherLine) gaps.push({ category: c.category, frequency: 'yearly' })

    if (gaps.length > 0) {
      const newRows = gaps.map((g) => ({
        id: nanoid(),
        budgetId: budget.id,
        name: `Other ${g.category.name}`,
        kind: g.category.kind,
        categoryId: g.category.id,
        merchantId: null,
        amount: 0,
        frequency: g.frequency,
        recurring: 0,
        sourceRecurringId: null,
      }))
      await db.insert(budgetLines).values(newRows)
      linesForClient = [...budget.lines, ...newRows]
    }
  }

  return (
    <BudgetsClient
      categories={cats}
      merchants={merchantsList}
      budget={budget ? { ...budget, lines: linesForClient } : null}
      recentTransactions={recentTransactions}
      recurringItems={recurringItems}
      recurringEnabled={recurringEnabled}
    />
  )
}
