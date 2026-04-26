# 08 - Filter Reimbursement Work in Transactions

## Type

AFK

## Blocked by

04 - Support Partial and Top-Up Reimbursements

07 - Manually Settle an Expense

## User stories covered

20, 21, 22, 24

## What to build

Make reimbursement work visible and filterable in the transactions list. Users should be able to find reimbursable expenses by settlement state and reimbursement income by allocation state without leaving the main movement workflow.

## Acceptance criteria

- [ ] Reimbursable expense rows show one of: not reimbursed, partially reimbursed, reimbursed, manually settled.
- [ ] Reimbursement income rows show one of: unmapped, partially allocated, fully allocated.
- [ ] The transactions list can filter to unresolved reimbursement work.
- [ ] The transactions list can filter by expense reimbursement status.
- [ ] The transactions list can filter by reimbursement income allocation status.
- [ ] Manually settled expenses are excluded from the default unresolved filter.
- [ ] Filters work across the currently supported transaction date/year scope.

## Implementation notes

- The PRD uses "movements list"; use the current transactions list unless the app introduces a separate movement route.
- Reuse the shared status derivation module rather than duplicating status rules in the client.
- Keep labels reimbursement-specific and avoid reusing legacy claimed/due wording.
- Do not change dashboard income totals; reimbursement income remains normal income.

## Verification

- [ ] Run lint.
- [ ] Confirm statuses render on reimbursable expense rows.
- [ ] Confirm statuses render on reimbursement income rows.
- [ ] Filter to unresolved reimbursement work and confirm only relevant rows appear.
- [ ] Confirm manually settled expenses do not appear in the default unresolved filter.
- [ ] Confirm unrelated transactions are not affected by reimbursement filters.
