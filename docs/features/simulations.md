# Simulations

**Route:** `/simulations`, `/simulations/[id]`

## Overview

Simulations model "what if" scenarios for future income and expenses — a raise, a new bill, a job change — without touching real transactions or recurring templates. A simulation is a named, optionally described container for independent revenue/expense lines, each with a category, optional merchant, an amount, and a monthly or yearly frequency.

A line can be created from scratch, copied from an existing recurring item, or generated in bulk
at creation time from an include-items checklist. Every generated line is a one-time snapshot:
editing it afterward does not affect the source, and vice versa.

## Reference files

| File | Role |
|---|---|
| [app/(app)/simulations/page.tsx](../../app/(app)/simulations/page.tsx) | Server Component; lists all simulations with their lines |
| [app/(app)/simulations/simulations-client.tsx](../../app/(app)/simulations/simulations-client.tsx) | Client Component; simulation cards with monthly/yearly synthesis, create/duplicate/delete |
| [app/(app)/simulations/[id]/page.tsx](../../app/(app)/simulations/[id]/page.tsx) | Server Component; fetches one simulation plus categories, merchants, recurring items, and transactions |
| [app/(app)/simulations/[id]/simulation-detail-client.tsx](../../app/(app)/simulations/[id]/simulation-detail-client.tsx) | Client Component; view toggle, totals, simulation-vs-actuals chart, category breakdown, line list |
| [lib/actions/simulations.ts](../../lib/actions/simulations.ts) | All simulation and line mutations |
| [lib/derive.ts](../../lib/derive.ts) | `simulationTotals`, `simulationLinesByCategory`, `currentRecurringMonthlyNet`, `simulationBalanceProjection` |
| [components/fern/sheets/simulation-sheet.tsx](../../components/fern/sheets/simulation-sheet.tsx) | Add / edit simulation name & description; create-time include-items checklist |
| [components/fern/sheets/simulation-line-sheet.tsx](../../components/fern/sheets/simulation-line-sheet.tsx) | Add / edit a line, with an optional "copy from recurring" picker |

## Fields

### Simulation
| Field | Notes |
|---|---|
| `name` | Required |
| `description` | Optional |

### Simulation line
| Field | Notes |
|---|---|
| `name` | Optional label, independent of category |
| `kind` | `'expense'` or `'income'` |
| `categoryId` | Required |
| `merchantId` | Optional |
| `amount` | The entered amount, at the line's `frequency` |
| `frequency` | `'monthly'` or `'yearly'` |
| `sourceRecurringId` | Set when the line was copied from a recurring item; purely informational (shows a "from X" note), never re-synced |

## Business rules

### Monthly/yearly views
`simulationTotals(lines, view)` in `lib/derive.ts` supports three views:
- `'monthly'` — only monthly-frequency lines, amount as-is.
- `'monthly-with-yearly'` — monthly lines as-is, plus yearly lines amortized (÷ 12).
- `'yearly'` — monthly lines × 12, plus yearly lines as-is.

The detail page exposes this as a Monthly/Yearly toggle, with an "Include yearly (amortized)" checkbox that switches between `'monthly'` and `'monthly-with-yearly'` while in Monthly mode.

### Copying from a recurring item
When adding a line, picking "From recurring" prefills `name`/`categoryId`/`merchantId`/`amount`/`frequency` from the chosen recurring item (cadence maps 1:1 to frequency). All fields stay editable after picking, and edits never write back to the source recurring item.

### Populating a new simulation from the include-items checklist
The New simulation sheet has an **Include** checklist (`populateSimulationFromInputs` in
`lib/actions/simulations.ts`). Nothing checked = start from scratch.

- **Recurring monthly/yearly expenses/income** — four independent checkboxes (shown only when
  the recurring module is enabled). Each copies matching recurring items that are not ended
  (`endDate IS NULL OR endDate >= today`) as snapshot lines with `sourceRecurringId` set.
- **Average non-recurring expenses / income** — two checkboxes. For each, the system takes all
  non-recurring transactions (`recurringId IS NULL`) of that kind in the chosen window,
  groups them by `(categoryId, merchantId)`, and creates one monthly line per group with
  `amount = sum / periodMonths` (fixed divisor — a merchant seen once in a 6-month window
  still divides by 6).
  - **Averaging period:** 1 / 6 / 12 complete calendar months, default 6. The current
    (incomplete) month is always excluded; "1 month" is the single previous complete month.
    See `completeMonthsWindow` in `lib/derive.ts`.
  - **Line handling:** `Include everything` (one line per group), `Drop below threshold`
    (skip groups whose monthly average is under the threshold), or `Roll up remainder`
    (keep above-threshold groups, collapse the rest into one `Other <category>` line per
    category so category totals stay exact). Threshold is in €/month, default 50.

### CALC vs. MANUAL chip
Every `average`/`rollup` line carries a chip in the line list: **CALC** when its amount
is still the value computed from history, **MANUAL** once the amount has been hand-edited.
The `simulation_lines.amount_manual` flag (0/1) tracks this — `updateSimulationLine` sets
it to 1 when an edit changes the amount of an averaged/grouped line, and
`applySimulationLineAverage` (the "View source details" recompute) resets it to 0.
`recurring` lines keep their own chip; `manual` lines carry none.

### Simulation vs. last 12 months
The detail page charts the simulation against reality, month by month over the trailing 12 months (current month last), via `simulationVsActualsMonthly(lines, transactions, recurring, viewMode)`. Each month has two stacked columns — actual (solid) and simulation (faded) — with `actualTotal / simTotal` shown as a percentage above the pair. Revenues are excluded.

The **actual** column sums expenses **cleared** in that month (`kind === 'expense' && cleared === 1`, dated in the month — there is no clear timestamp). The **simulation** column is a steady per-month figure derived from the lines.

Segments:
- **Recurring** — actual: transactions linked to a monthly-cadence recurring; sim: `origin === 'recurring'`, `frequency === 'monthly'` lines.
- **Variable** — actual: everything else (ad-hoc, plus yearly-cadence recurring transactions shown as their real lump); sim: non-recurring monthly lines plus every yearly line amortized `÷ 12`.
- **Yearly recurring** (yearly view only) — actual: transactions linked to a yearly-cadence recurring, in their real month; sim: each `origin === 'recurring'`, `frequency === 'yearly'` line placed in the month a same-category yearly-recurring transaction cleared (fallback: the source recurring's anchor month, else the current month), and no longer amortized into Variable.

### Delta vs. current recurring
The detail page shows how the simulation's net cashflow compares to the user's actual current recurring setup, via `currentRecurringMonthlyNet(recurring)` (reuses `monthlyEstimate`, so ended recurring items are excluded).

### Push to budget
When the `budgets` module is on, the Expenses card has a **Push to budget** button.
`createBudgetFromSimulation` **replaces the single app budget** with a line-for-line
copy of this simulation: every line that has a category becomes a `budget_lines`
row (name, kind, category, merchant, amount, frequency preserved); `recurring`-origin
lines are marked recurring, the rest ad-hoc. No rounding. The modal warns that any
existing budget is replaced.

### Duplicating
`duplicateSimulation` clones a simulation and all its lines with new ids (name suffixed " (copy)"). Line clones keep their `sourceRecurringId` as informational provenance.

### Deleting
Deleting a simulation cascade-deletes all its lines.
