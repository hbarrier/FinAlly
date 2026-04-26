# 03 - Map One Reimbursement Income to Multiple Expenses

## Type

AFK

## Blocked by

01 - Map One Reimbursement Income to One Expense

## User stories covered

6, 8, 9, 10, 15

## What to build

Extend the mapping sheet so a single reimbursement income can be allocated across multiple selected reimbursable expenses. The user should be able to select several eligible expenses, preview the calculated allocation, and save the mapping in one action.

Allocation should be automatic and deterministic: selected expenses are allocated oldest-first up to each expense's remaining expected reimbursement. Any reimbursement income left after selected expenses are satisfied remains unallocated.

## Acceptance criteria

- [ ] The mapping sheet supports selecting multiple eligible expenses for one reimbursement income.
- [ ] The sheet shows expense date, merchant/category, amount, applicable rate, expected reimbursement, already allocated amount, and remaining expected amount.
- [ ] Saving selected expenses allocates the reimbursement income oldest-first by expense date.
- [ ] No expense is allocated beyond its expected reimbursement.
- [ ] Excess reimbursement income remains unallocated.
- [ ] The income row shows partially allocated or fully allocated based on saved allocations.
- [ ] Each selected expense shows an updated reimbursement status after save.
- [ ] Allocation behavior is deterministic when expenses have the same date.

## Implementation notes

- Reuse the expected reimbursement and status functions introduced in the first slice.
- Keep allocation amounts stored in the same amount representation as transactions.
- Define tie-breaking explicitly, for example by date then stable transaction id, so allocation does not reorder unpredictably.
- Do not add manual allocation amount editing; it is out of scope.

## Verification

- [ ] Run lint.
- [ ] Map one income to two older expenses and confirm allocations are oldest-first.
- [ ] Confirm a shortfall partially allocates the newest selected expense.
- [ ] Confirm excess income remains on the reimbursement income as unallocated.
- [ ] Confirm expected amounts in the sheet match the applicable rates for expense dates.
