import type { InferSelectModel } from 'drizzle-orm'
import type { z } from 'zod'
import type { simulationInputsSchema } from './schemas'
import type {
  categories,
  merchants,
  recurring,
  recurringAmounts,
  recurringInstances,
  savingAccounts,
  transactions,
  budgets,
  budgetLines,
  goals,
  userSettings,
  monthlyOpeningBalances,
  reimbursementRates,
  reimbursementAllocations,
  reimbursementClaims,
  reimbursementClaimAllocations,
  taxAllocations,
  simulations,
  simulationLines,
  groups,
  groupMembers,
  groupMemberShares,
  groupEntries,
  groupEntryParticipants,
  groupEntryOverrides,
} from './schema'

export type Category = InferSelectModel<typeof categories>
export type Merchant = InferSelectModel<typeof merchants>
export type Recurring = InferSelectModel<typeof recurring>
export type RecurringAmount = InferSelectModel<typeof recurringAmounts>
export type Transaction = InferSelectModel<typeof transactions>
export type SavingAccount = InferSelectModel<typeof savingAccounts>
export type Budget = InferSelectModel<typeof budgets>
export type BudgetLine = InferSelectModel<typeof budgetLines>
export type BudgetWithLines = Budget & { lines: BudgetLine[] }
export type Goal = InferSelectModel<typeof goals>
export type UserSettings = InferSelectModel<typeof userSettings>

export type ModuleKey =
  | 'recurring'
  | 'groups'
  | 'divorce'
  | 'budgets'
  | 'simulations'
  | 'objectives'
export type Modules = Record<ModuleKey, boolean>
export type MonthlyOpeningBalance = InferSelectModel<typeof monthlyOpeningBalances>
export type ReimbursementRate = InferSelectModel<typeof reimbursementRates>
export type ReimbursementAllocation = InferSelectModel<typeof reimbursementAllocations>
export type ReimbursementClaim = InferSelectModel<typeof reimbursementClaims>
export type ReimbursementClaimAllocation = InferSelectModel<typeof reimbursementClaimAllocations>

export type RecurringInstance = InferSelectModel<typeof recurringInstances>

export type RecurringWithAmounts = Recurring & { amounts: RecurringAmount[] }

export type TransactionKind = Transaction['kind']
export type RecurringCadence = Recurring['cadence']

export type TaxAllocation = InferSelectModel<typeof taxAllocations>
export type TaxAllocationValue = TaxAllocation['allocation']

export type Simulation = InferSelectModel<typeof simulations>
export type SimulationLine = InferSelectModel<typeof simulationLines>
export type SimulationWithLines = Simulation & { lines: SimulationLine[] }
export type SimulationLineFrequency = SimulationLine['frequency']
export type SimulationLinePriority = SimulationLine['priority']

export type Group = InferSelectModel<typeof groups>
export type GroupMember = InferSelectModel<typeof groupMembers>
export type GroupMemberShare = InferSelectModel<typeof groupMemberShares>
export type GroupEntry = InferSelectModel<typeof groupEntries>
export type GroupEntryParticipant = InferSelectModel<typeof groupEntryParticipants>
export type GroupEntryOverride = InferSelectModel<typeof groupEntryOverrides>
export type GroupEntryDirection = GroupEntry['direction']
export type GroupEntryWithParts = GroupEntry & {
  participants: GroupEntryParticipant[]
  overrides: GroupEntryOverride[]
}

/** The wizard inputs a simulation was seeded from — validated by `simulationInputsSchema`. */
export type SimulationInputs = z.infer<typeof simulationInputsSchema>
