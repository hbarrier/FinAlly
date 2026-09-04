import { eq } from 'drizzle-orm'
import { db } from '../db'
import { categories, savingAccounts } from '../schema'
import { savingAccountLiveBalance } from '../queries/saving-accounts'

/** Id of the protected auto-created Savings category. */
export async function savingsCategoryId(): Promise<string> {
  const cat = await db.query.categories.findFirst({
    where: eq(categories.isSavings, 1),
    columns: { id: true },
  })
  if (!cat) throw new Error('Savings category is missing.')
  return cat.id
}

/**
 * Validates a saving transfer's endpoints (NULL = the credit account) and runs
 * the overdraw guard against the source saving account. Returns the normalized
 * endpoint ids to store.
 */
export async function resolveSavingTransfer(input: {
  sourceSavingAccountId?: string | null
  destSavingAccountId?: string | null
  amount: number
  excludeTxId?: string
  /** Recurring templates set this: don't check the source account's live balance. */
  skipOverdrawCheck?: boolean
}): Promise<{ sourceSavingAccountId: string | null; destSavingAccountId: string | null }> {
  const source = input.sourceSavingAccountId ?? null
  const dest = input.destSavingAccountId ?? null

  if (source === null && dest === null) {
    throw new Error('Pick a saving account for the transfer.')
  }
  if (source !== null && source === dest) {
    throw new Error('The two accounts must be different.')
  }

  const ids = [source, dest].filter((v): v is string => v !== null)
  if (ids.length > 0) {
    const found = await db
      .select({ id: savingAccounts.id })
      .from(savingAccounts)
      .where(eq(savingAccounts.id, ids[0]))
    if (found.length === 0) throw new Error('Saving account not found.')
    if (ids[1]) {
      const found2 = await db
        .select({ id: savingAccounts.id })
        .from(savingAccounts)
        .where(eq(savingAccounts.id, ids[1]))
      if (found2.length === 0) throw new Error('Saving account not found.')
    }
  }

  if (source !== null && !input.skipOverdrawCheck) {
    const balance = await savingAccountLiveBalance(source, input.excludeTxId)
    if (input.amount > balance + 1e-9) {
      const [acc] = await db
        .select({ name: savingAccounts.name })
        .from(savingAccounts)
        .where(eq(savingAccounts.id, source))
      throw new Error(`Not enough in ${acc?.name ?? 'that account'} (balance ${balance.toFixed(2)}).`)
    }
  }

  return { sourceSavingAccountId: source, destSavingAccountId: dest }
}

/**
 * Validates the destination account for an interest credit. Interest has no
 * source at all (not another saving account, not the credit account), so
 * there's nothing to check but that the destination exists.
 */
export async function resolveInterestTarget(
  destSavingAccountId: string | null | undefined,
): Promise<string> {
  if (!destSavingAccountId) throw new Error('Pick a saving account.')
  const [acc] = await db
    .select({ id: savingAccounts.id })
    .from(savingAccounts)
    .where(eq(savingAccounts.id, destSavingAccountId))
  if (!acc) throw new Error('Saving account not found.')
  return destSavingAccountId
}
