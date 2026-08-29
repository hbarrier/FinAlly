'use server'

import { db } from '@/lib/db'
import { taxAllocations } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { revalidateApp } from './_shared'
import { parse, zId, zTaxAllocation } from '@/lib/schemas'
import type { TaxAllocationValue } from '@/lib/db-types'

export async function setTaxAllocation(transactionId: string, allocation: TaxAllocationValue) {
  parse(zId, transactionId)
  parse(zTaxAllocation, allocation)
  await db
    .insert(taxAllocations)
    .values({ transactionId, allocation })
    .onConflictDoUpdate({
      target: taxAllocations.transactionId,
      set: { allocation, updatedAt: new Date().toISOString() },
    })
  revalidateApp()
}

export async function clearTaxAllocation(transactionId: string) {
  parse(zId, transactionId)
  await db.delete(taxAllocations).where(eq(taxAllocations.transactionId, transactionId))
  revalidateApp()
}
