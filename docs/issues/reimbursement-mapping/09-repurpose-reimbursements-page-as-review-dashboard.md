# 09 - Repurpose Reimbursements Page as Review Dashboard

## Type

AFK

## Blocked by

08 - Filter Reimbursement Work in Transactions

## User stories covered

26

## What to build

Turn the dedicated reimbursements page into a review dashboard for the new income-driven workflow. The page should help users see reimbursement income that still needs allocation and reimbursable expenses grouped by settlement status.

## Acceptance criteria

- [ ] The reimbursements page no longer centers the old expense-driven reimbursement creation flow.
- [ ] The page shows reimbursement income grouped or filtered by allocation state.
- [ ] The page shows reimbursable expenses grouped by reimbursement status.
- [ ] Unmapped and partially allocated reimbursement income are easy to identify.
- [ ] Not reimbursed and partially reimbursed expenses are easy to identify.
- [ ] Manually settled expenses are not mixed into the default unresolved group.
- [ ] Users can open the mapping sheet from relevant reimbursement income on the page.
- [ ] Users can manually settle or clear settlement where the page exposes expense actions.

## Implementation notes

- Preserve rate management if it currently belongs on the reimbursements page, unless the app already has a better settings location.
- Remove or de-emphasize claimed-date and due-date semantics from this page.
- Reuse transaction-list status labels and mapping actions where possible.
- Keep the dashboard review-focused; do not add manual allocation editing.

## Verification

- [ ] Run lint.
- [ ] Visit the reimbursements page with unmapped, partially allocated, and fully allocated income.
- [ ] Confirm expenses are grouped by settlement status.
- [ ] Open the mapping sheet from the page and save a change.
- [ ] Confirm manual settlement state is represented correctly.
- [ ] Confirm legacy claimed/due language is gone from the new review workflow.
