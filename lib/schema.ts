import { int, real, text, sqliteTable, unique, index } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

// --- categories ---
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('tag'),
  color: text('color').notNull().default('teal'),
  kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
  isPensionAlimentaire: int('is_pension_alimentaire').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
})

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
    enum: ['weekly', 'monthly', 'yearly'],
  }).notNull(),
  dayOfMonth: int('day_of_month'),
  dayOfWeek: int('day_of_week'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
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

export const recurringRelations = relations(recurring, ({ many }) => ({
  amounts: many(recurringAmounts),
}))

export const recurringAmountsRelations = relations(recurringAmounts, ({ one }) => ({
  recurring: one(recurring, {
    fields: [recurringAmounts.recurringId],
    references: [recurring.id],
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

// --- transactions FTS (full-text search on note) ---
// Backed by SQLite FTS5 virtual table (created in a SQL migration).
export const transactionsFts = sqliteTable('transactions_fts', {
  transactionId: text('transaction_id').notNull(),
  note: text('note').notNull(),
})

// --- budgets ---
export const budgets = sqliteTable(
  'budgets',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    limitAmount: real('limit_amount').notNull(),
  },
  (t) => [unique('budgets_category_unique').on(t.categoryId)],
)

// --- goals ---
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
