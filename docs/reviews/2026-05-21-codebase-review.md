# Codebase Review — FinAlly

_Generated: 2026-05-21_

Items are grouped by severity. Within each group, highest-impact items first.

---

## Critical — Bugs / Silent Failures

### 1. Server Actions swallow all errors silently
**Files:** All `lib/actions/*.ts`, every client caller in `*-client.tsx`

Every Server Action (`addTransaction`, `updateRecurring`, `setExpenseManualSettlement`, etc.) throws on failure. Every client caller wraps them in `startTransition(async () => { await action() })` with no `try/catch`. If the DB throws, the error is silently dropped. The user sees nothing — no toast, no alert, no indication the write failed.

**Fix:** Adopt a `Result<T>` return convention for Server Actions, or at minimum wrap every action call in `try/catch` on the client.

---

### 2. `openingBalance` input drifts from server state
**File:** `app/(app)/dashboard/dashboard-client.tsx:250`

```tsx
<input defaultValue={openingBalance} onBlur={…} />
```

`defaultValue` only sets the initial value. After a `revalidatePath` call regenerates the page (e.g., adding a transaction), the server sends a new `openingBalance` prop but React does not update an uncontrolled input. The displayed value silently stales until a hard reload.

**Fix:** Use `value` + `onChange` (controlled input) or add a `key={openingBalance}` to force remount when the prop changes.

---

### 3. `canLoadMore` shadows `currentYear` with a stale computation
**File:** `app/(app)/transactions/transactions-client.tsx:338`

```ts
const canLoadMore = …
  const currentYear = new Date().getFullYear()  // ← shadows outer variable
```

A fresh `new Date()` is called inside a derived constant, every render. If the user views a past year's data and the clock ticks into a new year mid-session, `canLoadMore` computes with the wrong year. The outer `currentYear` (already the correct reference) is ignored.

**Fix:** Remove the inner declaration; use the existing outer `currentYear`.

---

### 4. `updateTransaction` and `updateTransactionWithRecurringAmountOption` are near-identical
**File:** `lib/actions/transactions.ts:54–278`

~120 lines of shared logic (fetching the row, computing `nextKind`, `nextCategoryId`, cash-cleared auto-set, reimbursement cleanup) are copy-pasted between two functions. Any bug fix or schema change must be applied twice.

**Fix:** Have the simpler `updateTransaction` delegate to `updateTransactionWithRecurringAmountOption` with `propagateRecurringAmount: false`. The extra logic in the second function is already gated on `shouldPropagate`.

---

### 5. `RecurringInstancesBootstrap` runs on every client-side navigation
**File:** `components/fern/recurring-instances-bootstrap.tsx`

The `useEffect([])` fires every time the app-shell layout mounts. In Next.js App Router, layouts can remount on navigation. Each call iterates all recurring items and attempts inserts (idempotent, but still hits the DB unnecessarily on every page change).

**Fix:** Move the bootstrap call to a server-side location that runs once per process (e.g., `instrumentation.ts` `register()`) or guard with a module-level flag so the client effect fires at most once per page load.

---

## High — Dead Code

### 6. `recordReimbursement`, `deleteReimbursement`, `getApplicableRate` are unreachable
**File:** `lib/actions/reimbursements.ts:57, 79, 105`

The new reimbursement flow (claims + allocations) replaced these functions. No client component calls them. They reference the old income-transaction model and will behave incorrectly if accidentally invoked.

**Fix:** Delete all three.

---

### 7. `lib/queries/transactions-search.ts` and `lib/queries/transactions-summary.ts` are entirely unused
**Files:** both files

`searchMovementsFTS`, `getYearTotalsByMonth`, `getYearTotalsByMerchant`, `getYearTotalsByCategory`, `getMovementsPage`, `encodeCursor`, `decodeCursor` — none are imported anywhere. These are leftovers from an earlier pagination approach.

**Fix:** Delete both files.

---

### 8. `ReimbursementSheet` component is orphaned (old flow)
**File:** `components/fern/sheets/reimbursement-sheet.tsx`

Its props signature matches the deleted `recordReimbursement` action. It is not referenced from any page or client. If it were accidentally wired up again it would conflict with the new claims model.

**Fix:** Delete if confirmed unused. (`grep -r "ReimbursementSheet"` to verify.)

---

### 9. `app/(app)/page.tsx` is unreachable
**File:** `app/(app)/page.tsx`

