import type { ModuleKey } from './db-types'

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK'] as const

export const DEFAULT_CURRENCY = 'EUR'

export const MODULE_META: { key: ModuleKey; label: string; description: string }[] = [
  { key: 'recurring', label: 'Recurrings', description: 'Bills and income that repeat on a schedule' },
  { key: 'budgets', label: 'Budgets', description: 'Monthly spending limits per category' },
  { key: 'objectives', label: 'Goals', description: 'Savings goals with progress rings' },
  { key: 'simulations', label: 'Simulations', description: 'What-if scenarios for future income and expenses' },
  { key: 'divorce', label: 'Divorce', description: 'Reimbursements and tax status' },
]
