'use server'

import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { merchants, transactions } from '../schema'
import { nanoid } from '../utils'

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

  // Build csvName → { merchantId, categoryId, recurringId } map
  const resolved = new Map<
    string,
    { merchantId: string | null; categoryId: string | null; recurringId: string | null }
  >()

  for (const m of merchantMappings) {
    if (m.action === 'map-existing' && m.existingMerchantId) {
      const existing = await db.query.merchants.findFirst({
        where: (t, { eq }) => eq(t.id, m.existingMerchantId!),
      })
      resolved.set(m.csvName, {
        merchantId: m.existingMerchantId,
        categoryId: existing?.categoryId ?? null,
        recurringId: m.recurringId,
      })
    } else {
      const name = m.action === 'create-custom' ? m.customName.trim() : m.csvName
      const id = nanoid()
      await db.insert(merchants).values({ id, name })
      resolved.set(m.csvName, {
        merchantId: id,
        categoryId: null,
        recurringId: m.recurringId,
      })
    }
  }

  if (rows.length > 0) {
    await db.insert(transactions).values(
      rows.map((row) => {
        const res = resolved.get(row.merchantCsvName)
        return {
          id: nanoid(),
          date: row.date,
          amount: row.amount,
          kind: 'expense' as const,
          merchantId: res?.merchantId ?? null,
          categoryId: res?.categoryId ?? null,
          recurringId: res?.recurringId ?? null,
          cleared: 1,
        }
      }),
    )
  }

  revalidatePath('/', 'layout')
}
