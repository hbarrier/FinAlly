'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { divorceSplitEntries, divorceSplitRentMonths, divorceSplitSettings } from '@/lib/schema'
import { nanoid } from '../utils'
import { revalidateApp } from './_shared'
import { parse, zAmount, zAmountOrZero, zDateISO, zId, zMonth, zPercent } from '@/lib/schemas'

const expenseSchema = z.object({
  date: zDateISO,
  amount: zAmount,
  myPercent: zPercent,
  description: z.string().nullable(),
})

const settingsSchema = z.object({ rent: zAmountOrZero, apl: zAmountOrZero, myPercent: zPercent, startMonth: zMonth })

const rentOverrideSchema = z.object({ rent: zAmountOrZero.nullable(), apl: zAmountOrZero.nullable() })

export type SplitExpenseInput = z.infer<typeof expenseSchema>
export type SplitSettingsInput = z.infer<typeof settingsSchema>

/** Expenses are always paid by Audrey; the type/person columns are kept fixed. */
export async function createSplitEntry(input: SplitExpenseInput) {
  const data = parse(expenseSchema, input)
  await db.insert(divorceSplitEntries).values({ id: nanoid(), type: 'expense', person: 'audrey', ...data })
  revalidateApp()
}

export async function updateSplitEntry(id: string, input: SplitExpenseInput) {
  parse(zId, id)
  const data = parse(expenseSchema, input)
  await db.update(divorceSplitEntries).set(data).where(eq(divorceSplitEntries.id, id))
  revalidateApp()
}

export async function setExpensePaid(id: string, who: 'me' | 'vincent', paid: boolean) {
  parse(zId, id)
  const flag = paid ? 1 : 0
  await db
    .update(divorceSplitEntries)
    .set(who === 'me' ? { mePaid: flag } : { vincentPaid: flag })
    .where(eq(divorceSplitEntries.id, id))
  revalidateApp()
}

export async function deleteSplitEntry(id: string) {
  parse(zId, id)
  await db.delete(divorceSplitEntries).where(eq(divorceSplitEntries.id, id))
  revalidateApp()
}

export async function updateSplitSettings(input: SplitSettingsInput) {
  const data = parse(settingsSchema, input)
  await db.update(divorceSplitSettings).set(data).where(eq(divorceSplitSettings.id, 1))
  revalidateApp()
}

/** Overrides rent / APL for one month; null falls back to the settings. */
export async function setRentOverride(month: string, input: { rent: number | null; apl: number | null }) {
  parse(zMonth, month)
  const data = parse(rentOverrideSchema, input)
  await db
    .insert(divorceSplitRentMonths)
    .values({ month, ...data })
    .onConflictDoUpdate({ target: divorceSplitRentMonths.month, set: data })
  revalidateApp()
}

export async function setRentPaid(month: string, who: 'vincent' | 'audrey', paid: boolean) {
  parse(zMonth, month)
  const set = who === 'vincent' ? { vincentPaid: paid ? 1 : 0 } : { audreyPaid: paid ? 1 : 0 }
  await db
    .insert(divorceSplitRentMonths)
    .values({ month, ...set })
    .onConflictDoUpdate({ target: divorceSplitRentMonths.month, set })
  revalidateApp()
}
