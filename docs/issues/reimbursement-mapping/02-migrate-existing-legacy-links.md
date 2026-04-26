# 02 - Migrate Existing Legacy Reimbursement Links

## Type

AFK

## Blocked by

01 - Map One Reimbursement Income to One Expense

## User stories covered

27

## What to build

Move existing expense-driven reimbursement links into the new allocation model so old data appears correctly in the new reimbursement workflow. Existing expenses linked through `reimbursement_tx_id` should become allocation rows between the legacy reimbursement income and the reimbursable expense.

After migration, new code should read reimbursement settlement from the allocation model, while the deprecated legacy fields remain present for migration safety.

## Acceptance criteria

- [ ] A migration creates allocation rows for existing `reimbursement_tx_id` links.
- [ ] Migrated allocation amounts match the linked reimbursement income amount where possible.
- [ ] Migrated expenses show the same or more accurate reimbursement state in the new status UI.
- [ ] Migrated reimbursement income rows show allocated status in the new income status UI.
- [ ] The migration is idempotent or protected against duplicate allocation rows.
- [ ] New reimbursement mapping code does not write new `reimbursement_tx_id` links.
- [ ] Claimed-date semantics are not carried forward into the new mapping workflow.
- [ ] Legacy fields remain available and are not removed in this slice.

## Implementation notes

- Existing model: one expense points to one reimbursement income via `transactions.reimbursement_tx_id`.
- Existing UI uses `claimed_date` as a declaration/due-date signal; the PRD explicitly removes that concept from the new mapping flow.
- Keep the migration focused on preserving existing links, not redesigning historical data.
- If an existing legacy row is malformed, prefer a conservative no-op with clear documentation over guessing.

## Verification

- [ ] Run lint.
- [ ] Run the migration against a copy of current local data.
- [ ] Confirm linked legacy reimbursements produce exactly one allocation per legacy link.
- [ ] Confirm rerunning the migration does not duplicate allocations.
- [ ] Confirm migrated rows appear reconciled in the new transactions UI.
