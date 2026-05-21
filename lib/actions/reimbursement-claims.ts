'use server'

import { db } from '../db'
import {
  reimbursementClaims,
  reimbursementClaimAllocations,
  transactions,
} from '../schema'
import { eq, and } from 'drizzle-orm'
import { revalidateApp } from './_shared'
import { nanoid } from '../utils'

export async function setMonthClaimDate(month: string, claimDate: string) {
  await db
    .insert(reimbursementClaims)
    .values({ id: nanoid(), month, claimDate })
    .onConflictDoUpdate({
      target: reimbursementClaims.month,
      set: { claimDate },
    })
  revalidateApp()
}

export async function clearMonthClaimDate(month: string) {
  await db.transaction(async (tx) => {
    const [claim] = await tx
      .select({ id: reimbursementClaims.id })
      .from(reimbursementClaims)
      .where(eq(reimbursementClaims.month, month))
      .limit(1)
    if (!claim) return
    await tx.delete(reimbursementClaimAllocations).where(eq(reimbursementClaimAllocations.claimId, claim.id))
    await tx.delete(reimbursementClaims).where(eq(reimbursementClaims.id, claim.id))
  })
  revalidateApp()
}

export async function setExpenseAmountOverride(
  expenseTxId: string,
  amountOverride: number | null,
  comment: string | null,
) {
  await db
    .update(transactions)
    .set({ reimbursementAmountOverride: amountOverride, reimbursementComment: comment })
    .where(and(eq(transactions.id, expenseTxId), eq(transactions.reimbursable, 1)))
  revalidateApp()
}

export async function linkIncomeToClaim(month: string, reimbursementTxId: string) {
  const [claim] = await db
    .select({ id: reimbursementClaims.id })
    .from(reimbursementClaims)
    .where(eq(reimbursementClaims.month, month))
    .limit(1)
  if (!claim) throw new Error(`No claim found for month ${month}`)
  await db
    .insert(reimbursementClaimAllocations)
    .values({ id: nanoid(), claimId: claim.id, reimbursementTxId })
    .onConflictDoNothing()
  revalidateApp()
}

export async function unlinkAllFromClaim(month: string) {
  const [claim] = await db
    .select({ id: reimbursementClaims.id })
    .from(reimbursementClaims)
    .where(eq(reimbursementClaims.month, month))
    .limit(1)
  if (!claim) return
  await db.delete(reimbursementClaimAllocations).where(eq(reimbursementClaimAllocations.claimId, claim.id))
  revalidateApp()
}

export async function setMonthClaimSettled(month: string, settled: boolean) {
  await db
    .update(reimbursementClaims)
    .set({ settledAt: settled ? new Date().toISOString() : null })
    .where(eq(reimbursementClaims.month, month))
  revalidateApp()
}
