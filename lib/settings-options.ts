import type { ModuleKey, BudgetColorSettings } from './db-types'

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

/** The app's named color tokens (see components/fern/color-vars.ts's COLOR_VARS),
 *  used for category swatches and, here, budget color-coding settings. */
export const CATEGORY_COLORS = ['terracotta', 'sage', 'rose', 'teal', 'lilac', 'butter'] as const

/** Reproduces today's hardcoded 80%/sage/butter/rose behavior — used whenever
 *  `user_settings.budget_colors` is null. */
export const DEFAULT_BUDGET_COLORS: BudgetColorSettings = {
  expense: { threshold: 0.8, colors: { under: 'sage', near: 'butter', atOrOver: 'rose' } },
  income: { threshold: 0.8, colors: { under: 'rose', near: 'butter', atOrOver: 'sage' } },
}
