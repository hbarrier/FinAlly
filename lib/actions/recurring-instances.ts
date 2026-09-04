'use server'

import { db } from '../db'
import { recurring, recurringInstances } from '../schema'
import { eq, and } from 'drizzle-orm'
import { revalidateApp } from './_shared'
import { parse, zId } from '../schemas'
import { ensureInstancesForRecurring, currentMonth } from '../recurring-instances'

/** How far back to create 'expected' instances when backfilling a now-open-ended recurring. */
export type BackfillScope = 'current' | 'all'

/**
 * Creates missing 'expected' instances for a recurring item, e.g. after its end
 * date was removed. 'current' covers this month only; 'all' covers every month
 * since the recurring's start date.
 */
export async function backfillRecurringInstances(id: string, scope: BackfillScope): Promise<void> {
  parse(zId, id)
  await db.transaction(async (tx) => {
    const r = await tx.query.recurring.findFirst({ where: eq(recurring.id, id) })
    if (!r) return
    const toMonth = currentMonth()
    const fromMonth = scope === 'all' ? r.startDate.slice(0, 7) : toMonth
    await ensureInstancesForRecurring(tx, r, fromMonth, toMonth)
  })
  revalidateApp()
}

export async function markInstanceNotApplicable(instanceId: string): Promise<void> {
  parse(zId, instanceId)
  await db
    .update(recurringInstances)
    .set({ status: 'not_applicable' })
    .where(and(eq(recurringInstances.id, instanceId), eq(recurringInstances.status, 'expected')))
  revalidateApp()
}

export async function unmarkInstanceNotApplicable(instanceId: string): Promise<void> {
  parse(zId, instanceId)
  await db
    .update(recurringInstances)
    .set({ status: 'expected', transactionId: null })
    .where(and(eq(recurringInstances.id, instanceId), eq(recurringInstances.status, 'not_applicable')))
  revalidateApp()
}
