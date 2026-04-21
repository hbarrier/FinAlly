# Categories

**Route:** `/categories`

## Overview

Categories classify transactions into labelled buckets — Groceries, Rent, Salary, and so on. Each category belongs to one kind (`expense` or `income`) and carries a colour and icon for visual identification across the app.

The categories page shows all categories with their current-month spend, transaction count, and usage statistics.

## Reference files

| File | Role |
|---|---|
| [app/(app)/categories/page.tsx](../../app/(app)/categories/page.tsx) | Server Component; fetches categories and current-month transactions |
| [app/(app)/categories/categories-client.tsx](../../app/(app)/categories/categories-client.tsx) | Client Component; tabbed by kind, add/edit/delete |
| [lib/actions/categories.ts](../../lib/actions/categories.ts) | `addCategory`, `updateCategory`, `deleteCategory` |
| [components/fern/sheets/category-sheet.tsx](../../components/fern/sheets/category-sheet.tsx) | Add / edit category form |
| [lib/schema.ts](../../lib/schema.ts) | `categories` table |

## Category fields

| Field | Default | Notes |
|---|---|---|
| `name` | — | Display label; must be unique within the app |
| `icon` | `'tag'` | Lucide icon name |
| `color` | `'teal'` | Token name from the design system |
| `kind` | — | `'expense'` or `'income'`; cannot be changed after creation |
| `isPensionAlimentaire` | `0` | Marks the category used for pension alimentaire income; see [Reimbursements](reimbursements.md) |

## Business rules

### Kind is immutable
Once created, a category's `kind` cannot be changed. Changing it would corrupt historical reporting because existing transactions would be counted in the wrong direction.

### Deleting a category
`deleteCategory(id)` sets `categoryId = NULL` on all transactions in that category. Transactions are not deleted. Budgets linked to the category are cascade-deleted.

### Auto-categorization via merchants
When a merchant is given a category, existing transactions from that merchant that have no category are automatically assigned the merchant's category. This means a category indirectly gains transactions through the merchant assignment flow — see [Merchants](merchants.md).

### Current-month spend
The categories page shows `thisMonthTransactions` filtered to each category. This is for reference only — no business logic depends on it at the category level (budgets handle the limit logic).

### Pension alimentaire flag
At most one category should have `isPensionAlimentaire = 1`. This flag is what causes matching income transactions to appear in the dedicated section of the Reimbursements page. The flag is set via `updateCategory`.
