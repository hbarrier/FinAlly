# Recurring

**Route:** `/recurring`

## Overview

Recurring items represent income or expenses that happen on a predictable schedule — monthly rent, a weekly grocery run, an annual insurance premium. Fern tracks them separately from transactions so that you can see what to expect each month and compare planned vs. actual.

A recurring item can be linked to individual transactions after the fact, giving you a history of actual payments for each bill.

## Reference files

| File | Role |
|---|---|
| [app/(app)/recurring/page.tsx](../../app/(app)/recurring/page.tsx) | Server Component; fetches recurring items with their amount histories |
| [app/(app)/recurring/recurring-client.tsx](../../app/(app)/recurring/recurring-client.tsx) | Client Component; monthly estimate cards, item list, edit/delete |
| [lib/actions/recurring.ts](../../lib/actions/recurring.ts) | All recurring mutations |
| [lib/derive.ts](../../lib/derive.ts) | `effectiveAmount`, `thisMonthRecurring`, `allOccurrencesInRange`, `monthlyEstimate` |
| [components/fern/sheets/recurring-sheet.tsx](../../components/fern/sheets/recurring-sheet.tsx) | Add / edit recurring form with amount history |
| [components/fern/amount-history-chart.tsx](../../components/fern/amount-history-chart.tsx) | Sparkline chart of amount changes over time |

## Recurring item fields

| Field | Notes |
|---|---|
| `name` | Display label |
| `amount` | Current effective amount (kept in sync with `recurringAmounts`) |
| `kind` | `'expense'` or `'income'` |
| `categoryId` | Optional |
| `merchantId` | Optional |
| `cadence` | `'weekly'`, `'monthly'`, or `'yearly'` |
| `dayOfMonth` | 1–31; used for monthly cadence |
| `dayOfWeek` | 0–6 (Sun–Sat); used for weekly cadence |
| `monthOfYear` | Used with `dayOfMonth` for yearly cadence |
| `startDate` | ISO date; item does not occur before this date |
| `endDate` | ISO date (optional); item does not occur after this date |

## Business rules

### Cadence and occurrence dates
`thisMonthRecurring` and `allOccurrencesInRange` in `lib/derive.ts` compute exact dates:

- **Monthly:** fires on `dayOfMonth` every month within range.
- **Weekly:** fires on `dayOfWeek` every week within range (0 = Sunday).
- **Yearly:** fires on the anniversary of `startDate` (same month and day) each year.

`startDate` and `endDate` are enforced: occurrences outside that window are omitted.

### Monthly estimate
`monthlyEstimate(item, ref)` normalises any cadence to a monthly amount for the summary cards:
- Monthly → amount as-is
- Weekly → amount × 4.33
- Yearly → amount ÷ 12
- Returns `0` if `endDate` is in the past relative to `ref`.

### Amount versioning
Recurring items maintain a history of amounts in the `recurringAmounts` table. Each entry has an `amount` and a `startDate` (the date from which that amount applies).

`effectiveAmount(amounts, date)` returns the amount whose `startDate` is closest to and not after `date`. If all entries are in the future, the earliest one is returned.

When a user edits a recurring item's amount:
- If the new amount differs from the current effective amount, a new `recurringAmounts` row is inserted with `startDate = today`.
- `recurring.amount` is kept in sync with the latest effective amount (`syncEffectiveAmount` helper).

### Promoting a transaction to recurring
`promoteToRecurring(txnId, data)`:
1. Creates a new recurring item from the transaction's data.
2. Links the source transaction to the new recurring item.
3. Scans existing transactions for matches (same merchant + amount, within ~5 days of the expected cadence date) and bulk-links them.

`bulkPromoteToRecurring` does the same for a pre-selected set of transactions.

### Deleting
- Deleting a recurring item cascade-deletes all `recurringAmounts` entries.
- Linked transactions have their `recurringId` set to `null` (not deleted).
