# Budgets

**Route:** `/budgets`

## Overview

There is exactly **one budget** in the app. It is a line-level plan, normally a
copy of a simulation: each budget line sits under a category and optionally names a
merchant. The page compares this month's actual spend against the budget, per
category, always for the current calendar month.

## Reference files

| File | Role |
|---|---|
| [app/(app)/budgets/page.tsx](../../app/(app)/budgets/page.tsx) | Server Component; fetches the single budget with its lines, categories, merchants, transactions |
| [app/(app)/budgets/budgets-client.tsx](../../app/(app)/budgets/budgets-client.tsx) | Client Component; per-category rows with expand-to-lines, progress bars |
| [components/fern/sheets/budget-line-sheet.tsx](../../components/fern/sheets/budget-line-sheet.tsx) | Add / edit one line |
| [lib/actions/budgets.ts](../../lib/actions/budgets.ts) | `createBudget`, `updateBudget`, `deleteBudget`, `addBudgetLine`, `updateBudgetLine`, `deleteBudgetLine`, `createBudgetFromSimulation` |
| [lib/derive.ts](../../lib/derive.ts) | `budgetLineMonthly`, `budgetCategoryMonthly`, `monthActualByCategory`, `monthBudgetComparison` |

## Data model

`budgets` holds a single row. `budget_lines` has one row per line:
`name`, `kind` (`expense` / `income`), `categoryId` (required), `merchantId`
(optional), `amount`, `frequency` (`monthly` / `yearly`), `recurring` (0/1).

## Business rules

### Single budget
Any create path (`createBudget`, `createBudgetFromSimulation`) deletes the existing
budget first (lines cascade). The **New budget** button and the simulation
**Replace budget** action both warn before replacing.

### Category totals are calculated
A category's budgeted amount is the sum of its lines, each normalized to a month
(`yearly` lines ÷ 12). Totals are read-only; the user edits the lines.

### Lines
A line must have either a merchant or a name (enforced in the sheet). All
categories are shown; a category with no lines sits at 0.

### Comparison
Always current calendar month. `actual` = this month's non-planned transactions in
the category. States: OK, Warning (`actual > budgeted × 0.8`), Over
(`actual > budgeted`). Bars use `fern-budget-bar` / `fern-budget-fill`.

### Deleting
`deleteBudget` removes the budget and its lines. Categories and transactions are
untouched.

## From a simulation

`createBudgetFromSimulation` copies **every** simulation line that has a category
into a budget line verbatim (name, kind, category, merchant, amount, frequency);
`origin === 'recurring'` lines become `recurring = 1`, the rest ad-hoc. No
rounding. See also the month-vs-budget modal on the movements page, which matches
actual spend to lines by merchant **and** recurring nature (recurring-linked
transactions against the recurring line, the rest against the ad-hoc line).
