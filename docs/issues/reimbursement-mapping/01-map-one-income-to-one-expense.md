# 01 - Map One Reimbursement Income to One Expense

## Type

AFK

## Blocked by

None - can start immediately.

## User stories covered

1, 2, 3, 4, 5, 11, 12

## What to build

Ship the smallest usable income-driven reimbursement mapping path. A recorded reimbursement income in the `Remboursements` category should expose a mapping action from the transactions list, open a sheet, list eligible reimbursable expenses dated on or before the income date, and save a mapping to one selected expense.

This slice should introduce the new allocation model only to the extent required for one income and one expense. The mapped expense should derive its expected reimbursement from the reimbursement rate applicable on the expense date, rounded to the nearest euro, and both the income and expense should show a reconciled state after saving.

## Acceptance criteria

- [ ] Reimbursement-category income rows expose a mapping action in the transactions list.
- [ ] Non-reimbursement income rows do not expose the mapping action.
- [ ] The mapping action opens a sheet without navigating away.
- [ ] The sheet lists reimbursable expense transactions dated on or before the reimbursement income date.
- [ ] Future expenses are excluded from the eligible list.
- [ ] Saving one selected expense creates a durable allocation/mapping row linked to the reimbursement income and expense.
- [ ] Expected reimbursement is calculated from the rate active on the expense date.
- [ ] Expected reimbursement is rounded to the nearest euro per expense.
- [ ] The mapped income and expense show a completed/reconciled visible state after save.
- [ ] The old expense-driven reimbursement creation flow is not used for this new path.

## Implementation notes

- Add the many-to-many allocation table/model in the narrowest form needed for this path.
- Keep legacy `transactions.reimbursement_tx_id` and `transactions.claimed_date` fields in place for now.
- Prefer a dedicated reimbursement allocation/status module so later slices can reuse expected amount and status derivation.
- The PRD calls the list "movements"; in this app that currently maps to the transactions list.
- Before changing Next.js route files or conventions, read the relevant local Next.js docs under `node_modules/next/dist/docs/`.

## Verification

- [ ] Run lint.
- [ ] Manually create or identify a reimbursement income and reimbursable expense before that income date.
- [ ] Map the income to the expense from the transactions list.
- [ ] Confirm unrelated income rows have no mapping action.
- [ ] Confirm a future reimbursable expense is not selectable.
