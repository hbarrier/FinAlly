# 07 - Manually Settle an Expense

## Type

AFK

## Blocked by

04 - Support Partial and Top-Up Reimbursements

## User stories covered

23, 24, 25

## What to build

Add one-click manual settlement for reimbursable expenses whose actual reimbursement differs from the calculated expectation. A manually settled expense should show a manual settlement status, leave its stored allocations untouched, and be excluded from the default unsettled workflow. Users must also be able to clear manual settlement.

## Acceptance criteria

- [ ] A reimbursable expense can be manually settled from the expense workflow or reimbursement review UI.
- [ ] A manually settled expense shows the `manually settled` reimbursement status.
- [ ] Manual settlement does not create, delete, or alter reimbursement allocation amounts.
- [ ] Manually settled expenses are excluded from default unsettled reimbursement views.
- [ ] Manual settlement can be cleared.
- [ ] Clearing manual settlement returns the expense to its derived allocation-based status.
- [ ] Manual settlement metadata is stored on the expense transaction or an equivalent expense-owned record.

## Implementation notes

- The PRD calls for one-click settlement without notes or reasons; do not add note fields in this slice.
- Manual settlement should override visible expense status, not reimbursement income allocation status.
- Keep manual settlement independent from rate recalculation so rate changes do not erase the override.
- Include confirmation only if the surrounding UI pattern already expects it.

## Verification

- [ ] Run lint.
- [ ] Manually settle a partially reimbursed expense and confirm the visible status changes.
- [ ] Confirm allocation totals do not change after manual settlement.
- [ ] Confirm the expense disappears from default unsettled views.
- [ ] Clear manual settlement and confirm the derived partial/not reimbursed/reimbursed status returns.
