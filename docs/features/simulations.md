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
| [app/(app)/simulations/[id]/page.tsx](../../app/(app)/simulations/[id]/page.tsx) | Server Component; fetches one simulation plus categories, merchants, recurring items, and balance inputs |
| [app/(app)/simulations/[id]/simulation-detail-client.tsx](../../app/(app)/simulations/[id]/simulation-detail-client.tsx) | Client Component; view toggle, totals, balance projection, category breakdown, line list |
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

### Projected balance
The detail page charts a linear 12-month balance projection: starting from today's actual balance (`currentBalance(startingBalance, transactions)`), each subsequent month adds the simulation's net monthly cashflow (always amortized — `'monthly-with-yearly'` — regardless of the active view toggle). This is deliberately linear, not a lump-sum-by-month timing model, since simulation lines carry no scheduling information.

### Delta vs. current recurring
The detail page shows how the simulation's net cashflow compares to the user's actual current recurring setup, via `currentRecurringMonthlyNet(recurring)` (reuses `monthlyEstimate`, so ended recurring items are excluded).

### Duplicating
`duplicateSimulation` clones a simulation and all its lines with new ids (name suffixed " (copy)"). Line clones keep their `sourceRecurringId` as informational provenance.

### Deleting
Deleting a simulation cascade-deletes all its lines.
