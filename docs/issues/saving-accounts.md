# Saving accounts + "Saving" movement type

## Status — implemented (branch `restore-divorce-module`)

All 7 phases landed. `npm run typecheck`, `npm run lint` (0 errors), `npm test`
(113 pass, incl. new `test/actions/saving-accounts.test.ts` + `lib/derive.test.ts`
cases) and `npm run build` all green. Migration `0017_saving_accounts` applied to
`finance.db` (backup at `backups/finance.db.pre0017`).

**Deferred to a follow-up** (not blocking): recurring *saving* transfers are
created/edited/deleted on `/recurring` and appear in a new "Savings" section, but
they do **not** yet generate planned/ghost rows in the Credit Account view and
their `recurring_instances` are not auto-linked when a matching transfer is logged
(saving recurrences are filtered out of `instanceEntries` in
`transactions-client.tsx`). Wiring `addTransaction`'s saving branch to accept
`recurringId` + call `upsertLinkedInstance`, and teaching `InstanceEntry` the
endpoint ids, is the remaining work.

## Context

Today the app models a single implicit account: a starting balance in `user_settings`
plus optional per-month overrides in `monthly_opening_balances`. `transactions.kind`
is `expense | income` and nearly every balance/analytics path assumes those two.

The user wants to track **saving accounts** and money moved from the main (credit)
account into them. New requirements:

- Manage multiple saving accounts (name required, description optional, start balance
  set at creation, everything editable). Deletable until the first transfer touches it.
- A new movement type **Saving**: a transfer (always a *virement*) with amount,
  target saving account, date. Debits the credit account, credits the saving account.
- A saving-account view mirroring the credit-account view but stripped down (no
  merchant, fewer filters), able to record transfers back out (to credit or another
  saving account).
- Left menu: "Movements" becomes **Credit Account**; each saving account is listed
  under it.
- Recurring gains a **saving** kind (source account, target account, amount, date,
  frequency).
- A protected auto-created **Savings** category (color/icon editable) used for every
  saving movement.
- Dashboard balance widget shows every account's balance + a net-worth total.
- Saving-account CRUD lives in the Admin menu.

### Decisions locked with the user

