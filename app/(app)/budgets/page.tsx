import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { merchants } from '@/lib/schema'
import { getCurrentMonthActuals } from '@/lib/queries/month-actuals'
import { BudgetsClient } from './budgets-client'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Budget | FinAlly' }

export default async function BudgetsPage() {
  await requireModule('budgets')
  const [cats, merchantsList, budget, actuals] = await Promise.all([
    db.query.categories.findMany(),
    db.query.merchants.findMany({ where: eq(merchants.isActive, 1) }),
    db.query.budgets.findFirst({ with: { lines: true } }),
    getCurrentMonthActuals(),
  ])

  return (
    <BudgetsClient
      categories={cats}
      merchants={merchantsList}
      budget={budget ?? null}
      actuals={actuals}
    />
  )
}
