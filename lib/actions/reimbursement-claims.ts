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
import { parse, zId, zMonth, zDateISO, zSignedAmount } from '../schemas'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function claimIdForMonth(tx: Tx, month: string): Promise<string | null> {
  const [claim] = await tx
    .select({ id: reimbursementClaims.id })
    .from(reimbursementClaims)
    .where(eq(reimbursementClaims.month, month))
    .limit(1)
  return claim?.id ?? null
}

export async function setMonthClaimDate(month: string, claimDate: string) {
  parse(zMonth, month)
  parse(zDateISO, claimDate)
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
  parse(zMonth, month)
  await db.transaction(async (tx) => {
    const claimId = await claimIdForMonth(tx, month)
    if (!claimId) return
    await tx.delete(reimbursementClaimAllocations).where(eq(reimbursementClaimAllocations.claimId, claimId))
    await tx.delete(reimbursementClaims).where(eq(reimbursementClaims.id, claimId))
  })
  revalidateApp()
}

export async function setExpenseAmountOverride(
  expenseTxId: string,
  amountOverride: number | null,
  comment: string | null,
) {
  parse(zId, expenseTxId)
  if (amountOverride !== null) parse(zSignedAmount, amountOverride)
  await db
    .update(transactions)
    .set({ reimbursementAmountOverride: amountOverride, reimbursementComment: comment })
    .where(and(eq(transactions.id, expenseTxId), eq(transactions.reimbursable, 1)))
  revalidateApp()
}

export async function linkIncomeToClaim(month: string, reimbursementTxId: string) {
  parse(zMonth, month)
  parse(zId, reimbursementTxId)
  await db.transaction(async (tx) => {
    const claimId = await claimIdForMonth(tx, month)
    if (!claimId) throw new Error(`No claim found for month ${month}`)
    await tx
      .insert(reimbursementClaimAllocations)
      .values({ id: nanoid(), claimId, reimbursementTxId })
      .onConflictDoNothing()
  })
  revalidateApp()
}

export async function unlinkAllFromClaim(month: string) {
  parse(zMonth, month)
  await db.transaction(async (tx) => {
    const claimId = await claimIdForMonth(tx, month)
    if (!claimId) return
    await tx.delete(reimbursementClaimAllocations).where(eq(reimbursementClaimAllocations.claimId, claimId))
  })
  revalidateApp()
}

export async function setMonthClaimSettled(month: string, settled: boolean) {
  parse(zMonth, month)
  await db
    .update(reimbursementClaims)
    .set({ settledAt: settled ? new Date().toISOString() : null })
    .where(eq(reimbursementClaims.month, month))
  revalidateApp()
}
