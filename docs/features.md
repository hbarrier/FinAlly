# Features

Each feature maps to one page in the app. Click the feature name for full detail.

FinAlly is **modular**: a base set of features is always present, and the rest are
optional modules the user turns on at install or later from Settings. See
[Modules](features/modules.md).

## Base (always on)

| Feature | Route | Summary |
|---|---|---|
| [Dashboard](features/dashboard.md) | `/dashboard` | Monthly overview: cashflow totals, balance, spending by category (plus a recurring widget when that module is on) |
| [Transactions](features/transactions.md) | `/transactions` | Full ledger of all income and expenses; filters, cleared status |
| [Import](features/import.md) | `/transactions` (wizard) | CSV bank export ingestion with merchant mapping |
| [Categories](features/categories.md) | `/categories` | Classify transactions into labelled expense and income buckets |
| [Merchants](features/merchants.md) | `/merchants` | Manage vendors, assign default categories, and merge duplicates |
| [Settings](features/settings.md) | `/settings` | Change name, currency, and which modules are enabled |

## Optional modules

| Module | Feature | Route | Summary |
|---|---|---|---|
| `recurring` | [Recurring](features/recurring.md) | `/recurring` | Manage bills and income that repeat on a schedule; scheduled occurrences and recurring links on the ledger |
| `divorce` | [Reimbursements](features/reimbursements.md) | `/reimbursements` | Allocate reimbursement income to reimbursable expenses, manage rates, track settlement |
| `divorce` | Tax Status | `/tax-status` | Allocate reimbursements and pension alimentaire between co-parents for tax |
| `budgets` | [Budgets](features/budgets.md) | `/budgets` | Set monthly spending limits per category and compare against actual spend |
| `simulations` | [Simulations](features/simulations.md) | `/simulations` | Model future changes to income and expenses as named what-if scenarios |
| `objectives` | [Goals](features/goals.md) | `/goals` | Track savings targets with progress rings |
