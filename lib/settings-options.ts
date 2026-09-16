import type { ModuleKey } from './db-types'

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK'] as const

export const DEFAULT_CURRENCY = 'EUR'

/** Module toggles in display order. Labels/descriptions come from the `modules` messages. */
export const MODULE_KEYS: ModuleKey[] = [
  'recurring',
  'budgets',
  'objectives',
  'simulations',
  'groups',
  'divorce',
]
