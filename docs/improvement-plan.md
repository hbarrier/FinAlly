# Improvement Plan — tracking checklist

Condensed from the Aug 2026 full code review. Full plan (with evidence and file
references) lives at `~/.claude/plans/analyze-thoroughly-the-code-wobbly-wreath.md`.

Treat the app as **may be deployed / multi-user later** when prioritising.

Status key: `[x]` done · `[~]` in progress · `[ ]` todo · `⏸` blocked

---

## Phase 0 — Safety net & repo hygiene

- [x] vitest + coverage, `test` / `typecheck` scripts
- [x] first tests pinning `lib/derive.ts` behaviour
- [x] stop tracking `finance.db` and `graphify-out/`; gitignore both
- [x] archive stale `REVIEW.md` / `MOVEMENTS_UI_REVIEW.md` → `docs/reviews/`
- [x] `shadcn` → devDependencies; `.nvmrc`
- [x] GitHub Actions CI (typecheck + lint + test + build)
- [ ] Prettier / `format` script (or document its absence)
- [ ] lint-staged pre-commit (optional)
- [x] action integration-test harness (`test/helpers/db.ts` — temp DB + migrations,
  `test/vitest.setup.ts` — `next/cache` no-op mock)

## Phase 1 — Correctness bugs (each gets a failing test first)

- [x] **1.1** ~~enable `PRAGMA foreign_keys = ON`~~ — **false positive**: `@libsql/client`
  enables FKs by default (verified empirically), cascades fire through
  `db.transaction()`. Locked with a tripwire test (`lib/db-foreign-keys.test.ts`).
- [x] **1.2** `mergeMerchants` now repoints `transactions` + `recurring` +
  `budgetLines` + `simulationLines`, and drops `keepId` from `mergeIds` so it can't
  delete the survivor. Integration-tested (`test/actions/merchants.test.ts`).
- [~] **1.10** `importTransactions` (`lib/actions/import.ts`) — move lookups inside
  the txn; create linked instances for `recurringId` rows. **Moved to Phase 2.2**
  (fits the transaction-wrapping work; needs the action integration-test harness).
  *Not* supporting income rows — the wizard is expense-only by design.
- [x] **1.3** `resolvedDayOfMonth` now clamps positive days to the month length
  (`lib/derive.ts`) — a day-31 bill fires on the 30th/28th instead of being skipped
- [x] **1.4 / 1.5** UTC-vs-local date basis — `lib/dates.ts` (local wall-clock basis);
  `lib/derive.ts` (`effectiveAmount`, `thisMonthTransactions`, `isPlannedDate`,
  `monthlyEstimate`, `completeMonthsWindow`, recurring cursor loops, `simulationBalanceProjection`)
  and `lib/recurring-instances.ts` (`currentMonth`, `monthsBetween`) now route through it.
  Shadowing `monthKey` param renamed. **Remaining call sites** (client components,
  `transactions/page.tsx`, `dashboard/page.tsx`, `recurring.ts` actions) are DRY-only,
  tracked under Phase 3.1.
- [x] **1.6** `recurringExpensesByCategory` no longer shows yearly bills as a full
  lump when "+ Yearly" is off — excluded entirely, or folded in amortized when on
- [x] **1.7** `currentBalance` (`lib/derive.ts`) — **no callers** (dead code);
  every live balance calc already inlines its own planned-row filter. Left as-is
  (surgical-changes rule); documented by a test. Delete if still unused at Phase 4.
- [x] **1.8** `splitCents` now rounds to cents before splitting, so `2.999` renders
  `€3,00` not `€2,100` (`lib/derive.ts`). Full float→int fix still tracked in 4.1.
- [x] **1.9** `getExpectedReimbursementAmount` now rounds to the nearest **cent**,
  not the nearest euro (`lib/reimbursement-mapping.ts`); covered by
  `lib/reimbursement-mapping.test.ts`
- [x] **1.11** migration rules added to `AGENTS.md` §5 (data-preserving copy before
  any DROP; hand-write migration + snapshot; backups; FTS out of drizzle)
