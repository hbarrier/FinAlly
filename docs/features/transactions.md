# Transactions

**Route:** `/transactions`

## Overview

The transactions page is the full ledger (“movements”). Every income and expense entry is listed here. Users can:

- add and edit transactions
- filter by multiple dimensions (including reimbursement status)
- mark entries as cleared (reconciled)
- link transactions to recurring items
- see “scheduled” recurring occurrences that have not been logged yet (virtual rows)
- map reimbursement income to reimbursable expenses (income-driven reimbursement workflow)

## Reference files

| File | Role |
|---|---|
| [app/(app)/transactions/page.tsx](../../app/(app)/transactions/page.tsx) | Server Component; fetches all transactions, merchants, categories, and recurring items |
| [app/(app)/transactions/transactions-client.tsx](../../app/(app)/transactions/transactions-client.tsx) | Client Component; filtering logic, bulk selection, link/import triggers |
| [app/(app)/transactions/import-wizard.tsx](../../app/(app)/transactions/import-wizard.tsx) | CSV import multi-step wizard (see also: [Import feature](import.md)) |
| [lib/actions/transactions.ts](../../lib/actions/transactions.ts) | `addTransaction`, `updateTransaction`, `deleteTransaction`, `clearTransaction`, `linkTransactionToRecurring`, `detachTransactionFromRecurring`, `bulkLinkTransactionsToRecurring` |
| [lib/actions/reimbursements.ts](../../lib/actions/reimbursements.ts) | `mapReimbursementIncomeToExpenses`, `setExpenseManualSettlement` |
| [components/fern/sheets/transaction-sheet.tsx](../../components/fern/sheets/transaction-sheet.tsx) | Add / edit transaction form |
| [components/fern/sheets/recurring-link-sheet.tsx](../../components/fern/sheets/recurring-link-sheet.tsx) | Link a single transaction to a recurring item |
| [components/fern/sheets/bulk-recurring-link-sheet.tsx](../../components/fern/sheets/bulk-recurring-link-sheet.tsx) | Link multiple selected transactions to a recurring item |
| [components/fern/sheets/reimbursement-mapping-sheet.tsx](../../components/fern/sheets/reimbursement-mapping-sheet.tsx) | Map a reimbursement income to reimbursable expenses |

## Business rules

### Transaction fields
| Field | Required | Notes |
|---|---|---|
| `date` | Yes | ISO date string; displayed in French format |
| `amount` | Yes | Positive real number |
| `kind` | Yes | `'expense'` or `'income'` |
| `categoryId` | No | Can be null (uncategorized) |
| `merchantId` | No | Can be null |
| `note` | No | Free text |
| `reimbursable` | No | `0/1` flag; reimbursable expenses participate in reimbursement mapping (see [Reimbursements](reimbursements.md)) |
| `recurringId` | No | FK to a recurring item |
| `cleared` | No | `0/1`; toggled via `clearTransaction` |
| `manualSettlementAt` | No | ISO datetime; when set on a reimbursable expense it is considered “manually settled” |

### Filtering
Filters are client-side (applied to the full list passed from the server). Available filters:
- **Year** — calendar year selector
- **Kind** — expense, income, or all
- **Category** — single category
- **Merchant** — single merchant
- **Cleared status** — cleared, uncleared, or all
- **Reimbursement status** — “unresolved reimbursement work” and per-status filters for eligible expenses/incomes

Filters compose: all active filters are applied together (AND logic).

### Clearing (reconciliation)
- `cleared` is toggled per transaction via `clearTransaction(id, cleared)`.
- Imported transactions are always created with `cleared: true`.
- Cleared status has no effect on any computed totals.

### Linking to recurring
- A transaction can be linked to a recurring item via `recurringId`.
- Linking is done from the transaction row (single) or via bulk selection.
- A transaction can only be linked to one recurring item at a time.
- Detaching sets `recurringId` to `null`.

### Scheduled (virtual) recurring entries
The list can display virtual “scheduled” rows for recurring occurrences that have not been logged yet in the selected year.

- These rows are derived client-side from recurring occurrences in the visible date range.
- A real transaction linked to a recurring item is considered to “cover” an occurrence by **period** (year/month/week) rather than exact date.
- Clicking a scheduled row opens the transaction sheet prefilled; there is also a one-click “log and mark as cleared” affordance.

### Bulk selection
- User can select multiple transactions with checkboxes.
- Bulk actions: set all selected as recurring (via the bulk recurring sheet).

### Reimbursement mapping entrypoints
- **Reimbursement income mapping**: income transactions in the `Remboursements` (income) category expose a “Map reimbursement” action that opens a mapping sheet.
- **Manual settlement**: reimbursable expenses expose a toggle to set/clear `manualSettlementAt`.

### Deleting
- Deleting a transaction is permanent.
- If the transaction participates in reimbursement mappings (as income or expense), the corresponding `reimbursement_allocations` rows are deleted.
