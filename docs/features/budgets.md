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
| [app/(app)/budgets/page.tsx](../../app/(app)/budgets/page.tsx) | Server Component; fetches the single budget with its lines, categories, merchants, the trailing-12-months transactions, the trailing-12-months recurring instances, the budget color settings, and (when the Recurring module is enabled) the recurring items used by the line sheet's picker |
| [app/(app)/budgets/budgets-client.tsx](../../app/(app)/budgets/budgets-client.tsx) | Client Component; Monthly/Yearly tabs, starting-month picker, four total cards (Revenue/Expenses × Monthly/Yearly), per-category rows with expand-to-lines, progress bars |
| [components/fern/sheets/budget-line-sheet.tsx](../../components/fern/sheets/budget-line-sheet.tsx) | Add / edit one line; `initialFrequency` defaults a new line to the active tab; optional "From recurring" picker links a line to a specific recurring template |
| [lib/actions/budgets.ts](../../lib/actions/budgets.ts) | `createBudget`, `updateBudget`, `deleteBudget`, `addBudgetLine`, `updateBudgetLine`, `deleteBudgetLine`, `createBudgetFromSimulation` |
| [lib/queries/month-actuals.ts](../../lib/queries/month-actuals.ts) | `getRecentTransactionsForBudget` — the single data source for both tabs (trailing 12 months, raw per-transaction rows including `recurringId` and `cleared`) |
| [lib/queries/user-settings.ts](../../lib/queries/user-settings.ts) | `getBudgetColorSettings` — the color-coding config (see "Color coding" below) |
| [lib/derive.ts](../../lib/derive.ts) | `budgetLineMonthly`, `budgetCategoryMonthly`, `monthBudgetComparison`, `budgetWaterfall`, `ratioState`, `plannedUnclearedIncome` |

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

**Yearly ad-hoc first:** within tier 3, a category's yearly generic line takes
priority over its monthly one. If a category has exactly one generic yearly
line, the Monthly tab's tier 3 never claims that category's leftover spend —
it's left in the pool so it falls through to the Yearly tab's generic line
instead (`deferGenericCategories` in `budgetWaterfall`). This applies even
when a €0 monthly ad-hoc line already exists for that category: it claims
nothing once an unambiguous yearly ad-hoc line is present. Only when no such
yearly line exists does unmatched spend fall to a monthly generic line, or
flag `needsOtherLine` so the page auto-creates one at €0 (see below). Example:
Logement has both `Other Logement` (monthly, €0) and `Charges additionelles`
(yearly, ad-hoc) — unmatched Logement spend goes to `Charges additionelles`;
`Other Logement` catches nothing unless `Charges additionelles` is removed.

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

`needsOtherLine` (see the waterfall's yearly-ad-hoc-first rule above) is
checked on every page load (`app/(app)/budgets/page.tsx`): for each flagged
category/frequency gap, a `budget_lines` row named `Other <category>` is
auto-inserted at that frequency with `amount: 0`, so the next render has a
generic line to attach future unmatched spend to.

### Movements modal
Clicking a category's actual-spent figure (either tab) opens
`CategoryMovementsModal`, listing the individual transactions behind that
number. These come straight off the `budgetWaterfall` result (`movements` per
category) — the same computation that produced the total, not a separate
recomputation, so the list is always provably consistent with what's displayed.

### Deleting
`deleteBudget` removes the budget and its lines. Categories and transactions are
untouched.

### Color coding
Both the four total cards and every per-category progress bar share one
ratio-state function, `ratioState(actual, budgeted, threshold)` (`lib/derive.ts`),
returning `'under' | 'near' | 'atOrOver'`. The threshold and the color assigned to
each of the three states are user-configurable, **independently for expense and
income categories**, via `getBudgetColorSettings()` / the Settings page (see
[docs/features/settings.md](./settings.md#budget-colors)). Colors are one of the
app's six named category-color tokens (`CATEGORY_COLORS`), resolved through
`COLOR_VARS` and applied inline (not via CSS classes), so any token works in both
themes.

Expense defaults reproduce the original hardcoded behavior: `under` → sage,
`near` (above 80% of budget) → butter, `atOrOver` (above budget) → rose. Income
defaults are the reverse — `under` → rose, `near` → butter, `atOrOver` → sage —
since for revenue, being at or above budget is the good outcome. The "Over"
badge on a per-category row is likewise kind-aware: it only appears for the
*bad* state of that category's kind (`atOrOver` for expense, `under` for
income).

### Planned recurring revenue
Each Revenue total card also renders a second, lighter bar segment showing
budget-linked recurring income — an income budget line with `sourceRecurringId`
set — that's expected within the card's period (the Monthly card's current
month, or the Yearly card's `[startMonth, currentMonth]` window) but not yet
cleared: either no transaction has been recorded for that occurrence yet, or one
has but with `cleared = 0`. A cleared, linked occurrence is already counted in
the card's solid "actual" segment and is excluded here to avoid double-counting.
This is computed by `plannedUnclearedIncome` (`lib/derive.ts`), which reuses the
already-materialized `recurring_instances` rows rather than recomputing cadence
math. The segment's color reflects `actual + planned` against the budget (via
`ratioState`, using the softer `.bg` variant of the resulting state's color) —
i.e. whether the still-uncleared amount would bring the total closer to, or
past, budget. This segment is total-card-only; per-category income bars are not
affected by it.

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
