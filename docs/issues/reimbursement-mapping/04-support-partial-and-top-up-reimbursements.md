# 04 - Support Partial and Top-Up Reimbursements

## Type

AFK

## Blocked by

03 - Map One Reimbursement Income to Multiple Expenses

## User stories covered

7, 13, 14, 20, 21

## What to build

Allow one reimbursable expense to receive allocations from multiple reimbursement income transactions. This should support real partial reimbursements and later top-ups while keeping stored allocation amounts unchanged when reimbursement rates are corrected.

Expense settlement status should be derived from total allocated reimbursement versus the currently calculated expected reimbursement. Reimbursement income status should be derived from how much of that income has been allocated.

## Acceptance criteria

- [ ] A reimbursable expense can be mapped from more than one reimbursement income.
- [ ] The mapping sheet accounts for allocations already received from other reimbursement incomes.
- [ ] Editing or saving one reimbursement income does not alter allocations from other incomes.
- [ ] Expense statuses include not reimbursed, partially reimbursed, and reimbursed.
- [ ] Reimbursement income statuses include unmapped, partially allocated, and fully allocated.
- [ ] Expected reimbursement is recalculated from current reimbursement rates.
- [ ] Stored allocation rows are not rewritten automatically when rates change.
- [ ] Rate changes can update visible settlement status without changing stored allocation amounts.

## Implementation notes

- This slice should harden the reimbursement status module into the shared source of truth for UI and actions.
- Be explicit about amount comparisons, especially integer rounding and equality at the nearest-euro level.
- The mapping sheet should subtract allocations from other reimbursement incomes when computing remaining expected amount.
- Avoid compatibility shims for the old expense-driven creation flow beyond what migration safety requires.

## Verification

- [ ] Run lint.
- [ ] Map one expense from two reimbursement incomes and confirm the final expense status becomes reimbursed.
- [ ] Confirm the first income's allocation is not changed when saving the second income.
- [ ] Change a reimbursement rate and confirm expected/status updates while stored allocation amounts stay fixed.
- [ ] Confirm income rows show unmapped, partially allocated, and fully allocated states.
