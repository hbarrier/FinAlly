'use server'

import { z } from 'zod'
import { revalidateApp } from './_shared'
import { db } from '../db'
import { userSettings } from '../schema'
import { eq } from 'drizzle-orm'
import type { Modules } from '../db-types'
import { parse, zName, zCurrency, zSignedAmount } from '../schemas'

const zModules = z.object({
  recurring: z.boolean(),
  groups: z.boolean(),
  divorce: z.boolean(),
  budgets: z.boolean(),
  simulations: z.boolean(),
  objectives: z.boolean(),
})

function moduleFlags(modules: Modules) {
  return {
    moduleRecurring: modules.recurring ? 1 : 0,
    moduleGroups: modules.groups ? 1 : 0,
    moduleDivorce: modules.divorce ? 1 : 0,
    moduleBudgets: modules.budgets ? 1 : 0,
    moduleSimulations: modules.simulations ? 1 : 0,
    moduleObjectives: modules.objectives ? 1 : 0,
  }
}

export async function completeOnboarding(input: {
  name: string
  currency: string
  startingBalance: number
  modules: Modules
}) {
  const data = parse(
    z.object({
      name: zName,
      currency: zCurrency,
      startingBalance: zSignedAmount,
      modules: zModules,
    }),
    input,
  )

  await db
    .update(userSettings)
    .set({
      name: data.name,
      currency: data.currency,
      startingBalance: data.startingBalance,
      onboarded: 1,
      ...moduleFlags(data.modules),
    })
    .where(eq(userSettings.id, 1))

  revalidateApp()
}

export async function updateSettings(input: {
  name: string
  currency: string
  modules: Modules
}) {
  const data = parse(
    z.object({ name: zName, currency: zCurrency, modules: zModules }),
    input,
  )
  await db
    .update(userSettings)
    .set({
      name: data.name,
      currency: data.currency,
      ...moduleFlags(data.modules),
    })
    .where(eq(userSettings.id, 1))

  revalidateApp()
}
