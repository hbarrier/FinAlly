# PRD: Reimbursement Mapping and Settlement Tracking

## Status

This PRD has been largely implemented. The current code uses:

- `reimbursement_allocations` (many-to-many allocations between reimbursement income and reimbursable expenses)
- `transactions.manualSettlementAt` for manual settlement overrides
- Mapping UI via `components/fern/sheets/reimbursement-mapping-sheet.tsx`
- Business logic in `lib/reimbursement-mapping.ts`

Legacy one-to-one fields (`transactions.reimbursementTxId`, `transactions.claimedDate`) and helpers still exist for migration safety / backwards compatibility, but new workflow is income-driven.

## Problem Statement

Today, reimbursements are tracked from the expense side: a reimbursable expense can create or link to a single reimbursement income. This does not match the real workflow, where reimbursement income is often recorded after the fact and may correspond to one or more reimbursable expenses.

Users need a clear way to map recorded reimbursement income to reimbursable expenses, automatically calculate the expected reimbursement amount based on the rate applicable on each expense date, and easily see whether each reimbursable expense is not reimbursed, partially reimbursed, fully reimbursed, or manually settled.

## Solution

Add a reimbursement mapping workflow from recorded reimbursement income transactions. Income transactions in the reimbursement category will expose an action icon that opens a mapping sheet. The user can select eligible reimbursable expenses dated on or before the reimbursement income date. The app auto-allocates the income across selected expenses in oldest-first order, using each expense's current applicable reimbursement rate and nearest-euro expected amount.

A reimbursement can map to multiple expenses, and an expense can receive allocations from multiple reimbursements. Expense settlement status is derived from total allocated reimbursement versus the currently calculated expected reimbursement, with a one-click manual settlement override when the actual reimbursement differs from expectation.

The movements list and reimbursement review dashboard will make reimbursement status visible and filterable.

## User Stories

1. As a user, I want to map a recorded reimbursement income to one or more expenses, so that reimbursements reflect my real bank movements.
2. As a user, I want only reimbursement-category income rows to show the mapping action, so that unrelated income is not cluttered with reimbursement tools.
3. As a user, I want to open a mapping sheet from the movement row, so that I can reconcile reimbursements without navigating away.
4. As a user, I want the mapping sheet to show reimbursable expenses, so that I can choose the expenses covered by the reimbursement.
5. As a user, I want future expenses excluded from mapping, so that a reimbursement cannot be linked to an expense that happened after it.
6. As a user, I want the tool to support one reimbursement covering multiple expenses, so that grouped reimbursements are tracked accurately.
7. As a user, I want one expense to receive multiple reimbursement allocations, so that partial reimbursements and later top-ups are supported.
8. As a user, I want allocations to be automatic, so that I do not need to manually split reimbursement amounts.
9. As a user, I want allocation to happen oldest-first, so that shortfalls are distributed predictably.
10. As a user, I want excess reimbursement income to remain unallocated, so that expenses are not over-settled.
11. As a user, I want expected reimbursement calculated from the rate applicable on the expense date, so that reimbursement rules are applied correctly.
12. As a user, I want expected reimbursement rounded to the nearest euro per expense, so that settlement status matches the intended reimbursement rule.
13. As a user, I want current reimbursement rates to drive expected amounts, so that rate corrections update settlement status.
14. As a user, I want stored allocations to remain unchanged when rates change, so that historical mappings are not silently rewritten.
15. As a user, I want the mapping sheet to show expense date, merchant/category, amount, rate, expected reimbursement, already allocated, and remaining expected amount, so that I can audit the mapping before saving.
16. As a user, I want selected expenses with zero allocation to remain attached to the reimbursement, so that my mapping selection is preserved.
17. As a user, I want zero-allocation mappings not to count financially, so that reimbursement allocation status remains accurate.
18. As a user, I want to edit an existing reimbursement mapping, so that I can add or remove selected expenses later.
19. As a user, I want editing one reimbursement to preserve allocations from other reimbursements, so that unrelated mappings are not disturbed.
20. As a user, I want reimbursable expenses to show not reimbursed, partially reimbursed, reimbursed, or manually settled, so that I can understand their state at a glance.
21. As a user, I want reimbursement income rows to show unmapped, partially allocated, or fully allocated, so that I can find income that still needs reconciliation.
22. As a user, I want movement-list filters for reimbursement status, so that I can quickly find unresolved reimbursement work.
23. As a user, I want one-click manual settlement, so that I can close an expense when the actual reimbursement differs from the expected amount.
24. As a user, I want manually settled expenses excluded from the default unsettled workflow, so that closed items do not keep demanding attention.
25. As a user, I want to clear manual settlement, so that an expense can re-enter the reimbursement workflow if needed.
26. As a user, I want the dedicated reimbursements page repurposed as a review dashboard, so that I can see reimbursement income to allocate and expenses grouped by status.
27. As a user, I want existing reimbursement links migrated into the new model, so that old data remains consistent after the feature ships.

