# Reimbursements

**Route:** `/reimbursements`

## Overview

Some expenses are partially or fully paid back — healthcare, work costs, childcare. The reimbursement feature lets you flag those expenses, record when the money comes back, and track the rate at which you expect to be reimbursed.

There is also a dedicated section for **pension alimentaire** (French childcare support), which is modelled as income transactions in a specially-flagged category.

## Reference files

| File | Role |
|---|---|
| [app/(app)/reimbursements/page.tsx](../../app/(app)/reimbursements/page.tsx) | Server Component; fetches reimbursable expenses, rates, and pension alimentaire income |
| [app/(app)/reimbursements/reimbursements-client.tsx](../../app/(app)/reimbursements/reimbursements-client.tsx) | Client Component; expense list, rate management UI, pension alimentaire list |
| [lib/actions/reimbursements.ts](../../lib/actions/reimbursements.ts) | `addReimbursementRate`, `updateReimbursementRate`, `deleteReimbursementRate`, `getApplicableRate`, `recordReimbursement`, `deleteReimbursement` |
| [components/fern/sheets/reimbursement-sheet.tsx](../../components/fern/sheets/reimbursement-sheet.tsx) | Form to record a reimbursement on an expense |
| [lib/schema.ts](../../lib/schema.ts) | `reimbursementRates` table, `transactions.reimbursable`, `transactions.reimbursementTxId`, `transactions.claimedDate`, `categories.isPensionAlimentaire` |

## Data model

### Marking an expense as reimbursable
Set `reimbursable = 1` on a transaction. This can be done when creating or editing the transaction. The expense appears in the reimbursements list.

### Recording a reimbursement
`recordReimbursement(expenseId, date, amount, claimedDate)`:
1. Creates a new **income** transaction for the reimbursement amount.
2. Sets `transactions.reimbursementTxId` on the expense to the new income transaction's ID.
3. Sets `transactions.claimedDate` on the expense to the date the reimbursement was received.

### Deleting a reimbursement
`deleteReimbursement(expenseId)`:
1. Deletes the linked income transaction.
2. Clears `reimbursementTxId` and `claimedDate` on the expense (the expense remains; it goes back to "pending reimbursement" state).

## Reimbursement rates

Rates are stored in the `reimbursementRates` table as time-versioned percentages.

| Field | Notes |
|---|---|
| `percent` | Real number, e.g. `75` means 75% |
| `startDate` | ISO date; the rate applies from this date onward |

`getApplicableRate(expenseDate)` returns the `percent` from the rate record whose `startDate` is closest to and not after the expense date. Returns `null` if no rate is defined.

The UI uses the applicable rate to suggest a reimbursement amount when the user opens the reimbursement sheet: `suggested = expense.amount × (rate / 100)`.

### Adding and editing rates
Rates can be added, edited, and deleted from the rate management section of the page. Deleting a rate does not affect already-recorded reimbursements.

## Pension alimentaire

Transactions in a category flagged with `isPensionAlimentaire = 1` are displayed in a dedicated section on the reimbursements page. These are standard income transactions; the flag on the category is what surfaces them here.

Only one category should have `isPensionAlimentaire = 1` at a time (not enforced by a DB constraint, but assumed by the UI).

## Business rules

- An expense can have at most one reimbursement income transaction linked to it (enforced by the `reimbursementTxId` FK).
- The income transaction created by `recordReimbursement` is a full transaction in the ledger and appears on the Transactions page. Deleting it from the Transactions page directly will orphan the `reimbursementTxId` reference on the expense — use `deleteReimbursement` instead.
- `claimedDate` records when the reimbursement was actually received, which may differ from the income transaction date.
- The reimbursement amount does not have to match the suggested rate — the user can enter any amount.
