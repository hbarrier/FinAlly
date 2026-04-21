# Transactions

**Route:** `/transactions`

## Overview

The transactions page is the full ledger. Every income and expense entry is listed here. Users can add transactions manually, filter by multiple dimensions, mark entries as cleared (reconciled against a bank statement), and link transactions to recurring items.

## Reference files

| File | Role |
|---|---|
| [app/(app)/transactions/page.tsx](../../app/(app)/transactions/page.tsx) | Server Component; fetches all transactions, merchants, categories, and recurring items |
| [app/(app)/transactions/transactions-client.tsx](../../app/(app)/transactions/transactions-client.tsx) | Client Component; filtering logic, bulk selection, link/import triggers |
| [app/(app)/transactions/import-wizard.tsx](../../app/(app)/transactions/import-wizard.tsx) | CSV import multi-step wizard (see also: [Import feature](import.md)) |
| [lib/actions/transactions.ts](../../lib/actions/transactions.ts) | `addTransaction`, `updateTransaction`, `deleteTransaction`, `clearTransaction`, `linkTransactionToRecurring`, `detachTransactionFromRecurring`, `bulkLinkTransactionsToRecurring` |
| [components/fern/sheets/transaction-sheet.tsx](../../components/fern/sheets/transaction-sheet.tsx) | Add / edit transaction form |
| [components/fern/sheets/recurring-link-sheet.tsx](../../components/fern/sheets/recurring-link-sheet.tsx) | Link a single transaction to a recurring item |
| [components/fern/sheets/bulk-recurring-link-sheet.tsx](../../components/fern/sheets/bulk-recurring-link-sheet.tsx) | Link multiple selected transactions to a recurring item |

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
| `reimbursable` | No | Boolean flag; see [Reimbursements](reimbursements.md) |
| `recurringId` | No | FK to a recurring item |
| `cleared` | No | Default `false`; toggled via `clearTransaction` |

### Filtering
Filters are client-side (applied to the full list passed from the server). Available filters:
- **Year** — calendar year selector
- **Kind** — expense, income, or all
- **Category** — single category
- **Merchant** — single merchant
- **Cleared status** — cleared, uncleared, or all

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

### Bulk selection
- User can select multiple transactions with checkboxes.
- Bulk actions: link all selected to a recurring item.

### Deleting
- Deleting a transaction is permanent.
- If the transaction was a reimbursement income entry (linked to an expense via `reimbursementTxId`), that link is also severed.
