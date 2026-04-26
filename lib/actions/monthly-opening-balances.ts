'use server'

import { sql } from 'drizzle-orm'
import { db } from '../db'
import { monthlyOpeningBalances } from '../schema'
import { revalidateApp } from './_shared'

function assertMonthKey(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Invalid month key: ${month}`)
}

export async function upsertMonthlyOpeningBalance(month: string, openingBalance: number) {
  assertMonthKey(month)
  const n = Number(openingBalance)
  if (!Number.isFinite(n)) throw new Error('Opening balance must be a number')

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