| Topic | Decision |
|---|---|
| Transfer storage | **Single `transactions` row**, `kind='saving'`, with source + dest saving-account ids (NULL = the credit account) |
| Savings in analytics | **Excluded** from spending totals / "Where it went" / Budgets / Simulations; shown as their own line |
| Account pickers | **Only** Saving movements/recurrences pick accounts; expense/income always hit the credit account |
| Savings category kind | `kind='expense'` + new `is_savings` flag (mirrors `is_pension_alimentaire`) |
| Saving-account balance | **Single editable start balance**; no per-month overrides |
| Delete rule | Allowed until the first transfer references the account (start balance alone doesn't block) |
| Overdraw | **Blocked**: an outbound transfer may not exceed the source saving account's current balance (credit account stays unblocked, as today) |
| Dashboard | Keep the credit balance card; add a compact per-saving-account balance list + net-worth total |

## Data model

### New table `saving_accounts` (`lib/schema.ts`)
`id` text pk, `name` text notNull, `description` text, `startBalance` real notNull
default 0, `sortOrder` int notNull default 0, `createdAt` text default now.
Add `SavingAccount` to `lib/db-types.ts`.

### `transactions` — two nullable columns
`sourceSavingAccountId` text → `saving_accounts.id` `onDelete: 'set null'`
`destSavingAccountId` text → `saving_accounts.id` `onDelete: 'set null'`
Semantics for `kind='saving'` (exactly one of the two ids may be NULL, meaning credit):
- credit → A: source `NULL`, dest `A`
- A → credit: source `A`, dest `NULL`
- A → B: source `A`, dest `B`

### `recurring` — two nullable columns
Same `sourceSavingAccountId` / `destSavingAccountId`.

### `categories` — `is_savings`
`isSavings` int notNull default 0. Partial unique index
`categories_savings_unique on (is_savings) where is_savings = 1` (mirrors the
pension-alimentaire index at `lib/schema.ts:21`).

### `kind` enums
`transactions.kind` and `recurring.kind` become `['expense','income','saving']`.
drizzle-kit sqlite enums are type-only (no CHECK constraint), so this is a
`schema.ts` + TypeScript change with **no SQL**.

### Migration `drizzle/0017_saving_accounts.sql` (hand-written, per AGENTS.md §5)
1. `CREATE TABLE saving_accounts (...)`.
2. `ALTER TABLE transactions ADD COLUMN source_saving_account_id text REFERENCES saving_accounts(id) ON DELETE SET NULL;` (+ dest). Nullable add — no table rebuild.
3. `ALTER TABLE recurring ADD COLUMN ...` (source + dest).
4. `ALTER TABLE categories ADD COLUMN is_savings integer NOT NULL DEFAULT 0;`
5. `CREATE UNIQUE INDEX categories_savings_unique ON categories (is_savings) WHERE is_savings = 1;`
6. `INSERT OR IGNORE` the Savings category row (so existing DBs get it without waiting for `seed()`).

Also hand-write `drizzle/meta/0017_snapshot.json` (copy 0016, apply the deltas) and
append the journal entry in `drizzle/meta/_journal.json` (idx 17). Take a named
save-point `backups/finance.db.pre0017` before `npm run db:migrate` — this migration
is additive but touches `transactions`.

## Shared helpers

### `lib/utils.ts`
`export const SAVINGS_CATEGORY_NAME = 'Savings'`.

### `lib/derive.ts` — credit-account signing
Add:
```ts
/** How a movement changes the CREDIT account balance. */
export function creditSignedAmount(t: {
  kind: 'expense' | 'income' | 'saving'
  amount: number | string
  sourceSavingAccountId?: string | null
  destSavingAccountId?: string | null
}): number
```
Rules: income `+`, expense `−`, `saving` with `destSavingAccountId == null` `+`
(money returning to credit), `saving` with `sourceSavingAccountId == null` `−`
(money leaving credit), saving↔saving `0`.
Rewrite `currentBalance` (`lib/derive.ts:914`) to sum `creditSignedAmount`.
Add `savingAccountBalance(startBalance, txns, accountId)` = `startBalance +
Σ(amount where dest == id) − Σ(amount where source == id)`.

### `lib/queries/opening-balance.ts`
Replace `deltaExpr` (`CASE WHEN kind='income' ...`) with the credit-aware CASE:
```sql
CASE
  WHEN kind = 'income' THEN amount
  WHEN kind = 'expense' THEN -amount
  WHEN kind = 'saving' AND source_saving_account_id IS NULL THEN -amount
  WHEN kind = 'saving' AND dest_saving_account_id IS NULL THEN amount
  ELSE 0
END
```

### `lib/queries/saving-accounts.ts` (new)
`listSavingAccounts()` and `getSavingAccountBalances()` → `Map<id, number>`
(start balance + net transfers, single grouped query).

### `lib/schemas.ts`
Add a dedicated `zMovementKind = z.enum(['expense','income','saving'])` used only by
the transaction + recurring actions (leave the broadly-used `zKind` as
`expense|income` for categories/budgets/simulations). Reuse `zOptionalId` for the
two endpoint ids.

## Server actions

### `lib/actions/saving-accounts.ts` (new)
- `addSavingAccount({ name, description, startBalance })`
- `updateSavingAccount(id, { name?, description?, startBalance? })`
- `deleteSavingAccount(id)` — throws if any `transactions` row has
  `sourceSavingAccountId == id` or `destSavingAccountId == id`.
All `parse(...)` with zod, then `revalidateApp()` (pattern: `lib/actions/categories.ts`).

### `lib/actions/transactions.ts`
- Extend `addTransactionSchema` / `updateTransactionSchema`: `kind` → movement kind,
  optional `sourceSavingAccountId` / `destSavingAccountId`.
- When `kind === 'saving'`: force `method = 'transfer'`, set
  `categoryId = <Savings category id>` (look up by `isSavings = 1`), ignore
  merchant/reimbursable. Require exactly one endpoint to differ and not both NULL;
  reject `source === dest`.
- **Overdraw guard**: if `sourceSavingAccountId` is set, compute that account's
  current balance (reuse `getSavingAccountBalances`) and throw
  `"Not enough in <name>"` when `amount` exceeds it (on add and on edit).
- `deleteTransaction` already just deletes the row — fine (balances re-derive).

### `lib/actions/recurring.ts`
Mirror the above in `recurringCreateSchema` / `recurringUpdateSchema` and
`addRecurring` / `updateRecurring`: `kind='saving'` forces method `transfer`,
category Savings, stores the two endpoint ids. `recurring_instances` machinery
(`lib/recurring-instances.ts`) is kind-agnostic and needs no change.

### `lib/actions/categories.ts`
`isProtected` also returns true when `isSavings === 1` (blocks delete + deactivate).
Keep name/color/icon editable.

### `lib/seed.ts`
Add to `SPECIAL_CATEGORIES`: `{ icon: 'cat-seed', name: SAVINGS_CATEGORY_NAME,
color: 'sage', kind: 'expense', isPensionAlimentaire: 0, isSavings: 1 }` and match it
by the `isSavings` flag in the idempotency check.

## UI

### `components/fern/sheets/transaction-sheet.tsx`
- Add a third segment **Saving** to the `kind` toggle.
- New props: `savingAccounts: SavingAccount[]`, and `prefill` gains
  `sourceSavingAccountId` / `destSavingAccountId`.
- When `kind === 'saving'`: hide method, merchant, category grid, reimbursable;
  show **From** and **To** selects (options: "Credit account" + every saving
  account; the two can't be equal). Zod `superRefine` for from ≠ to and a soft
  overdraw hint when From is a saving account.
- `onSave` payload gains `kind: 'saving'` + the two ids.

### `components/fern/sheets/saving-account-sheet.tsx` (new)
Create/edit: name, description, start balance. Follows `SheetShell` +
`useSheetForm` like `recurring-sheet.tsx`.

### Admin — `app/(app)/accounts/page.tsx` + `accounts-client.tsx` (new)
List saving accounts with balances; create / edit / delete (delete disabled with a
reason when transfers exist). Add `{ href: '/accounts', label: 'Accounts',
icon: 'bank' }` to the **Admin** section of `app/(app)/sidebar-nav.tsx`.

### Sidebar — `app/(app)/sidebar-nav.tsx` + `app/(app)/layout.tsx`
- Rename the `/transactions` item label to **Credit Account**.
- `layout.tsx` fetches `listSavingAccounts()` and passes them to `SidebarNav`;
  render one `/savings/<id>` link per account directly under Credit Account.

### Credit Account view — `app/(app)/transactions/*`
- `page.tsx`: load `savingAccounts`; pass to client + sheet.
- Show `kind='saving'` rows that touch credit (`source IS NULL OR dest IS NULL`).
  Render with the Savings category swatch and a small transfer glyph + "→ <account>"
  / "<account> →" label. Reuse `TransactionRow` with a minimal branch.
- Fix the three `kind === 'income' ? 1 : -1` reduces
  (`dashboard-client.tsx:136,178,187`) and the day-total at
  `transactions-client.tsx:853` to use `creditSignedAmount`.
- Kind filter gains a "Saving" option; saving rows are naturally excluded from the
  reimbursement/merchant filters.

### Saving-account view — `app/(app)/savings/[id]/page.tsx` + `saving-account-client.tsx` (new)
Deliberately lighter than `TransactionsClient`:
- Header: account name, description, current balance, edit button.
- Month-grouped list of transfers where `source == id OR dest == id`, each showing
  direction + counterparty + running effect.
- Filters: year + text search only.
- FAB / button opens `TransactionSheet` prefilled `kind='saving'`,
  `sourceSavingAccountId = id` (i.e. "move money out"), and also a plain add that
  defaults From = Credit, To = this account.
- 404 via a simple `notFound()` when the id is unknown (no module guard needed).

### Dashboard — `app/(app)/dashboard/page.tsx` + `dashboard-client.tsx`
- Load saving accounts + balances.
- In the balance card (or a sibling card): a "Savings" list — one row per account
  (name · balance) — and **Net worth = credit balanceToday + Σ saving balances**.
- Apply `creditSignedAmount` to the balance reduces (see above).

### Categories admin — `app/(app)/categories/*`
The Savings category renders like other protected categories (no delete/deactivate,
color/icon still editable). Filter it out of the **expense** picker in
`transaction-sheet.tsx` / `recurring-sheet.tsx` (`c.isSavings !== 1`) so it doesn't
appear as a normal expense category.

## Build sequence (incremental — validate each phase before the next)

1. **Schema + migration + seed + types.** Write `0017` SQL + snapshot + journal,
   `schema.ts`, `db-types.ts`, `utils.ts`, `seed.ts`. Run `npm run db:migrate`,
   `npm run typecheck`, boot the app → verify Savings category exists, no regressions.
2. **Saving-account CRUD.** `lib/actions/saving-accounts.ts`,
   `lib/queries/saving-accounts.ts`, `/accounts` page + sheet, Admin nav link.
   Verify create / edit / delete + delete-blocked-after-use.
3. **Balance math.** `creditSignedAmount` + `currentBalance` + `savingAccountBalance`
   in `derive.ts`; `opening-balance.ts` SQL. Unit tests in `lib/derive.test.ts`.
4. **"Saving" movement.** Transaction sheet third type + `transactions.ts` action
   (category/method forcing, overdraw guard). Verify credit→saving and saving→credit
   move both balances; saving→saving leaves credit untouched; overdraw rejected.
5. **Views + nav.** Rename to Credit Account, saving rows in the credit list,
   `/savings/[id]` view, dynamic sidebar links.
6. **Dashboard net worth.**
7. **Recurring savings.** `recurring.ts` action + recurring sheet third type +
   `/recurring` list display.

## Verification

- `npm run db:migrate` succeeds; `sqlite3 finance.db '.schema saving_accounts'` and
  `.schema transactions` show the new columns; existing rows intact.
- `npm run typecheck` and `npm run test` pass. New tests:
  - `creditSignedAmount` for all 5 cases; `savingAccountBalance`.
  - `deleteSavingAccount` throws once a transfer references it.
  - overdraw guard in `addTransaction`.
- Manual (`npm run dev`):
  1. Admin → Accounts → create "Livret A" start €1 000. Sidebar shows it under
     Credit Account. Dashboard net worth = credit + 1 000.
  2. Log a Saving movement Credit → Livret A €200 (today). Credit balance −200,
     Livret A €1 200, movement appears in both views, category = Savings, method
     forced to virement.
  3. From the Livret A view, move €300 back to Credit → both balances adjust.
  4. Attempt to move €5 000 out of Livret A → blocked with "Not enough in Livret A".
  5. Create a second saving account, transfer between the two → credit balance and
     dashboard "Out" unchanged; "Where it went" and Budgets ignore all of it.
  6. Delete the second account (no transfers yet) → succeeds. Deleting Livret A →
     blocked with a reason.
  7. Recurring → new "Saving" recurrence Credit → Livret A €100 monthly; it shows in
     `/recurring`, is absent from the dashboard "Recurring" (expense) widget.
