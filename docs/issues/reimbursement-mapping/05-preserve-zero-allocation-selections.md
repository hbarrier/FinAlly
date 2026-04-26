# 05 - Preserve Zero-Allocation Selections

## Type

AFK

## Blocked by

03 - Map One Reimbursement Income to Multiple Expenses

## User stories covered

16, 17

## What to build

Preserve the user's selected expense mappings even when a selected expense receives a zero allocation from the reimbursement income. This keeps the mapping selection durable for auditability while ensuring zero-allocation rows do not affect financial status.

## Acceptance criteria

- [ ] A selected expense can be saved with an allocated amount of zero.
- [ ] Zero-allocation rows remain attached to the reimbursement income and are visible when reopening the mapping.
- [ ] Zero-allocation rows do not increase the expense's allocated reimbursement total.
- [ ] Zero-allocation rows do not make a reimbursement income appear more financially allocated than it is.
- [ ] Removing a zero-allocation selection removes only that mapping row.
- [ ] The UI distinguishes selected-but-zero from financially allocated clearly enough for review.

## Implementation notes

- Store allocation rows even when the allocated amount is zero, as required by the PRD.
- Status derivation should sum amounts, not count rows.
- The mapping sheet can use row presence for selection state and allocation amount for financial state.
- Keep this behavior limited to selected expenses; do not create zero rows for unselected eligible expenses.

## Verification

- [ ] Run lint.
- [ ] Select more expenses than a reimbursement income can cover.
- [ ] Confirm later selected expenses can be saved with zero allocation.
- [ ] Reopen the mapping and confirm zero-allocation selections are still selected.
- [ ] Confirm statuses and totals ignore zero-allocation rows financially.
