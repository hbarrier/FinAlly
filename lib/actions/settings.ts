'use server'

import { revalidateApp } from './_shared'
import { db } from '../db'
import { userSettings } from '../schema'
import { eq } from 'drizzle-orm'
import type { Modules } from '../db-types'
import { CURRENCIES } from '../settings-options'

function moduleFlags(modules: Modules) {
  return {
    moduleRecurring: modules.recurring ? 1 : 0,
    moduleDivorce: modules.divorce ? 1 : 0,
    moduleBudgets: modules.budgets ? 1 : 0,
    moduleSimulations: modules.simulations ? 1 : 0,
    moduleObjectives: modules.objectives ? 1 : 0,
  }
}

function cleanName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')
  return trimmed
}

function cleanCurrency(currency: string) {
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    throw new Error(`Unsupported currency: ${currency}`)
  }
  return currency
}

export async function completeOnboarding(data: {
  name: string
  currency: string
  startingBalance: number
  modules: Modules
}) {
  const startingBalance = Number(data.startingBalance)
  if (!Number.isFinite(startingBalance)) throw new Error('Initial balance must be a number')

  await db
    .update(userSettings)
    .set({
      name: cleanName(data.name),
      currency: cleanCurrency(data.currency),
      startingBalance,
      onboarded: 1,
      ...moduleFlags(data.modules),
    })
    .where(eq(userSettings.id, 1))

  revalidateApp()
}

export async function updateSettings(data: {
  name: string
  currency: string
  modules: Modules
}) {
  await db
    .update(userSettings)
    .set({
      name: cleanName(data.name),
      currency: cleanCurrency(data.currency),
      ...moduleFlags(data.modules),
    })
    .where(eq(userSettings.id, 1))

  revalidateApp()
}
