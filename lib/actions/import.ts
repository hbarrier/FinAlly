'use server'

import { revalidateApp } from './_shared'
import { db } from '../db'
import { merchants, recurring, transactions } from '../schema'
import { nanoid } from '../utils'
import { inArray } from 'drizzle-orm'
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

export async function importTransactions(payload: {
  merchantMappings: MerchantMappingPayload[]
  rows: ImportRow[]
}) {
  const { merchantMappings, rows } = payload

  const existingIdsToLookup = merchantMappings
    .filter((m) => m.action === 'map-existing' && m.existingMerchantId)
    .map((m) => m.existingMerchantId!)

  const existingById = new Map<string, { id: string; categoryId: string | null }>()
  if (existingIdsToLookup.length > 0) {
    const rowsFound = await db
      .select({ id: merchants.id, categoryId: merchants.categoryId })
      .from(merchants)
      .where(inArray(merchants.id, existingIdsToLookup))
    for (const row of rowsFound) existingById.set(row.id, row)
  }

  const newMerchantInserts: { id: string; name: string }[] = []
  const resolved = new Map<
    string,
    { merchantId: string | null; categoryId: string | null; recurringId: string | null }
  >()

  for (const m of merchantMappings) {
    if (m.action === 'map-existing' && m.existingMerchantId) {
      const existing = existingById.get(m.existingMerchantId)
      resolved.set(m.csvName, {
        merchantId: m.existingMerchantId,
        categoryId: existing?.categoryId ?? null,
        recurringId: m.recurringId,
      })
    } else {
      const name = m.action === 'create-custom' ? m.customName.trim() : m.csvName
      const id = nanoid()
      newMerchantInserts.push({ id, name })
      resolved.set(m.csvName, {
        merchantId: id,
        categoryId: null,
        recurringId: m.recurringId,
      })
    }
  }

  const recurringIdsToLookup = [...new Set(merchantMappings.map((m) => m.recurringId).filter(Boolean))] as string[]
  const recurringMethodById = new Map<string, PaymentMethod>()
  if (recurringIdsToLookup.length > 0) {
    const found = await db
      .select({ id: recurring.id, method: recurring.method })
      .from(recurring)
      .where(inArray(recurring.id, recurringIdsToLookup))
    for (const r of found) recurringMethodById.set(r.id, r.method as PaymentMethod)
  }

  await db.transaction(async (tx) => {
    if (newMerchantInserts.length > 0) {
      await tx.insert(merchants).values(newMerchantInserts)
    }

    if (rows.length > 0) {
      await tx.insert(transactions).values(
        rows.map((row) => {
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
        }),
      )
    }
  })

  revalidateApp()
}
