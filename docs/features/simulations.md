# Simulations

**Route:** `/simulations`, `/simulations/[id]`

## Overview

Simulations model "what if" scenarios for future income and expenses — a raise, a new bill, a job change — without touching real transactions or recurring templates. A simulation is a named, optionally described container for independent revenue/expense lines, each with a category, optional merchant, an amount, and a monthly or yearly frequency.

A line can be created from scratch or copied from an existing recurring item. The copy is a one-time snapshot: editing the line afterward does not affect the original recurring item, and vice versa.

## Reference files

| File | Role |
|---|---|
| [app/(app)/simulations/page.tsx](../../app/(app)/simulations/page.tsx) | Server Component; lists all simulations with their lines |
| [app/(app)/simulations/simulations-client.tsx](../../app/(app)/simulations/simulations-client.tsx) | Client Component; simulation cards with monthly/yearly synthesis, create/duplicate/delete |
| [app/(app)/simulations/[id]/page.tsx](../../app/(app)/simulations/[id]/page.tsx) | Server Component; fetches one simulation plus categories, merchants, recurring items, and balance inputs |
| [app/(app)/simulations/[id]/simulation-detail-client.tsx](../../app/(app)/simulations/[id]/simulation-detail-client.tsx) | Client Component; view toggle, totals, balance projection, category breakdown, line list |
| [lib/actions/simulations.ts](../../lib/actions/simulations.ts) | All simulation and line mutations |
| [lib/derive.ts](../../lib/derive.ts) | `simulationTotals`, `simulationLinesByCategory`, `currentRecurringMonthlyNet`, `simulationBalanceProjection` |
| [components/fern/sheets/simulation-sheet.tsx](../../components/fern/sheets/simulation-sheet.tsx) | Add / edit simulation name & description; create-time source toggle |
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
| `frequency` | `'monthly'` or `'yearly'` — no weekly, unlike recurring |
| `sourceRecurringId` | Set when the line was copied from a recurring item; purely informational (shows a "from X" note), never re-synced |

## Business rules

### Monthly/yearly views
`simulationTotals(lines, view)` in `lib/derive.ts` supports three views:
- `'monthly'` — only monthly-frequency lines, amount as-is.
- `'monthly-with-yearly'` — monthly lines as-is, plus yearly lines amortized (÷ 12).
- `'yearly'` — monthly lines × 12, plus yearly lines as-is.

The detail page exposes this as a Monthly/Yearly toggle, with an "Include yearly (amortized)" checkbox that switches between `'monthly'` and `'monthly-with-yearly'` while in Monthly mode.

### Copying from a recurring item
When adding a line, picking "From recurring" prefills `name`/`categoryId`/`merchantId`/`amount`/`frequency` from the chosen recurring item (cadence maps 1:1 to frequency). Weekly-cadence recurring items are excluded from the picker — simulations don't model a weekly frequency, and converting weekly to monthly would be a lossy approximation. All fields stay editable after picking, and edits never write back to the source recurring item.

### Starting a simulation from current recurring
At creation time, choosing "Start from current recurring" bulk-copies every recurring item that is non-weekly and not ended (`endDate IS NULL OR endDate >= today`) into the new simulation as independent lines.

### Projected balance
The detail page charts a linear 12-month balance projection: starting from today's actual balance (`currentBalance(startingBalance, transactions)`), each subsequent month adds the simulation's net monthly cashflow (always amortized — `'monthly-with-yearly'` — regardless of the active view toggle). This is deliberately linear, not a lump-sum-by-month timing model, since simulation lines carry no scheduling information.

### Delta vs. current recurring
The detail page shows how the simulation's net cashflow compares to the user's actual current recurring setup, via `currentRecurringMonthlyNet(recurring)` (reuses `monthlyEstimate`, so ended recurring items are excluded).

### Duplicating
`duplicateSimulation` clones a simulation and all its lines with new ids (name suffixed " (copy)"). Line clones keep their `sourceRecurringId` as informational provenance.

### Deleting
Deleting a simulation cascade-deletes all its lines.
