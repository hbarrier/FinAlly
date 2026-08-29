'use server'

import { sql } from 'drizzle-orm'
import { db } from '../db'
import { monthlyOpeningBalances } from '../schema'
import { revalidateApp } from './_shared'
import { parse, zMonth, zSignedAmount } from '../schemas'

export async function upsertMonthlyOpeningBalance(month: string, openingBalance: number) {
  parse(zMonth, month)
  const n = parse(zSignedAmount, openingBalance)

  await db
    .insert(monthlyOpeningBalances)
    .values({
      month,
      openingBalance: n,
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    })
    .onConflictDoUpdate({
      target: monthlyOpeningBalances.month,
      set: {
        openingBalance: n,
        updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      },
    })

  revalidateApp()
}

