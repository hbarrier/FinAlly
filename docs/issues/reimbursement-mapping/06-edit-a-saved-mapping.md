# 06 - Edit a Saved Mapping

## Type

AFK

## Blocked by

04 - Support Partial and Top-Up Reimbursements

05 - Preserve Zero-Allocation Selections

## User stories covered

18, 19

## What to build

Let users reopen an existing reimbursement mapping, add or remove selected expenses, and save the updated mapping. Editing one reimbursement income should recalculate only that income's allocation rows while preserving allocations from other reimbursement incomes.

## Acceptance criteria

- [ ] Opening the mapping sheet for an already mapped reimbursement income preselects its saved expenses.
- [ ] Existing allocation amounts for that reimbursement income are visible in the sheet.
- [ ] The user can add newly eligible expenses and save.
- [ ] The user can remove previously selected expenses and save.
- [ ] Saving recalculates allocations for the edited reimbursement income using the same deterministic allocation rules.
- [ ] Allocations belonging to other reimbursement income transactions are preserved.
- [ ] Expense and income statuses refresh after editing.
- [ ] Zero-allocation selections still round-trip through edit/save.

## Implementation notes

- Treat the edited reimbursement income as the unit of replacement: remove or update only rows owned by that income.
- Keep "already allocated" values from other incomes visible so users understand remaining expected amount.
- Make the server action authoritative; the client preview should not be the only place allocation rules run.
- Watch for cross-year mappings. They are allowed when expense date is on or before income date.

## Verification

- [ ] Run lint.
- [ ] Map an income to multiple expenses, reopen it, remove one expense, and confirm statuses update.
- [ ] Add a new expense to an existing mapping and confirm allocations recalculate oldest-first.
- [ ] Create a top-up from another income, edit the first income, and confirm the top-up allocation remains unchanged.
- [ ] Confirm zero-allocation rows remain editable.
