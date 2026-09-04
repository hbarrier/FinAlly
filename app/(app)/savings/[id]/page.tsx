import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { and, desc, eq, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { categories, savingAccounts, transactions } from '@/lib/schema'
import { listSavingAccounts, getSavingAccountBalances } from '@/lib/queries/saving-accounts'
import { SavingAccountClient } from './saving-account-client'

export const metadata: Metadata = { title: 'Saving account | FinAlly' }

export default async function SavingAccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [account] = await db.select().from(savingAccounts).where(eq(savingAccounts.id, id))
  if (!account) notFound()

  const [transfers, allAccounts, balances, savingsCategory] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.kind, 'saving'),
          or(eq(transactions.sourceSavingAccountId, id), eq(transactions.destSavingAccountId, id)),
        ),
      )
      .orderBy(desc(transactions.date), desc(transactions.createdAt)),
    listSavingAccounts(),
    getSavingAccountBalances(),
    db.query.categories.findFirst({ where: eq(categories.isSavings, 1) }),
  ])

  return (
    <SavingAccountClient
      account={account}
      balance={balances.get(id) ?? account.startBalance}
      transfers={transfers}
      savingAccounts={allAccounts}
      categoryIcon={savingsCategory?.icon ?? 'cat-seed'}
    />
  )
}
