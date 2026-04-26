# 10 - Clear Mappings When Transactions Stop Being Eligible

## Type

AFK

## Blocked by

06 - Edit a Saved Mapping

07 - Manually Settle an Expense

## User stories covered

Implementation decisions from the PRD.

## What to build

Keep reimbursement mappings consistent when transactions are deleted or changed so they are no longer eligible for the reimbursement workflow. Deleting mapped reimbursement income or reimbursable expenses should delete their mappings. Turning off an expense's reimbursable flag or changing reimbursement income out of the reimbursement category should clear related reimbursement state with confirmation when mappings exist.

## Acceptance criteria

- [ ] Deleting reimbursement income deletes its mapping rows.
- [ ] Deleting a reimbursable expense deletes its mapping rows.
- [ ] Turning off an expense's reimbursable flag clears its reimbursement mappings.
- [ ] Turning off an expense's reimbursable flag clears manual settlement metadata.
- [ ] If an expense has mappings, the user sees confirmation before the reimbursable flag change clears them.
- [ ] Changing reimbursement income out of the reimbursement category clears its mappings.
- [ ] If reimbursement income has mappings, the user sees confirmation before the category change clears them.
- [ ] After cleanup, statuses and filters no longer count deleted or ineligible mappings.

## Implementation notes

- Prefer database-level cascade where it matches the schema and app behavior; otherwise keep cleanup in server actions.
- Confirmation should be attached to user-initiated eligibility changes, not low-level helper functions.
- Make cleanup behavior consistent between the transaction sheet and any inline edit flows.
- Do not remove deprecated legacy columns in this slice.

## Verification

- [ ] Run lint.
- [ ] Delete mapped reimbursement income and confirm related mapping rows are gone.
- [ ] Delete a mapped reimbursable expense and confirm related mapping rows are gone.
- [ ] Turn off reimbursable on a mapped expense, confirm the prompt, and verify mappings/manual settlement clear.
- [ ] Change mapped reimbursement income to another category, confirm the prompt, and verify mappings clear.
- [ ] Confirm reimbursement filters and dashboard groups update after cleanup.
