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

## Phase 1 — Correctness bugs (each gets a failing test first)

- [x] **1.1** ~~enable `PRAGMA foreign_keys = ON`~~ — **false positive**: `@libsql/client`
  enables FKs by default (verified empirically), cascades fire through
  `db.transaction()`. Locked with a tripwire test (`lib/db-foreign-keys.test.ts`).
- ⏸ **1.2** `mergeMerchants` (`lib/actions/merchants.ts`) — repoint `recurring` /
  `budgetLines` / `simulationLines` merchantId too; reject `keepId ∈ mergeIds`
  — *`budgetLines.merchantId` is WIP-only; do the whole fix once WIP lands*
- [~] **1.10** `importTransactions` (`lib/actions/import.ts`) — move lookups inside
  the txn; create linked instances for `recurringId` rows. **Moved to Phase 2.2**
  (fits the transaction-wrapping work; needs the action integration-test harness).
  *Not* supporting income rows — the wizard is expense-only by design.
- [x] **1.3** `resolvedDayOfMonth` now clamps positive days to the month length
  (`lib/derive.ts`) — a day-31 bill fires on the 30th/28th instead of being skipped
- [ ] **1.4 / 1.5** UTC-vs-local date basis — new `lib/dates.ts`, route all callers
  through it (`lib/derive.ts`, `lib/recurring-instances.ts`)
- [x] **1.6** `recurringExpensesByCategory` no longer shows yearly bills as a full
  lump when "+ Yearly" is off — excluded entirely, or folded in amortized when on
- [x] **1.7** `currentBalance` (`lib/derive.ts`) — **no callers** (dead code);
  every live balance calc already inlines its own planned-row filter. Left as-is
  (surgical-changes rule); documented by a test. Delete if still unused at Phase 4.
- ⏸ **1.8** `splitCents` can render `,100` (`lib/derive.ts`) — folds into 4.1
- [x] **1.9** `getExpectedReimbursementAmount` now rounds to the nearest **cent**,
  not the nearest euro (`lib/reimbursement-mapping.ts`); covered by
  `lib/reimbursement-mapping.test.ts`
- ⏸ **1.11** migration data-loss rule → `AGENTS.md`; document hand-written
  migration workflow — *do alongside committing migrations 0008–0011*
- ⏸ **1.12** drop unused `transactions_fts` virtual table + triggers + schema decl
  (needs a migration) — *blocked on WIP / migration chain*

> **Blocked items** wait until the in-progress feature work (budget lines,
> category `isActive`, sim `amountManual`) and migrations `0008–0011` are committed
> and applied, so new schema/derive changes don't tangle with that diff.

## Phase 2 — Server-side validation & data-layer robustness

- [ ] **2.1** `defineAction(schema, handler)` wrapper + `lib/schemas/` shared with sheets;
  standardise return envelope + missing-row handling
- [ ] **2.2** transaction-wrap + idempotency: `seedZeroCategoryLines` (+ unique index),
  `populateSimulationFromInputs`, `linkIncomeToClaim` / `unlinkAllFromClaim`,
  `simulations-client` `handleCreate`, **`importTransactions`** (lookups inside txn +
  link recurring instances — was 1.10)
- [ ] **2.3** push per-page full-table scans into SQL aggregates (`dashboard`,
  `categories`, `merchants`, `budgets`, `simulations/[id]`, `applySimulationLineAverage`)
- [ ] **2.4** `revalidateTag` per domain + `unstable_cache` on `lib/queries/*`
- [ ] **2.5** scope `updateRecurring` method propagation to "from date X"; make
  `promoteToRecurring` return matches for confirmation

## Phase 3 — DRY / reuse

- [ ] **3.1** `lib/dates.ts` single date module (also the 1.4/1.5 mechanism)
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
