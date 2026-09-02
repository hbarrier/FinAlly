import { int, real, text, sqliteTable, unique, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

// --- categories ---
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('tag'),
  color: text('color').notNull().default('teal'),
  kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
  isPensionAlimentaire: int('is_pension_alimentaire').notNull().default(0),
  isActive: int('is_active').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
}, (t) => [
  // Special categories the reimbursements / divorce modules depend on: exactly one each.
  uniqueIndex('categories_reimbursement_name_unique')
    .on(t.name)
    .where(sql`${t.name} = 'Remboursements'`),
  uniqueIndex('categories_pension_alimentaire_unique')
    .on(t.isPensionAlimentaire)
    .where(sql`${t.isPensionAlimentaire} = 1`),
])

// --- merchants ---
export const merchants = sqliteTable(
  'merchants',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    comment: text('comment'),
    categoryId: text('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    isActive: int('is_active').notNull().default(1),
  },
  (t) => [
    index('merchants_is_active_idx').on(t.isActive),
    index('merchants_category_id_idx').on(t.categoryId),
  ],
)

// --- recurring ---
export const recurring = sqliteTable('recurring', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
  method: text('method', { enum: ['card', 'transfer', 'cash', 'check', 'debit', 'paypal'] })
    .notNull()
    .default('card'),
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  merchantId: text('merchant_id').references(() => merchants.id, {
    onDelete: 'set null',
  }),
  cadence: text('cadence', {
    enum: ['monthly', 'yearly'],
  }).notNull(),
  dayOfMonth: int('day_of_month'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  monthRules: text('month_rules'),
})

// --- recurring amounts (time-versioned history) ---
export const recurringAmounts = sqliteTable(
  'recurring_amounts',
  {
    id: text('id').primaryKey(),
    recurringId: text('recurring_id')
      .notNull()
      .references(() => recurring.id, { onDelete: 'cascade' }),
    amount: real('amount').notNull(),
    startDate: text('start_date').notNull(),
  },
  (t) => [index('recurring_amounts_recurring_id_idx').on(t.recurringId)],
)

