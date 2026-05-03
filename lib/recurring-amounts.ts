import { recurring, recurringAmounts } from './schema'
import { effectiveAmount } from './derive'
import { eq } from 'drizzle-orm'

export type RecurringAmountEntry = {
  id: string
  recurringId: string
  amount: number
  startDate: string // YYYY-MM-DD
}

export function pickEffectiveRecurringAmountEntry(
  entries: RecurringAmountEntry[],
  isoDate: string,
): RecurringAmountEntry | null {
  if (entries.length === 0) return null
  const sorted = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const past = sorted.filter((e) => e.startDate <= isoDate)
  return past.length > 0 ? past[past.length - 1] : sorted[0]
}

import type { db as dbClient } from './db'
export type DbTx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0]

export async function loadRecurringAmountEntriesTx(
  tx: DbTx,
  recurringId: string,
): Promise<RecurringAmountEntry[]> {
  return await tx
    .select({
      id: recurringAmounts.id,
      recurringId: recurringAmounts.recurringId,
      amount: recurringAmounts.amount,
      startDate: recurringAmounts.startDate,
    })
    .from(recurringAmounts)
    .where(eq(recurringAmounts.recurringId, recurringId))
}

export async function upsertRecurringAmountEntryTx(
  tx: DbTx,
  params: { recurringId: string; startDate: string; amount: number; idFactory: () => string },
): Promise<string> {
  const existing = await tx.query.recurringAmounts.findFirst({
    where: (ra, { and, eq }) =>
      and(eq(ra.recurringId, params.recurringId), eq(ra.startDate, params.startDate)),
    columns: { id: true },
  })

  const entryId = existing?.id ?? params.idFactory()
  if (existing) {
    await tx
      .update(recurringAmounts)
      .set({ amount: params.amount })
      .where(eq(recurringAmounts.id, entryId))
  } else {
    await tx.insert(recurringAmounts).values({
      id: entryId,
      recurringId: params.recurringId,
      amount: params.amount,
      startDate: params.startDate,
    })
  }

  return entryId
}

export async function syncRecurringEffectiveAmountTx(
  tx: DbTx,
  recurringId: string,
) {
  const entries = await loadRecurringAmountEntriesTx(tx, recurringId)
  if (entries.length === 0) return
  const current = effectiveAmount(entries)
  await tx.update(recurring).set({ amount: current }).where(eq(recurring.id, recurringId))
}

