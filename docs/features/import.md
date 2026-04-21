# Import

**Route:** `/transactions` (wizard opened from the Transactions page)

## Overview

The import wizard ingests a CSV bank export and converts rows into transactions. It handles merchant resolution — mapping CSV merchant names to existing merchants or creating new ones — and optionally links imported transactions to recurring items.

## Reference files

| File | Role |
|---|---|
| [app/(app)/transactions/import-wizard.tsx](../../app/(app)/transactions/import-wizard.tsx) | Full multi-step wizard UI and CSV parsing logic |
| [lib/actions/import.ts](../../lib/actions/import.ts) | `importTransactions` server action; merchant creation and bulk insert |
| [lib/actions/transactions.ts](../../lib/actions/transactions.ts) | Underlying transaction insert primitives |

## Expected CSV format

Three columns, in order:

```
Merchant,Date,Amount
Supermarché Bio,21/04/2026,45.50
Netflix,01/04/2026,-12.99
```

- **Delimiter:** `;` or `,` — auto-detected
- **Quoted fields:** supported
- **Date formats accepted:** `YYYY-MM-DD`, `DD/MM/YYYY`, `DD.MM.YYYY`
- **Amount:** float with `.` or `,` as decimal separator; negative values become expenses, positive become income

## Wizard steps

### Step 1 — Upload
User picks a CSV file. The wizard parses it client-side and shows a preview table. Parsing errors are surfaced per-row.

### Step 2 — Merchant mapping
For each unique merchant name found in the CSV, the user chooses one of:

| Option | Behaviour |
|---|---|
| `map-existing` | Link CSV name to an existing merchant; that merchant's category is applied to all matching rows |
| `create-same` | Create a new merchant using the CSV name as-is |
| `create-custom` | Create a new merchant with a user-supplied name |

If a CSV merchant name already matches an existing merchant exactly, it is pre-mapped automatically.

### Step 3 — Recurring link (optional)
The user can associate imported transactions with existing recurring items before committing the import.

### Step 4 — Confirm & import
`importTransactions` is called with the resolved merchant mappings. The action:
1. Creates any new merchants that were requested.
2. Resolves all merchant IDs (existing or newly created).
3. Batch-inserts transactions with `cleared: true`.
4. Associates category from merchant where available.

## Business rules

- All imported transactions are marked `cleared: true`.
- Duplicate detection is not automatic — the user is responsible for not importing the same CSV twice.
- Merchant auto-categorization: if the chosen merchant has a `categoryId`, that category is applied to imported rows for that merchant.
- Amount sign determines `kind`: negative → `expense`, positive → `income`.
