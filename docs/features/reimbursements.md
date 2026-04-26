# Reimbursements

**Route:** `/reimbursements`

## Overview

Some expenses are partially or fully paid back — healthcare, work costs, childcare. Fern tracks reimbursement work using an **income-driven mapping** model:

- You record reimbursement **income** as a normal transaction in the `Remboursements` **income** category.
- You flag eligible **expense** transactions as `reimbursable`.
- You **map** each reimbursement income to one or more reimbursable expenses and the app auto-allocates amounts oldest-first.
- Reimbursable expenses have a derived settlement status (not reimbursed / partial / reimbursed) with an optional **manual settlement** override.

This page is a review dashboard to allocate reimbursement income and to close out reimbursable expenses.

## Reference files

| File | Role |
|---|---|
| [app/(app)/reimbursements/page.tsx](../../app/(app)/reimbursements/page.tsx) | Server Component; loads rates, reimbursable expenses, reimbursement incomes, and allocation rows |
| [app/(app)/reimbursements/reimbursements-client.tsx](../../app/(app)/reimbursements/reimbursements-client.tsx) | Client Component; review UI, mapping sheet launch, manual settlement, rate management |
| [components/fern/sheets/reimbursement-mapping-sheet.tsx](../../components/fern/sheets/reimbursement-mapping-sheet.tsx) | Mapping UI: select eligible expenses and preview allocations before saving |
| [lib/actions/reimbursements.ts](../../lib/actions/reimbursements.ts) | `mapReimbursementIncomeToExpenses`, `setExpenseManualSettlement`, rate CRUD; legacy `recordReimbursement` helpers |
| [lib/reimbursement-mapping.ts](../../lib/reimbursement-mapping.ts) | Allocation + status logic (`calculateReimbursementAllocations`, summaries, labels) |
| [lib/schema.ts](../../lib/schema.ts) | `reimbursementRates`, `reimbursementAllocations`, `transactions.reimbursable`, `transactions.manualSettlementAt` |

## Data model

### Reimbursable expenses
Set `transactions.reimbursable = 1` on an **expense** transaction. These are the eligible targets for reimbursement allocation and show up in the review dashboard.

### Reimbursement income
Reimbursement income is a normal **income** transaction, but only rows in the category named **`Remboursements`** (kind `income`) are treated as reimbursement incomes for mapping.

### Allocation rows (mapping)
Mappings are stored in `reimbursement_allocations`:

| Field | Meaning |
|---|---|
| `reimbursementTxId` | The reimbursement **income** transaction id |
| `expenseTxId` | The reimbursable **expense** transaction id |
| `amount` | The amount of this income allocated to this expense |

The pair `(reimbursementTxId, expenseTxId)` is unique.

Saving a mapping replaces all allocation rows for that income (it deletes and reinserts).

### Manual settlement
`transactions.manualSettlementAt` can be set on reimbursable expenses. When set, the expense status becomes **manually settled** regardless of expected/allocated amounts (it can still remain mapped for audit/history).

## Reimbursement rates

Rates are stored in the `reimbursementRates` table as time-versioned percentages.

| Field | Notes |
|---|---|
| `percent` | Real number, e.g. `75` means 75% |
| `startDate` | ISO date; the rate applies from this date onward |

`getApplicableReimbursementRate(rates, expenseDate)` returns the rate whose `startDate` is closest to and not after the expense date. If no rate applies, the expense is in the **no rate** state and cannot be allocated.

Expected reimbursement is derived from the current applicable rate for the expense date and rounded to the nearest euro:

`expected = round(expense.amount × rate.percent / 100)`

### Adding and editing rates
Rates can be added, edited, and deleted from the rate management section of the page. Deleting a rate does not affect already-recorded reimbursements.

## Business rules

- A reimbursement income can map to **multiple** expenses; an expense can receive allocations from **multiple** incomes.
- A reimbursement income can only be mapped if it is an income in the `Remboursements` income category.
- Selected expenses must be reimbursable expenses and must be dated **on or before** the reimbursement income date.
- Allocation is **oldest-first** and never exceeds each expense’s remaining expected amount (after allocations from other incomes).
- Zero-allocation rows are still stored so the user’s selection is preserved (“Selected · no allocation”).

## Legacy fields

The schema still includes `transactions.reimbursementTxId` and `transactions.claimedDate`, and `lib/actions/reimbursements.ts` still contains `recordReimbursement`/`deleteReimbursement`. These are legacy helpers from the previous expense-driven flow and are not the primary workflow anymore.