`app/page.tsx` redirects to `/dashboard` before the `(app)` route group is ever considered. The inner redirect file is dead.

**Fix:** Delete `app/(app)/page.tsx`.

---

### 10. `endOfCurrentMonth()` is misnamed and wrong
**File:** `lib/recurring-instances.ts:121`

```ts
export function endOfCurrentMonth(): string {
  return currentMonth()  // returns "YYYY-MM", not end-of-month
}
```

No caller imports it. The contract is broken (name says "end of month", returns month string).

**Fix:** Delete the function.

---

### 11. `TaxAllocation` unused re-export
**File:** `lib/db-types.ts:41`

`TaxAllocation` is exported but never imported anywhere. Only `TaxAllocationValue` is used.

**Fix:** Remove the export.

---

## Medium — Simplification / Quality

### 12. `'Remboursements'` category name is a magic string in 4+ places
**Files:** `app/(app)/transactions/page.tsx:92`, `lib/actions/transactions.ts:117,121`, `lib/actions/reimbursements.ts:158`

The category is identified by comparing `name === 'Remboursements'` at runtime. A typo or rename silently breaks reimbursement detection.

**Options (recommended first):**
- **Add a boolean `isReimbursement` column to the `categories` table.** Seeded once, query-safe, typo-proof.
- Extract to a single `REIMBURSEMENT_CATEGORY_NAME` constant in `lib/schema.ts` or `lib/seed.ts` and import everywhere.

---

### 13. `seed()` called on every SSR request
**File:** `app/layout.tsx:38`

The singleton promise makes it effectively a no-op after the first resolve, but every server render still awaits the promise and `force-dynamic` disables all static optimization for the entire app.

**Options (recommended first):**
- **Move to `instrumentation.ts` `register()` hook.** Runs once per server process, not per request. Remove `force-dynamic`.
- Keep as-is if the project will never be deployed to a production server (acceptable for a personal app).

---

### 14. `settings.currency` fetched but `€ · EUR` is hardcoded in sidebar
**File:** `app/(app)/layout.tsx:46`

`getUserSettings()` is awaited in the layout, but the result's `currency` field is ignored — the footer always shows `€ · EUR`.

**Fix:** Either use `settings.currency` in the sidebar display, or stop fetching settings in the layout (move the fetch to the pages that actually need it).

---

### 15. Unscoped full-table fetches will not scale
**Files:**
- `app/(app)/reimbursements/page.tsx:36` — fetches all `reimbursementClaimAllocations`
- `app/(app)/transactions/page.tsx:73` — fetches all `reimbursementAllocations`

Both queries have no `WHERE` clause. For a personal finance app this is acceptable today, but both should be scoped to the current year to avoid full scans as data accumulates.

**Fix:** Add `.where(gte(table.date, `${selectedYear}-01-01`))` (or equivalent) to both queries.

---

### 16. `syncEffectiveAmount` duplicated between action and lib
**Files:** `lib/actions/recurring.ts:305`, `lib/recurring-amounts.ts:68`

`syncEffectiveAmount` (local to `recurring.ts`) and `syncRecurringEffectiveAmountTx` (in `recurring-amounts.ts`) do the same thing. Only the argument name differs.

**Fix:** Remove the private copy in `recurring.ts`; call `syncRecurringEffectiveAmountTx` from `lib/recurring-amounts.ts`.

---

### 17. `parseDecimal` copy-pasted across three sheet components
**Files:**
- `components/fern/sheets/transaction-sheet.tsx:16`
- `components/fern/sheets/recurring-sheet.tsx:18`
- `components/fern/sheets/reimbursement-sheet.tsx:12`

```ts
const parseDecimal = (v: string) => Number(v.replace(',', '.'))
```

**Fix:** Move to `lib/utils.ts` and import.

---

### 18. Year-picker segmented control duplicated across three pages
**Files:**
- `app/(app)/transactions/transactions-client.tsx:714–728`
- `app/(app)/reimbursements/reimbursements-client.tsx:202–215`
- `app/(app)/tax-status/tax-status-client.tsx:108–125`

The same `<div className="fern-segmented">` block with identical `router.push` logic appears in all three. The only difference is the route prefix.

**Fix:** Extract a `<YearPicker years={…} selected={…} onSelect={…} />` component.

---

### 19. `transactions-client.tsx` is 1440 lines
**File:** `app/(app)/transactions/transactions-client.tsx`

