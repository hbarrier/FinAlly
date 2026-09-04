import { cache } from 'react'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { savingAccounts, transactions } from '@/lib/schema'
import type { SavingAccount } from '@/lib/db-types'

export const listSavingAccounts = cache(
  async (): Promise<SavingAccount[]> =>
    db
      .select()
      .from(savingAccounts)
      .orderBy(asc(savingAccounts.sortOrder), asc(savingAccounts.createdAt)),
)

/**
 * Current balance per saving account: its start balance plus every transfer in
 * (`dest`) minus every transfer out (`source`). Keyed by account id.
 */
export const getSavingAccountBalances = cache(async (): Promise<Map<string, number>> => {
  const accounts = await listSavingAccounts()
  const balances = new Map(accounts.map((a) => [a.id, a.startBalance]))

  const [ins, outs] = await Promise.all([
    db
      .select({ id: transactions.destSavingAccountId, total: sql<number>`sum(${transactions.amount})` })
      .from(transactions)
      .where(inArray(transactions.kind, ['saving', 'interest']))
      .groupBy(transactions.destSavingAccountId),
    db
      .select({ id: transactions.sourceSavingAccountId, total: sql<number>`sum(${transactions.amount})` })
      .from(transactions)
      .where(eq(transactions.kind, 'saving'))
      .groupBy(transactions.sourceSavingAccountId),
  ])

  for (const r of ins) {
    if (r.id && balances.has(r.id)) balances.set(r.id, balances.get(r.id)! + Number(r.total ?? 0))
  }
  for (const r of outs) {
    if (r.id && balances.has(r.id)) balances.set(r.id, balances.get(r.id)! - Number(r.total ?? 0))
  }
  return balances
})

/**
 * Live balance of one saving account, optionally ignoring one transaction (used
 * by the overdraw guard when editing an existing transfer). Not memoised.
 */
export async function savingAccountLiveBalance(
  accountId: string,
  excludeTxId?: string,
): Promise<number> {
  const [account] = await db
    .select({ startBalance: savingAccounts.startBalance })
    .from(savingAccounts)
    .where(eq(savingAccounts.id, accountId))
    .limit(1)
  if (!account) return 0

  const rows = await db
    .select({
      source: transactions.sourceSavingAccountId,
      dest: transactions.destSavingAccountId,
      amount: transactions.amount,
      id: transactions.id,
    })
    .from(transactions)
    .where(
      sql`${transactions.kind} IN ('saving', 'interest') AND (${transactions.sourceSavingAccountId} = ${accountId} OR ${transactions.destSavingAccountId} = ${accountId})`,
    )

  let balance = account.startBalance
  for (const r of rows) {
    if (excludeTxId && r.id === excludeTxId) continue
    if (r.dest === accountId) balance += Number(r.amount ?? 0)
    if (r.source === accountId) balance -= Number(r.amount ?? 0)
  }
  return balance
}

/** True when at least one transfer references the account (blocks deletion). */
export async function savingAccountHasTransfers(id: string): Promise<boolean> {
  const row = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      sql`${transactions.sourceSavingAccountId} = ${id} OR ${transactions.destSavingAccountId} = ${id}`,
    )
    .limit(1)
  return row.length > 0
}
