import type { InferSelectModel } from 'drizzle-orm'
import type {
  categories,
  merchants,
  recurring,
  recurringAmounts,
  recurringInstances,
  transactions,
  budgets,
  goals,
  userSettings,
  monthlyOpeningBalances,
  reimbursementRates,
  reimbursementAllocations,
  reimbursementClaims,
  reimbursementClaimAllocations,
} from './schema'

export type Category = InferSelectModel<typeof categories>
export type Merchant = InferSelectModel<typeof merchants>
export type Recurring = InferSelectModel<typeof recurring>
export type RecurringAmount = InferSelectModel<typeof recurringAmounts>
export type Transaction = InferSelectModel<typeof transactions>
export type Budget = InferSelectModel<typeof budgets>
export type Goal = InferSelectModel<typeof goals>
export type UserSettings = InferSelectModel<typeof userSettings>
export type MonthlyOpeningBalance = InferSelectModel<typeof monthlyOpeningBalances>
export type ReimbursementRate = InferSelectModel<typeof reimbursementRates>
export type ReimbursementAllocation = InferSelectModel<typeof reimbursementAllocations>
export type ReimbursementClaim = InferSelectModel<typeof reimbursementClaims>
export type ReimbursementClaimAllocation = InferSelectModel<typeof reimbursementClaimAllocations>

export type RecurringInstance = InferSelectModel<typeof recurringInstances>

export type RecurringWithAmounts = Recurring & { amounts: RecurringAmount[] }

export type TransactionKind = Transaction['kind']
export type RecurringCadence = Recurring['cadence']

export type TaxAllocationValue = 'audrey' | 'lucie' | 'split'