// --- recurring instances (one per recurring × month) ---
export const recurringInstances = sqliteTable(
  'recurring_instances',
  {
    id: text('id').primaryKey(),
    recurringId: text('recurring_id')
      .notNull()
      .references(() => recurring.id, { onDelete: 'cascade' }),
    month: text('month').notNull(), // YYYY-MM
    status: text('status', { enum: ['expected', 'linked', 'not_applicable'] })
      .notNull()
      .default('expected'),
    transactionId: text('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    unique('recurring_instances_recurring_month_unique').on(t.recurringId, t.month),
    index('recurring_instances_recurring_id_idx').on(t.recurringId),
  ],
)

export const recurringRelations = relations(recurring, ({ many }) => ({
  amounts: many(recurringAmounts),
  instances: many(recurringInstances),
}))

export const recurringAmountsRelations = relations(recurringAmounts, ({ one }) => ({
  recurring: one(recurring, {
    fields: [recurringAmounts.recurringId],
    references: [recurring.id],
  }),
}))

export const recurringInstancesRelations = relations(recurringInstances, ({ one }) => ({
  recurring: one(recurring, {
    fields: [recurringInstances.recurringId],
    references: [recurring.id],
  }),
}))

// --- simulations (what-if scenarios) ---
export const simulations = sqliteTable('simulations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  inputs: text('inputs'), // JSON SimulationInputs used to seed it; null when hand-built
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

export const simulationLines = sqliteTable(
  'simulation_lines',
  {
    id: text('id').primaryKey(),
    simulationId: text('simulation_id')
      .notNull()
      .references(() => simulations.id, { onDelete: 'cascade' }),
    name: text('name'),
    kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
    categoryId: text('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    merchantId: text('merchant_id').references(() => merchants.id, {
      onDelete: 'set null',
    }),
    amount: real('amount').notNull(),
    frequency: text('frequency', { enum: ['monthly', 'yearly'] }).notNull(),
    sourceRecurringId: text('source_recurring_id').references(() => recurring.id, {
      onDelete: 'set null',
    }),
    rollup: int('rollup').notNull().default(0),
    origin: text('origin', { enum: ['manual', 'recurring', 'average', 'rollup'] })
      .notNull()
      .default('manual'),
    priority: text('priority', { enum: ['must', 'should', 'nice'] })
      .notNull()
      .default('should'),
    excludedTxnIds: text('excluded_txn_ids'), // JSON string[] of transaction ids removed from the average; null = none
    avgMonths: int('avg_months'), // look-back used for this line's average; null = simulation's seeded periodMonths
    amountManual: int('amount_manual').notNull().default(0), // 1 = averaged/grouped line amount was hand-edited (MANUAL); 0 = calculated from history (CALC)
  },
  (t) => [
    index('simulation_lines_simulation_id_idx').on(t.simulationId),
    index('simulation_lines_category_id_idx').on(t.categoryId),
  ],
)

export const simulationsRelations = relations(simulations, ({ many }) => ({
  lines: many(simulationLines),
}))

export const simulationLinesRelations = relations(simulationLines, ({ one }) => ({
  simulation: one(simulations, {
    fields: [simulationLines.simulationId],
    references: [simulations.id],
  }),
}))

// --- transactions ---
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    amount: real('amount').notNull(),
    kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
    method: text('method', { enum: ['card', 'transfer', 'cash', 'check', 'debit', 'paypal'] })
      .notNull()
      .default('card'),
    categoryId: text('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    merchantId: text('merchant_id').references(() => merchants.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    recurringId: text('recurring_id').references(() => recurring.id, {
      onDelete: 'set null',
    }),
    recurringAmountId: text('recurring_amount_id').references(() => recurringAmounts.id, {
      onDelete: 'set null',
    }),
    reimbursable: int('reimbursable').notNull().default(0),
    reimbursementTxId: text('reimbursement_tx_id'),
    reimbursementAmountOverride: real('reimbursement_amount_override'),
    reimbursementComment: text('reimbursement_comment'),
    cleared: int('cleared').notNull().default(0),
    claimedDate: text('claimed_date'),
    manualSettlementAt: text('manual_settlement_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index('transactions_category_id_idx').on(t.categoryId),
    index('transactions_merchant_id_idx').on(t.merchantId),
    index('transactions_recurring_id_idx').on(t.recurringId),
    index('transactions_recurring_amount_id_idx').on(t.recurringAmountId),
    index('transactions_date_idx').on(t.date),
    index('transactions_kind_date_idx').on(t.kind, t.date),
  ],
)

// --- budgets ---
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: int('is_active').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

export const budgetLines = sqliteTable(
  'budget_lines',
  {
    id: text('id').primaryKey(),
    budgetId: text('budget_id')
      .notNull()
      .references(() => budgets.id, { onDelete: 'cascade' }),
    name: text('name'),
    kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    merchantId: text('merchant_id').references(() => merchants.id, {
      onDelete: 'set null',
    }),
    amount: real('amount').notNull(),
    frequency: text('frequency', { enum: ['monthly', 'yearly'] }).notNull(),
    recurring: int('recurring').notNull().default(0),
  },
  (t) => [
    index('budget_lines_budget_id_idx').on(t.budgetId),
    index('budget_lines_category_id_idx').on(t.categoryId),
  ],
)

export const budgetsRelations = relations(budgets, ({ many }) => ({
  lines: many(budgetLines),
}))

export const budgetLinesRelations = relations(budgetLines, ({ one }) => ({
  budget: one(budgets, {
    fields: [budgetLines.budgetId],
    references: [budgets.id],
  }),
}))

