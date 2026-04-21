# Merchants

**Route:** `/merchants`

## Overview

Merchants are the businesses and vendors that appear on transactions — a supermarket, a streaming service, an employer. Managing merchants well is what makes the rest of the app accurate: assigning a category to a merchant auto-categorises all its past and future transactions.

## Reference files

| File | Role |
|---|---|
| [app/(app)/merchants/page.tsx](../../app/(app)/merchants/page.tsx) | Server Component; fetches merchants with transaction counts |
| [app/(app)/merchants/merchants-client.tsx](../../app/(app)/merchants/merchants-client.tsx) | Client Component; search, active filter, merge UI |
| [lib/actions/merchants.ts](../../lib/actions/merchants.ts) | `addMerchant`, `updateMerchant`, `deleteMerchant`, `mergeMerchants` |
| [components/fern/sheets/merchant-sheet.tsx](../../components/fern/sheets/merchant-sheet.tsx) | Add / edit merchant form |
| [lib/schema.ts](../../lib/schema.ts) | `merchants` table |

## Merchant fields

| Field | Notes |
|---|---|
| `name` | Display label |
| `comment` | Optional internal note (not shown in transaction lists) |
| `categoryId` | Default category for new transactions; also triggers backfill |
| `isActive` | `1` (default) or `0`; inactive merchants are hidden from pickers but their transactions remain |

## Business rules

### Auto-categorization backfill
When `updateMerchant` sets or changes `categoryId`, it immediately sets `categoryId` on all existing transactions where:
- `merchantId = this merchant`
- `categoryId IS NULL`

This backfill only affects **uncategorized** transactions. Transactions that already have a category are not overwritten.

### Active / inactive
Inactive merchants (`isActive = 0`) are hidden from the merchant picker in the transaction form and import wizard. Their existing transactions are unaffected. Toggling a merchant inactive is a soft-hide, not a delete.

### Merging merchants
`mergeMerchants(keepId, mergeIds[])`:
1. Updates all transactions that reference any `mergeId` to point to `keepId`.
2. Deletes the merged merchant records.

Merging is irreversible. The kept merchant's name and category win. Use this to consolidate duplicates created by the CSV import (e.g., "NETFLIX" and "Netflix").

### Deleting a merchant
`deleteMerchant(id)` deletes the merchant record. Transactions that referenced it have their `merchantId` set to `null` (not deleted).

### Transaction count
The merchants page shows how many transactions reference each merchant. This count includes all time periods and both kinds.
