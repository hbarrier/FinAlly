'use server'

import { db } from '../db'
import { recurringInstances } from '../schema'
import { eq, and } from 'drizzle-orm'
import { revalidateApp } from './_shared'
import { parse, zId } from '../schemas'

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
