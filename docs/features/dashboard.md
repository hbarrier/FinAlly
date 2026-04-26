# Dashboard

**Route:** `/dashboard`

## Overview

The dashboard is the home screen. It shows the financial picture for the current month at a glance: how much came in, how much went out, what recurring payments are coming up, and where spending is concentrated by category.

## Reference files

| File | Role |
|---|---|
| [app/(app)/dashboard/page.tsx](../../app/(app)/dashboard/page.tsx) | Server Component; fetches all data and passes it to client |
| [app/(app)/dashboard/dashboard-client.tsx](../../app/(app)/dashboard/dashboard-client.tsx) | Client Component; renders cards, charts, and interactive elements |
| [lib/derive.ts](../../lib/derive.ts) | `sumByKind`, `spendingByCategory`, `thisMonthRecurring`, `thisMonthTransactions`, `fmt` |
| [lib/queries/opening-balance.ts](../../lib/queries/opening-balance.ts) | Computes explicit vs derived opening balance for the month |
| [lib/actions/monthly-opening-balances.ts](../../lib/actions/monthly-opening-balances.ts) | Persists an explicit opening balance for a month |
| [components/fern/sheets/transaction-sheet.tsx](../../components/fern/sheets/transaction-sheet.tsx) | "Add transaction" sheet triggered from the dashboard FAB |

## Business rules

### Month scope
All figures are scoped to the current calendar month. The reference date is `new Date()` on the server at render time. There is no month navigation on the dashboard — use the Transactions page for historical views.

### Income and expense totals
- Summed from transactions in the current month using `sumByKind(txns, 'income')` and `sumByKind(txns, 'expense')`.
- All transactions are included regardless of `cleared` status.

### Current balance
Dashboard balance is computed within the **current month**, starting from a month opening balance:

- **Opening balance**:
  - can be explicitly set per month in `monthly_opening_balances`
  - otherwise it is **derived** using `userSettings.startingBalance` and historical transactions up to the month start (see `getMonthOpeningBalance`)
- **Balance today**: `openingBalance + sum(monthTxns up to today)`
- **Projected end-of-month**: `openingBalance + sum(monthTxns up to month end)`

The dashboard allows entering/updating the explicit opening balance for the current month.

### Cleared-only toggle
The “Balance evolution” chart and month totals can be toggled to use:

- **All** transactions for the month, or
- **Cleared only** transactions (`transactions.cleared = 1`)

### Upcoming recurring
- Calls `thisMonthRecurring(recurringItems, today)` to get all recurring occurrences in the current month.
- Items whose occurrence date has already passed are shown as past; upcoming ones are highlighted.
- Uses `effectiveAmount` to display the correct amount for the current date.

### Spending by category
- Built with `spendingByCategory(monthTransactions, categories)`.
- Only expense transactions are included.
- Sorted by total amount descending.
- Rendered as horizontal bars (`CategoryBars` component).