## Implementation Decisions

- Replace the old expense-driven reimbursement creation flow with an income-driven mapping flow.
- Introduce a reimbursement mapping/allocation model that supports many-to-many relationships between reimbursement income transactions and reimbursable expense transactions.
- Store allocation rows even when the allocated amount is zero, preserving the user's selected mapping.
- Store allocated amounts using the same amount representation as transactions.
- Keep expected reimbursement derived from current reimbursement rates rather than snapshotting historical rates.
- Do not rewrite stored allocation amounts automatically when rates change; recalculate expected/status live.
- Add one-click manual settlement metadata to the expense transaction.
- Allow manual settlement to be cleared.
- Keep deprecated legacy reimbursement link fields temporarily for migration safety, but stop using them in new flows.
- Migrate existing one-to-one reimbursement links into allocation rows immediately.
- Remove or deprecate claimed-date semantics from the new reimbursement workflow.
- Deleting reimbursement income deletes its mappings.
- Deleting reimbursable expenses deletes their mappings.
- Turning off an expense's reimbursable flag clears reimbursement mappings and manual settlement, with confirmation if mappings exist.
- Changing reimbursement income out of the reimbursement category clears mappings, with confirmation if mappings exist.
- Keep reimbursement income counted as normal income in dashboard totals.
- Allow cross-year mapping, as long as the expense date is on or before the reimbursement income date.
- Use reimbursement-specific UI labels: not reimbursed, partially reimbursed, reimbursed, manually settled.
- Extract a deep reimbursement allocation/status module with a stable interface for expected amount calculation, allocation, and status derivation.

## Testing Decisions

Good tests should verify external behavior: expected reimbursement amounts, allocation results, settlement statuses, filtering behavior, and migration outcomes. They should not depend on UI internals or private helper implementation details.

Test the reimbursement calculation/allocation module heavily because it contains the most important business rules: current rate lookup by expense date, nearest-euro rounding, oldest-first allocation, shortfall handling, excess handling, existing allocations from other reimbursements, zero-allocation selected mappings, and status derivation.

Test server actions for saving mappings, editing mappings, deleting mapped transactions, clearing mappings when reimbursement eligibility changes, and toggling manual settlement.

Test the migration from legacy reimbursement links into the new allocation model.

UI tests should focus on visible behavior: mapping action availability, eligible expense visibility, status labels, and reimbursement filters.

## Out of Scope

- Manual allocation amount editing.
- Reclassifying reimbursement income in dashboard totals.
- Adding reimbursement notes or manual settlement reasons.
- Supporting reimbursement mappings to future expenses.
- Over-allocating expenses beyond their expected reimbursement amount.
- Removing deprecated legacy fields in the same initial implementation, beyond stopping new usage.

## Further Notes

This design intentionally makes the saved selected expenses durable, while allocation amounts remain deterministic and recomputable when a reimbursement mapping is edited. Current rates drive expected reimbursement and settlement status, so rate changes can affect whether old expenses appear reimbursed, partially reimbursed, or not reimbursed.
