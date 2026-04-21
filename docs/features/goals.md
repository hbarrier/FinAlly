# Goals

**Route:** `/goals`

## Overview

Goals track savings targets — a holiday fund, an emergency buffer, a new piece of gear. Each goal has a name, a target amount, an amount already saved, and an optional deadline. Progress is shown as a circular ring.

Goals are independent of the transaction ledger. The `saved` amount is updated manually, not derived from tagged transactions.

## Reference files

| File | Role |
|---|---|
| [app/(app)/goals/page.tsx](../../app/(app)/goals/page.tsx) | Server Component; fetches all goals |
| [app/(app)/goals/goals-client.tsx](../../app/(app)/goals/goals-client.tsx) | Client Component; grid layout, contribute action, add/edit/delete |
| [lib/actions/goals.ts](../../lib/actions/goals.ts) | `addGoal`, `updateGoal`, `deleteGoal` |
| [components/fern/sheets/goal-sheet.tsx](../../components/fern/sheets/goal-sheet.tsx) | Add / edit goal form |

## Goal fields

| Field | Notes |
|---|---|
| `name` | Display label |
| `target` | Total amount to reach |
| `saved` | Amount saved so far (manually maintained) |
| `icon` | Lucide icon name; default `'cat-seed'` |
| `color` | Colour token; default `'sage'` |
| `deadline` | Optional ISO date; displayed but not enforced |

## Business rules

### Progress calculation
`progress = saved / target`, clamped to 100%. Displayed as a filled arc on the `GoalRing` component.

### Contributing
The "contribute" action opens an inline input where the user enters an amount. That amount is added to `saved` via `updateGoal`. There is no validation that the contribution comes from a specific transaction.

### Deadline
The deadline is informational only. There is no automatic status change when a deadline passes.

### Completing a goal
When `saved >= target`, the ring shows full and the card can be styled as complete. Completed goals remain visible until explicitly deleted.

### Deleting
Deletes the goal record. No linked data elsewhere.
