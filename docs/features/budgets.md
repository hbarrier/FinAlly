# Budgets

**Route:** `/budgets`

## Overview

There is exactly **one budget** in the app. It is a line-level plan, normally a
copy of a simulation: each budget line sits under a category and optionally names a
merchant or a specific recurring template. The page has two tabs, **Monthly** and
**Yearly**, each showing only the lines of that `frequency`, compared against
actual spend via one shared matching engine (`budgetWaterfall`, see below).

## Reference files

| File | Role |
|---|---|
| [app/(app)/budgets/page.tsx](../../app/(app)/budgets/page.tsx) | Server Component; fetches the single budget with its lines, categories, merchants, the trailing-12-months transactions, and (when the Recurring module is enabled) the recurring items used by the line sheet's picker |
| [app/(app)/budgets/budgets-client.tsx](../../app/(app)/budgets/budgets-client.tsx) | Client Component; Monthly/Yearly tabs, starting-month picker, per-category rows with expand-to-lines, progress bars |
| [components/fern/sheets/budget-line-sheet.tsx](../../components/fern/sheets/budget-line-sheet.tsx) | Add / edit one line; `initialFrequency` defaults a new line to the active tab; optional "From recurring" picker links a line to a specific recurring template |
| [lib/actions/budgets.ts](../../lib/actions/budgets.ts) | `createBudget`, `updateBudget`, `deleteBudget`, `addBudgetLine`, `updateBudgetLine`, `deleteBudgetLine`, `createBudgetFromSimulation` |
| [lib/queries/month-actuals.ts](../../lib/queries/month-actuals.ts) | `getRecentTransactionsForBudget` — the single data source for both tabs (trailing 12 months, raw per-transaction rows including `recurringId`) |
| [lib/derive.ts](../../lib/derive.ts) | `budgetLineMonthly`, `budgetCategoryMonthly`, `monthBudgetComparison`, `budgetWaterfall` |

## Data model

`budgets` holds a single row. `budget_lines` has one row per line:
`name`, `kind` (`expense` / `income`), `categoryId` (required), `merchantId`
(optional), `amount`, `frequency` (`monthly` / `yearly`), `recurring` (0/1),
`sourceRecurringId` (optional FK → `recurring`). Unlike its counterpart on
`simulation_lines` (a one-time creation snapshot, never editable), `budget_lines.
sourceRecurringId` is a **live matching key** — it can be set or changed at any
time via the line sheet, because relinking an existing line (not just seeding a
new one) is the whole point of the field.

## Business rules

### Single budget
Any create path (`createBudget`, `createBudgetFromSimulation`) deletes the existing
budget first (lines cascade). The **New budget** button and the simulation
**Replace budget** action both warn before replacing.

### The matching waterfall
Both tabs share one engine, `budgetWaterfall` (`lib/derive.ts`), which matches
actual transactions to lines from most to least specific:

1. **Recurring (tier 1)** — global and window-independent: every transaction
   whose `recurringId` equals a line's `sourceRecurringId` belongs to that line
   alone, in any month, on top of tiers 2/3. This is removed from the
   merchant/category pool for *both* tabs before anything else runs, so a
   recurring bill linked to a monthly line can never also inflate the Yearly
   tab's category total (or vice versa for a yearly-cadence bill).
2. **Merchant (tier 2)** — of what's left, a line with a `merchantId` (and no
   `sourceRecurringId`) claims every remaining transaction in its category with
   that exact merchant.
3. **Category (tier 3)** — a category's single remaining merchant-less,
   recurring-less ("generic") line, if there is exactly one, claims whatever's
   left. With zero or several such lines in one category/frequency, the
   remainder can't be attributed to a single line: those lines show `actual:
   null` (budgeted only) while the category-level total still reflects the true
   remainder.

**Cross-tab exclusivity** ("either monthly or yearly, not both" for tiers 2/3):
the Monthly tab (current month only) is computed first; whatever its tier 2/3
claims for the current month is then removed from the Yearly tab's pool before
Yearly runs (`[startMonth, currentMonth]`). This is safe and one-directional
because Monthly's window is always a subset of Yearly's — the only month they
can ever overlap on.

For months *before* the current one, a lighter version of the same rule
applies (`claimPastMonthsForMonthlyLines`): a past month's transaction is also
excluded from Yearly's pool if a monthly-frequency line could have claimed it
— an exact merchant match, or the category's sole/ambiguous generic line, when
one exists. This never changes what the Monthly tab displays (still
current-month only) — it only stops a category's ongoing monthly-cadence
spend (a merchant subscription with no `sourceRecurringId`, or plain ad-hoc
spend caught by a generic monthly line) from inflating Yearly's total just
because it happened before this month. A category with **no** monthly line at
all is unaffected: its past-month spend still falls to Yearly, same as always.

Category totals: a category's budgeted amount is the sum of its same-frequency
lines. `budgetLineMonthly`/`budgetCategoryMonthly` (÷12 amortization) are used
only by the separate month-vs-budget modal (see below), not by either tab here —
neither tab amortizes.

### Lines
A line must have either a merchant or a name (enforced in the sheet), unless
seeded from a recurring template (which supplies both). All categories are
shown; a category with no lines in the active tab's frequency sits at 0
budgeted (it may still show nonzero actual, from unbudgeted spend).

### Movements modal
Clicking a category's actual-spent figure (either tab) opens
`CategoryMovementsModal`, listing the individual transactions behind that
number. These come straight off the `budgetWaterfall` result (`movements` per
category) — the same computation that produced the total, not a separate
recomputation, so the list is always provably consistent with what's displayed.

### Deleting
`deleteBudget` removes the budget and its lines. Categories and transactions are
untouched.

## From a simulation

`createBudgetFromSimulation` copies **every** simulation line that has a category
into a budget line verbatim (name, kind, category, merchant, amount, frequency,
`sourceRecurringId`); `origin === 'recurring'` lines become `recurring = 1`, the
rest ad-hoc. No rounding.

See also the month-vs-budget modal on the movements page (`monthBudgetComparison`),
which is a separate, older feature **not touched by the waterfall above**: it
compares a single arbitrary calendar month against *all* lines (yearly amortized
÷12 when its own "include yearly" checkbox is on) and matches actual spend to
lines by merchant **and** a recurring boolean flag (recurring-linked transactions
against the recurring line, the rest against the ad-hoc line) — a coarser,
identity-blind rule than the Budgets page's tier-1 matching. Its numbers can
therefore legitimately diverge from the Budgets page's for the same month; this
is an accepted scope boundary, not a bug.
