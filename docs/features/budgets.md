# Budgets

**Route:** `/budgets`

## Overview

Budgets let you set a monthly spending limit per category and track how close you are to that limit. Each budget is a single number — there is no weekly or annual budget option. The page shows current-month actual spend against the limit for every budgeted category.

## Reference files

| File | Role |
|---|---|
| [app/(app)/budgets/page.tsx](../../app/(app)/budgets/page.tsx) | Server Component; fetches budgets, categories, and current-month transactions |
| [app/(app)/budgets/budgets-client.tsx](../../app/(app)/budgets/budgets-client.tsx) | Client Component; progress bars, add/edit/delete budget UI |
| [lib/actions/budgets.ts](../../lib/actions/budgets.ts) | `upsertBudget`, `deleteBudget` |
| [lib/derive.ts](../../lib/derive.ts) | `thisMonthTransactions`, `spendingByCategory` |

## Business rules

### One budget per category
The `budgets` table has a unique constraint on `categoryId`. `upsertBudget` uses `onConflictDoUpdate`, so editing the limit for an existing budget replaces it in place.

### Scope
Budgets apply to **expense** transactions only, scoped to the current calendar month. Income categories can have a budget record but are not meaningful in the current UI.

### Progress states
Each budget card computes: `actual = sum of expenses in category this month`.

| State | Condition |
|---|---|
| OK | `actual < limitAmount × 0.8` |
| Warning | `actual >= limitAmount × 0.8` |
| Over | `actual > limitAmount` |

Visual progress bars use CSS classes `fern-budget-bar` and `fern-budget-fill`, with colour variants per state.

### Categories without a budget
Categories that have transactions but no budget record are visible on the categories page (with their month spend) but do not appear on the budgets page unless a limit is set.

### Deleting a budget
Deletes only the budget record. The underlying category and its transactions are unaffected.
