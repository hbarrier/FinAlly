import { cache } from 'react'
import { db } from '@/lib/db'
import type { Modules } from '@/lib/db-types'

export const getUserSettings = cache(async () => {
  return db.query.userSettings.findFirst()
})

export const getModules = cache(async (): Promise<Modules> => {
  const s = await getUserSettings()
  return {
    recurring: (s?.moduleRecurring ?? 1) === 1,
    groups: (s?.moduleGroups ?? 0) === 1,
    taxstatus: (s?.moduleTaxstatus ?? 0) === 1,
    budgets: (s?.moduleBudgets ?? 0) === 1,
    simulations: (s?.moduleSimulations ?? 0) === 1,
    objectives: (s?.moduleObjectives ?? 0) === 1,
  }
})
