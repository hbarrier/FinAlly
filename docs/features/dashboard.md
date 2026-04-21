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
| [components/fern/sheets/transaction-sheet.tsx](../../components/fern/sheets/transaction-sheet.tsx) | "Add transaction" sheet triggered from the dashboard FAB |

## Business rules

### Month scope
All figures are scoped to the current calendar month. The reference date is `new Date()` on the server at render time. There is no month navigation on the dashboard — use the Transactions page for historical views.

### Income and expense totals
- Summed from transactions in the current month using `sumByKind(txns, 'income')` and `sumByKind(txns, 'expense')`.
- All transactions are included regardless of `cleared` status.

### Current balance
Computed as: `startingBalance + totalIncome − totalExpenses` across **all** transactions ever recorded (not just the current month). The `startingBalance` comes from `userSettings`.

### Upcoming recurring
- Calls `thisMonthRecurring(recurringItems, today)` to get all recurring occurrences in the current month.
- Items whose occurrence date has already passed are shown as past; upcoming ones are highlighted.
- Uses `effectiveAmount` to display the correct amount for the current date.

### Spending by category
- Built with `spendingByCategory(monthTransactions, categories)`.
- Only expense transactions are included.
- Sorted by total amount descending.
- Rendered as horizontal bars (`CategoryBars` component).