// --- goals (savings targets) ---
export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  target: real('target').notNull(),
  saved: real('saved').notNull().default(0),
  icon: text('icon').notNull().default('cat-seed'),
  color: text('color').notNull().default('sage'),
  deadline: text('deadline'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

// --- user settings (single row) ---
export const userSettings = sqliteTable('user_settings', {
  id: int('id').primaryKey().default(1),
  name: text('name').notNull().default('You'),
  startingBalance: real('starting_balance').notNull().default(0),
  currency: text('currency').notNull().default('EUR'),
  onboarded: int('onboarded').notNull().default(0),
  moduleRecurring: int('module_recurring').notNull().default(1),
  moduleGroups: int('module_groups').notNull().default(0),
  moduleDivorce: int('module_divorce').notNull().default(0),
  moduleBudgets: int('module_budgets').notNull().default(0),
  moduleSimulations: int('module_simulations').notNull().default(0),
  moduleObjectives: int('module_objectives').notNull().default(0),
})

// --- monthly opening balances (global, per calendar month) ---
export const monthlyOpeningBalances = sqliteTable(
  'monthly_opening_balances',
  {
    month: text('month').primaryKey(), // YYYY-MM
    openingBalance: real('opening_balance').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [index('monthly_opening_balances_month_idx').on(t.month)],
)

// --- reimbursement rates (global, time-versioned) ---
export const reimbursementRates = sqliteTable(
  'reimbursement_rates',
  {
    id: text('id').primaryKey(),
    percent: real('percent').notNull(),   // e.g. 75 for 75%
    startDate: text('start_date').notNull(), // ISO date, rate applies from this date onward
  },
  (t) => [index('reimbursement_rates_start_date_idx').on(t.startDate)],
)

// --- tax allocations (daughter assignment per qualifying income transaction) ---
export const taxAllocations = sqliteTable('tax_allocations', {
  transactionId: text('transaction_id')
    .primaryKey()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  allocation: text('allocation', { enum: ['audrey', 'lucie', 'split'] }).notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

// --- reimbursement claims (one per month, tracks claim date + settlement) ---
export const reimbursementClaims = sqliteTable(
  'reimbursement_claims',
  {
    id: text('id').primaryKey(),
    month: text('month').notNull().unique(), // YYYY-MM
    claimDate: text('claim_date').notNull(),
    settledAt: text('settled_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [index('reimbursement_claims_month_idx').on(t.month)],
)

// --- reimbursement claim allocations (income txns linked to a month claim) ---
export const reimbursementClaimAllocations = sqliteTable(
  'reimbursement_claim_allocations',
  {
    id: text('id').primaryKey(),
    claimId: text('claim_id')
      .notNull()
      .references(() => reimbursementClaims.id, { onDelete: 'cascade' }),
    reimbursementTxId: text('reimbursement_tx_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
  },
  (t) => [
    unique('rca_claim_tx_unique').on(t.claimId, t.reimbursementTxId),
    index('rca_claim_id_idx').on(t.claimId),
    index('rca_tx_id_idx').on(t.reimbursementTxId),
  ],
)

// --- reimbursement allocations (income-driven mapping) ---
export const reimbursementAllocations = sqliteTable(
  'reimbursement_allocations',
  {
    id: text('id').primaryKey(),
    reimbursementTxId: text('reimbursement_tx_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    expenseTxId: text('expense_tx_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    amount: real('amount').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    unique('reimbursement_allocations_income_expense_unique').on(t.reimbursementTxId, t.expenseTxId),
    index('reimbursement_allocations_reimbursement_tx_id_idx').on(t.reimbursementTxId),
    index('reimbursement_allocations_expense_tx_id_idx').on(t.expenseTxId),
  ],
)

// --- groups (generic shared-expense groups) ---
export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  settlementDelayDays: int('settlement_delay_days'),
  isActive: int('is_active').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

// --- group members (the app user + others; exactly one is_self per group) ---
export const groupMembers = sqliteTable(
  'group_members',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isSelf: int('is_self').notNull().default(0),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index('group_members_group_id_idx').on(t.groupId),
    uniqueIndex('group_members_group_self_unique').on(t.groupId).where(sql`${t.isSelf} = 1`),
  ],
)

// --- group member shares (time-versioned % split; active %s sum to 100) ---
export const groupMemberShares = sqliteTable(
  'group_member_shares',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => groupMembers.id, { onDelete: 'cascade' }),
    percent: real('percent').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index('group_member_shares_group_id_idx').on(t.groupId),
    index('group_member_shares_member_id_idx').on(t.memberId),
  ],
)

// --- group entries (shared expenses / shared revenues) ---
export const groupEntries = sqliteTable(
  'group_entries',
  {
    id: text('id').primaryKey(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    amount: real('amount').notNull(),
    direction: text('direction', { enum: ['expense', 'income'] })
      .notNull()
      .default('expense'),
    description: text('description'),
    payerId: text('payer_id')
      .notNull()
      .references(() => groupMembers.id, { onDelete: 'cascade' }),
    transactionId: text('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    /** 1 = this entry created its linked transaction (delete it together); 0 = an existing movement was allocated. */
    ownsTransaction: int('owns_transaction').notNull().default(1),
    involvesAll: int('involves_all').notNull().default(1),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index('group_entries_group_id_idx').on(t.groupId),
    index('group_entries_group_date_idx').on(t.groupId, t.date),
    uniqueIndex('group_entries_transaction_id_unique')
      .on(t.transactionId)
      .where(sql`${t.transactionId} is not null`),
  ],
)

// --- group entry participants (rows only when involves_all = 0) ---
export const groupEntryParticipants = sqliteTable(
  'group_entry_participants',
  {
    id: text('id').primaryKey(),
    entryId: text('entry_id')
      .notNull()
      .references(() => groupEntries.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => groupMembers.id, { onDelete: 'cascade' }),
  },
  (t) => [
    unique('group_entry_participants_entry_member_unique').on(t.entryId, t.memberId),
    index('group_entry_participants_entry_id_idx').on(t.entryId),
  ],
)

// --- group entry overrides (fixed amount for one member on one entry) ---
export const groupEntryOverrides = sqliteTable(
  'group_entry_overrides',
  {
    id: text('id').primaryKey(),
    entryId: text('entry_id')
      .notNull()
      .references(() => groupEntries.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => groupMembers.id, { onDelete: 'cascade' }),
    amount: real('amount').notNull(),
    comment: text('comment'),
  },
  (t) => [
    unique('group_entry_overrides_entry_member_unique').on(t.entryId, t.memberId),
    index('group_entry_overrides_entry_id_idx').on(t.entryId),
  ],
)

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  shares: many(groupMemberShares),
  entries: many(groupEntries),
}))

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
}))

export const groupMemberSharesRelations = relations(groupMemberShares, ({ one }) => ({
  group: one(groups, { fields: [groupMemberShares.groupId], references: [groups.id] }),
  member: one(groupMembers, {
    fields: [groupMemberShares.memberId],
    references: [groupMembers.id],
  }),
}))

export const groupEntriesRelations = relations(groupEntries, ({ one, many }) => ({
  group: one(groups, { fields: [groupEntries.groupId], references: [groups.id] }),
  payer: one(groupMembers, { fields: [groupEntries.payerId], references: [groupMembers.id] }),
  participants: many(groupEntryParticipants),
  overrides: many(groupEntryOverrides),
}))

export const groupEntryParticipantsRelations = relations(groupEntryParticipants, ({ one }) => ({
  entry: one(groupEntries, {
    fields: [groupEntryParticipants.entryId],
    references: [groupEntries.id],
  }),
}))

export const groupEntryOverridesRelations = relations(groupEntryOverrides, ({ one }) => ({
  entry: one(groupEntries, {
    fields: [groupEntryOverrides.entryId],
    references: [groupEntries.id],
  }),
}))