- [x] **1.12** `transactions_fts` virtual table + 3 triggers dropped
  (`drizzle/0012_drop_transactions_fts.sql`, applied); `transactionsFts` removed
  from `lib/schema.ts`; `drizzle-kit check` clean

## Phase 2 — Server-side validation & data-layer robustness

- [x] **2.1** `lib/schemas.ts` (shared zod primitives + `parse()` helper); every
  action in `lib/actions/*.ts` now parses its input before touching the DB
  (13 files). Throws on invalid → surfaced by `runAction`. **Not** the full
  discriminated-envelope rewrite (return types unchanged) — that's deferred as
  2.1b if a deployed multi-user setup needs field-level errors.
- [~] **2.2** done: `seedZeroCategoryLines` (transactional), `populateSimulationFromInputs`
  (idempotency guard — skips if the sim already has lines), `linkIncomeToClaim` /
  `unlinkAllFromClaim` (transactional, shared `claimIdForMonth` helper),
  `importTransactions` (lookups + inserts + instance-linking in one txn — was 1.10).
  **Remaining:** fold `simulations-client` `handleCreate`'s 3 awaits into one action.
  (No unique index on `simulation_lines` — legit duplicate category lines exist.)
- [~] **2.3** `categories` / `merchants` / `budgets` pages + `applySimulationLineAverage`
  now use SQL aggregates (`lib/queries/category-stats.ts`, `merchant-usage.ts`,
  `month-actuals.ts`) instead of shipping the whole transactions table.
  **Remaining:** `dashboard` (5yr window → server-computed chart series) and
  `simulations/[id]` (all-txns for the drill-down) — bigger client refactors.
- [ ] **2.4** `revalidateTag` per domain + `unstable_cache` on `lib/queries/*` —
  deferred: current `revalidatePath('/', 'layout')` is correct for the single-user
  case; real value is deployed-multi-user perf. Revisit if/when deploying.
- [~] **2.5** `promoteToRecurring` — deferred: the fuzzy ±5-day match is a UX concern,
  not corruption. `updateRecurring` method-overwrite is **not a bug**: the
  transaction sheet locks `method` on recurring-linked rows, so there's nothing
  hand-edited to clobber.

## Phase 3 — DRY / reuse

- [~] **3.1** `lib/dates.ts` created + `lib/derive.ts` / `lib/recurring-instances.ts`
  migrated. **Remaining:** client components + `*/page.tsx` + `lib/actions/recurring.ts`
  still hand-roll `toISOString().slice()` / `padStart` — route through `lib/dates.ts`.
- [ ] **3.2** `useSheetForm` hook + `<AmountField>` / `<KindToggle>` + select-option builders
- [ ] **3.3** `useServerAction()` → `{ run, pending }`; thread `pending` into buttons/SheetShell
- [ ] **3.4** `<IconButton>`, `FernButton tone="outline-sm"`, `<ScrollTopButton>`,
  `useToggleSet()`, `signedFmt`, `paymentMethodIcon`
- [ ] **3.5** data-layer: `sumAmount`, one `factor()`, `isReimbursementCategory`,
  dedupe recurring-amount upsert + payment-method resolution, unify effective-amount pickers
- [ ] **3.6** drop needless `'use client'` (modal, sheet-shell, sim-comparison-chart);
  `useTransactionFilters`; simulation-line context

## Phase 4 — Structural

- [ ] **4.1** money as integer cents (schema migration + all math + format at edge)
- [ ] **4.2** fully derive type layer; zod schemas for `SimulationInputs` / `MonthRules` / `ModuleKey`
- [ ] **4.3** wire up the configurable `currency` setting; one `LOCALE` constant
- [ ] **4.4** startup migration runner; reconcile dialect naming; `DATABASE_URL` env
- [ ] **4.5** decompose `transactions-client` / `reimbursements-client` /
  `simulation-detail-client`; restore `react-hooks/set-state-in-effect` to `error`
- [ ] **4.6** per-route `error.tsx` / `loading.tsx` for `simulations/[id]`;
  `not-found` inside app shell; guard/batch `ensureInstancesUpTo`; log errors
- [ ] **4.7** pick one app name (Fern vs FinAlly)
