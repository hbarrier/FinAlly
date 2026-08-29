'use server'

import { z } from 'zod'
import { revalidateApp } from './_shared'
import { db } from '../db'
import { merchants, recurring, transactions } from '../schema'
import { nanoid } from '../utils'
import { inArray } from 'drizzle-orm'
import { parse, zId, zDateISO, zAmount } from '../schemas'
import { monthOf } from '../dates'
import { upsertLinkedInstance } from '../recurring-instances'
import { defaultPaymentMethodForKind, type PaymentMethod } from '../payment-method'

export type MerchantMappingPayload = {
  csvName: string
  action: 'map-existing' | 'create-same' | 'create-custom'
  existingMerchantId: string | null
  customName: string
  recurringId: string | null
}

export type ImportRow = {
  merchantCsvName: string
  date: string
  amount: number
}

const importSchema = z.object({
  merchantMappings: z.array(z.object({
    csvName: z.string().min(1),
    action: z.enum(['map-existing', 'create-same', 'create-custom']),
    existingMerchantId: zId.nullable(),
    customName: z.string(),
    recurringId: zId.nullable(),
  })),
  rows: z.array(z.object({
    merchantCsvName: z.string().min(1),
    date: zDateISO,
    amount: zAmount,
  })),
})

export async function importTransactions(input: {
  merchantMappings: MerchantMappingPayload[]
  rows: ImportRow[]
}) {
  const { merchantMappings, rows } = parse(importSchema, input)
  if (rows.length === 0) return

  await db.transaction(async (tx) => {
    // Resolve existing merchants + recurring methods inside the transaction so a
    // concurrent delete can't leave a dangling reference.
    const existingIds = merchantMappings
      .filter((m) => m.action === 'map-existing' && m.existingMerchantId)
      .map((m) => m.existingMerchantId as string)
    const existingById = new Map<string, { id: string; categoryId: string | null }>()
    if (existingIds.length > 0) {
      const found = await tx
        .select({ id: merchants.id, categoryId: merchants.categoryId })
        .from(merchants)
        .where(inArray(merchants.id, existingIds))
      for (const r of found) existingById.set(r.id, r)
    }

    const newMerchants: { id: string; name: string }[] = []
    const resolved = new Map<
      string,
      { merchantId: string | null; categoryId: string | null; recurringId: string | null }
    >()
    for (const m of merchantMappings) {
      if (m.action === 'map-existing' && m.existingMerchantId) {
        resolved.set(m.csvName, {
          merchantId: m.existingMerchantId,
          categoryId: existingById.get(m.existingMerchantId)?.categoryId ?? null,
          recurringId: m.recurringId,
        })
      } else {
        const id = nanoid()
        newMerchants.push({ id, name: m.action === 'create-custom' ? m.customName.trim() : m.csvName })
        resolved.set(m.csvName, { merchantId: id, categoryId: null, recurringId: m.recurringId })
      }
    }

    const recurringIds = [...new Set(merchantMappings.map((m) => m.recurringId).filter((x): x is string => !!x))]
    const recurringMethodById = new Map<string, PaymentMethod>()
    if (recurringIds.length > 0) {
      const found = await tx
        .select({ id: recurring.id, method: recurring.method })
        .from(recurring)
        .where(inArray(recurring.id, recurringIds))
      for (const r of found) recurringMethodById.set(r.id, r.method as PaymentMethod)
    }

    if (newMerchants.length > 0) await tx.insert(merchants).values(newMerchants)

    const txRows = rows.map((row) => {
      const res = resolved.get(row.merchantCsvName)
      const method =
        (res?.recurringId ? recurringMethodById.get(res.recurringId) : undefined) ??
        defaultPaymentMethodForKind('expense')
      return {
        id: nanoid(),
        date: row.date,
        amount: row.amount,
        kind: 'expense' as const,
        merchantId: res?.merchantId ?? null,
        categoryId: res?.categoryId ?? null,
        recurringId: res?.recurringId ?? null,
        method,
        cleared: 1,
      }
    })
    await tx.insert(transactions).values(txRows)

    // Mark the matching recurring instance linked, same as addTransaction does.
    for (const r of txRows) {
      if (r.recurringId) await upsertLinkedInstance(tx, r.recurringId, monthOf(r.date), r.id)
    }
  })

  revalidateApp()
}
