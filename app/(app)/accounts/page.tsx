import type { Metadata } from 'next'
import { listSavingAccounts, getSavingAccountBalances } from '@/lib/queries/saving-accounts'
import { db } from '@/lib/db'
import { transactions } from '@/lib/schema'
import { sql } from 'drizzle-orm'
import { AccountsClient } from './accounts-client'

export const metadata: Metadata = { title: 'Accounts | FinAlly' }

export default async function AccountsPage() {
  const [accounts, balances, usageRows] = await Promise.all([
    listSavingAccounts(),
    getSavingAccountBalances(),
    db
      .select({
        source: transactions.sourceSavingAccountId,
        dest: transactions.destSavingAccountId,
      })
      .from(transactions)
      .where(sql`${transactions.kind} IN ('saving', 'interest')`),
  ])

  const usedIds = new Set<string>()
  for (const r of usageRows) {
    if (r.source) usedIds.add(r.source)
    if (r.dest) usedIds.add(r.dest)
  }

  return (
    <AccountsClient
      accounts={accounts.map((a) => ({
        ...a,
        balance: balances.get(a.id) ?? a.startBalance,
        hasTransfers: usedIds.has(a.id),
      }))}
    />
  )
}
