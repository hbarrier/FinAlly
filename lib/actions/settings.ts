'use server'

import { z } from 'zod'
import { revalidateApp } from './_shared'
import { db } from '../db'
import { userSettings, languages } from '../schema'
import { eq } from 'drizzle-orm'
import type { Modules, BudgetColorSettings } from '../db-types'
import { parse, zName, zCurrency, zSignedAmount, zLocale, budgetColorSettingsSchema } from '../schemas'
import { DEFAULT_LOCALE } from '@/i18n/catalog'

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
  locale: string
  modules: Modules
  budgetColors: BudgetColorSettings
}) {
  const data = parse(
    z.object({
      name: zName,
      currency: zCurrency,
      locale: zLocale,
      modules: zModules,
      budgetColors: budgetColorSettingsSchema,
    }),
    input,
  )

  if (data.locale !== DEFAULT_LOCALE) {
    const known = await db.query.languages.findFirst({ where: eq(languages.code, data.locale) })
    if (!known) throw new Error('errors.invalidInput')
  }

  await db
    .update(userSettings)
    .set({
      name: data.name,
      currency: data.currency,
      locale: data.locale,
      budgetColors: JSON.stringify(data.budgetColors),
      ...moduleFlags(data.modules),
    })
    .where(eq(userSettings.id, 1))

  revalidateApp()
}