The component handles: year/month navigation, 7 filter types, infinite scroll via `IntersectionObserver`, scroll-to-month deep linking, ghost instance entries, selection mode with bulk actions, sheet management, and full month/date/row rendering.

**Suggested extractions (no behaviour change):**
1. `<TransactionFilters />` — filter row (lines ~600–720)
2. `<TransactionRow />` — single row render (lines ~870–970)
3. `useScrollToTarget()` — the `IntersectionObserver` + URL-sync effect (lines ~360–450)

---

### 20. `visibleMonthsByYear` is `Record<year, months>` but only one year is ever visible
**File:** `app/(app)/transactions/transactions-client.tsx:151`

The state key is the selected year, but the component only ever renders one year at a time (year comes from the URL). The record adds complexity for no benefit.

**Fix:** Replace with `const [visibleMonths, setVisibleMonths] = useState(initialMonths)` and reset on year change with a `key` prop or `useEffect`.

---

### 21. `timelineTo` uses `-31` for all month endings
**File:** `app/(app)/transactions/page.tsx:45`

```ts
const timelineTo = `${endMonth}-31`
```

November, April, June, September have 30 days. The string `2025-11-31` is never a real date, but SQLite's lexicographic `lte` comparison still works correctly. The code is misleading.

**Fix:** Use `dayjs(endMonth).endOf('month').format('YYYY-MM-DD')` or the equivalent.

---

### 22. `lib/db.ts` hardcoded relative path
**File:** `lib/db.ts:5`

```ts
url: 'file:./finance.db'
```

Resolves relative to the process working directory. In some deploy environments this differs from the project root.

**Fix:** `url: \`file:${path.join(process.cwd(), 'finance.db')}\`` or an env variable.

---

## Low — Minor / Conventions

### 23. No page-level `metadata` exports
All route pages share the root layout's `title: "FinAlly — personal finances"`. Browser tabs and SEO get no per-page titles.

**Fix:** Add `export const metadata: Metadata = { title: 'Transactions | FinAlly' }` etc. to each page file.

---

### 24. `dashboard-client.tsx` receives `settings` prop it never uses
**File:** `app/(app)/dashboard/dashboard-client.tsx:57, 69`

`DashboardClientProps` includes `settings: Settings`. The component destructures it but the value is never referenced in JSX.

**Fix:** Remove the prop from the interface and the page's call site, or actually use `settings.currency` in the money display.

---

### 25. `seed.ts` special-category guard is always true on first run
**File:** `lib/seed.ts:41`

`existingCats` is fetched before the initial `DEFAULT_CATEGORIES` insert. On first run the list is empty, so `if (!exists)` is always true. The `INSERT OR IGNORE` is what actually handles idempotency — the guard is misleading.

**Fix:** Either reload `existingCats` after the initial insert, or drop the guard and rely solely on `INSERT OR IGNORE`.

---

## Summary Table

| # | Severity | Category | Effort |
|---|----------|----------|--------|
| 1 | Critical | Bug — silent write failures | M |
| 2 | Critical | Bug — stale input value | S |
| 3 | Critical | Bug — wrong year in load-more | S |
| 4 | Critical | Bug — duplicated mutation logic | M |
| 5 | Critical | Bug — bootstrap on every nav | M |
| 6 | High | Dead code — 3 action functions | S |
| 7 | High | Dead code — 2 entire query files | S |
| 8 | High | Dead code — orphaned sheet component | S |
| 9 | High | Dead code — unreachable redirect page | S |
| 10 | High | Dead code — wrong/unused function | S |
| 11 | High | Dead code — unused export | S |
| 12 | Medium | Magic string — category name | M |
| 13 | Medium | Simplification — seed on every request | M |
| 14 | Medium | Dead fetch — settings not used in layout | S |
| 15 | Medium | Correctness — unscoped table scans | S |
| 16 | Medium | Duplication — syncEffectiveAmount | S |
| 17 | Medium | Duplication — parseDecimal | S |
| 18 | Medium | Duplication — year-picker control | M |
| 19 | Medium | Complexity — 1440-line component | L |
| 20 | Medium | Simplification — visibleMonthsByYear | S |
| 21 | Medium | Misleading — timelineTo date string | S |
| 22 | Medium | Config — hardcoded DB path | S |
| 23 | Low | Convention — missing page metadata | S |
| 24 | Low | Dead prop — settings in dashboard | S |
| 25 | Low | Misleading — seed guard | S |

_Effort: S = < 30 min, M = 1–3 h, L = half day+_
