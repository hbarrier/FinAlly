import { cache } from 'react'
import { db } from '@/lib/db'
import type { Modules, BudgetColorSettings } from '@/lib/db-types'
import { DEFAULT_BUDGET_COLORS } from '@/lib/settings-options'
import { budgetColorSettingsSchema } from '@/lib/schemas'

export const getUserSettings = cache(async () => {
  return db.query.userSettings.findFirst()
})

export const getModules = cache(async (): Promise<Modules> => {
  const s = await getUserSettings()
  return {
    recurring: (s?.moduleRecurring ?? 1) === 1,
    groups: (s?.moduleGroups ?? 0) === 1,
    divorce: (s?.moduleDivorce ?? 0) === 1,
    budgets: (s?.moduleBudgets ?? 0) === 1,
    simulations: (s?.moduleSimulations ?? 0) === 1,
    objectives: (s?.moduleObjectives ?? 0) === 1,
  }
})

function parseBudgetColors(raw: string | null): BudgetColorSettings {
  if (!raw) return DEFAULT_BUDGET_COLORS
  try {
    const parsed = budgetColorSettingsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : DEFAULT_BUDGET_COLORS
  } catch {
    return DEFAULT_BUDGET_COLORS
  }
}

export const getBudgetColorSettings = cache(async (): Promise<BudgetColorSettings> => {
  const s = await getUserSettings()
  return parseBudgetColors(s?.budgetColors ?? null)
})
