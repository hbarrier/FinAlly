import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Recurring | FinAlly' }
import { asc, eq, inArray } from 'drizzle-orm'
import { recurringAmounts, merchants as merchantsTable, transactions } from '@/lib/schema'
import { RecurringClient } from './recurring-client'
import { requireModule } from '@/lib/modules'
import { listSavingAccounts } from '@/lib/queries/saving-accounts'

export default async function RecurringPage() {
  await requireModule('recurring')
  const [recurringItems, cats, merchants, savingAccounts] = await Promise.all([
    db.query.recurring.findMany({
      with: { amounts: { orderBy: [asc(recurringAmounts.startDate)] } },
    }),
    db.query.categories.findMany(),
    db.query.merchants.findMany({ where: eq(merchantsTable.isActive, 1) }),
    listSavingAccounts(),
  ])

  const recurringIds = recurringItems.map((r) => r.id)
  const linkedTxns = recurringIds.length
    ? await db
        .select({ date: transactions.date, amount: transactions.amount, recurringId: transactions.recurringId })
        .from(transactions)
        .where(inArray(transactions.recurringId, recurringIds))
    : []

  const transactionsByRecurring: Record<string, { date: string; amount: number }[]> = {}
  for (const t of linkedTxns) {
    if (!t.recurringId) continue
    if (!transactionsByRecurring[t.recurringId]) transactionsByRecurring[t.recurringId] = []
    transactionsByRecurring[t.recurringId].push({ date: t.date, amount: t.amount })
  }

  return (
    <RecurringClient
      recurring={recurringItems}
      categories={cats}
      merchants={merchants}
      savingAccounts={savingAccounts}
      transactionsByRecurring={transactionsByRecurring}
    />
  )
}
