import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { BUDGET_START_MONTH_COOKIE } from '@/lib/settings-options'
import { db } from '@/lib/db'
import { and, eq, gte, lte } from 'drizzle-orm'
import { merchants, budgetLines, recurringInstances } from '@/lib/schema'
import { getPlannedTransactionsToMonthEnd, getRecentTransactionsForBudget } from '@/lib/queries/month-actuals'
import { getModules, getBudgetColorSettings } from '@/lib/queries/user-settings'
import { BudgetsClient } from './budgets-client'
import { requireModule } from '@/lib/modules'
import { budgetWaterfall } from '@/lib/derive'
import { addMonths, currentMonth } from '@/lib/dates'
import { nanoid } from '@/lib/utils'

export const metadata: Metadata = { title: 'Budget | FinAlly' }

export default async function BudgetsPage() {
  await requireModule('budgets')
  const modules = await getModules()
  const recurringEnabled = modules.recurring
  const thisMonth = currentMonth()
  const savedStartMonth = (await cookies()).get(BUDGET_START_MONTH_COOKIE)?.value ?? ''
  const startMonthValid = /^\d{4}-\d{2}$/.test(savedStartMonth)
    && savedStartMonth >= addMonths(thisMonth, -11) && savedStartMonth <= thisMonth
  const initialStartMonth = startMonthValid ? savedStartMonth : thisMonth

  const [cats, merchantsList, budget, recentTransactions, recurringItems, recurringInstancesList, budgetColors, plannedTransactions] =
    await Promise.all([
      db.query.categories.findMany(),
      db.query.merchants.findMany({ where: eq(merchants.isActive, 1) }),
      db.query.budgets.findFirst({ with: { lines: true } }),
      getRecentTransactionsForBudget(),
      recurringEnabled ? db.query.recurring.findMany() : Promise.resolve([]),
      recurringEnabled
        ? db.select().from(recurringInstances).where(
            and(gte(recurringInstances.month, addMonths(thisMonth, -11)), lte(recurringInstances.month, thisMonth)),
          )
        : Promise.resolve([]),
      getBudgetColorSettings(),
      getPlannedTransactionsToMonthEnd(),
    ])

  let linesForClient = budget?.lines ?? []

  if (budget) {
    const { monthly, yearly } = budgetWaterfall(budget.lines, recentTransactions, cats, thisMonth, thisMonth)

    const gaps: { category: (typeof cats)[number]; kind: 'expense' | 'income'; frequency: 'monthly' | 'yearly' }[] = []
    for (const c of monthly.categories) if (c.needsOtherLine) gaps.push({ category: c.category, kind: c.kind, frequency: 'monthly' })
    for (const c of yearly.categories) if (c.needsOtherLine) gaps.push({ category: c.category, kind: c.kind, frequency: 'yearly' })

    if (gaps.length > 0) {
      const newRows = gaps.map((g) => ({
        id: nanoid(),
        budgetId: budget.id,
        name: `Other ${g.category.name}`,
        kind: g.kind,
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
      plannedTransactions={plannedTransactions}
      recurringItems={recurringItems}
      recurringInstances={recurringInstancesList}
      recurringEnabled={recurringEnabled}
      budgetColors={budgetColors}
      initialStartMonth={initialStartMonth}
    />
  )
}
