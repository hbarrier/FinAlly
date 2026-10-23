# Codebase Review — 2026-09-30

_Generated: 2026-09-30_

Status key: `[x]` done · `[~]` in progress · `[ ]` todo · `⏸` blocked/deferred

## Context

The previous full review (2026-08-29, `docs/improvement-plan.md`) is mostly done
and merged into `main` (Phases 0–4: 143 vitest tests pass, `tsc --noEmit`
clean, `npm run lint` reports 0 errors). Since then the app grew by **27,910
lines across 132 files** — a new Groups (bill-splitting) module, a Saving
Accounts module (plus a later, unplanned `interest` transaction kind), a
DB-backed i18n/language-admin system, a monthly/yearly budget-split rewrite,
and a running balance on the transactions page.

This review covers that new surface plus a spot-check of what the previous
plan left open. Work items are numbered so progress can be checked off and
annotated in place, the same way `docs/improvement-plan.md` tracks its phases.
Each item gets a one-line **Progress:** note appended (with date + commit)
once picked up — don't delete the original finding, append below it.

---

## P0 — Correctness & safety net

- [ ] **1. `addTransaction`'s `saving`/`interest` branches aren't
  transactional** (`lib/actions/transactions.ts:66-103`). The overdraw-balance
  check and the insert run as two separate statements; the plain
  expense/income branch two lines below (line 118) *does* wrap its insert in
  `db.transaction()`. Breaks the project's own convention and leaves a TOCTOU
  gap on the overdraw guard. Fix: wrap the saving/interest branch in
  `db.transaction()` the same way.
  - Progress:

- [ ] **2. CI was deleted** (`f82d6aa`, "Delete .github/workflows/ci.yml")
  after Phase 0 of the previous review explicitly added it as the safety net
  for this test suite. Tests are green and fast (143 tests, ~1s) — restore a
  typecheck+lint+test(+build) workflow so regressions surface automatically
  again.
  - Progress:

## P1 — Test gaps & logic duplication on new features

- [ ] **3. `kind='interest'` has zero action-level test coverage**
  (`test/actions/saving-accounts.test.ts`). Only the pure balance-math
  (`lib/derive.test.ts`) is covered. Add tests for `addTransaction({kind:
  'interest', ...})`, `updateInterest`, and `resolveInterestTarget` — invalid
  destination, category forcing, amount validation.
  - Progress:

- [ ] **4. Credit-signing / "interest has no source" logic is duplicated
  three times**: `lib/derive.ts:1287-1325` (`creditSignedAmount`,
  `savingAccountBalance`), and independently in
  `lib/queries/saving-accounts.ts:27,69` (SQL). All three currently agree, but
  there's no single source of truth — a future kind or column change has to be
  caught in three places. At minimum, add a test that pins the JS and SQL
  paths against the same fixtures so drift fails loudly.
  - Progress:

- [ ] **5. Recurring saving transfers don't generate ghost rows or
  auto-link instances** — this is `docs/issues/saving-accounts.md`'s own
  documented "deferred to a follow-up" item and is still true today
  (`instanceEntries` in `transactions-client.tsx` filters saving recurrences
  out). A real functional gap (a recurring saving transfer silently never
  shows as planned/upcoming), not just polish.
  - Progress:

## P2 — Consistency / DRY

- [ ] **6. `group-entry-sheet.tsx` and `group-allocation-sheet.tsx` hand-roll
  `useState`/`useEffect` form state** instead of `useSheetForm`, while sibling
  sheets in the same Groups feature (`group-sheet.tsx`,
  `group-member-sheet.tsx`) already use it. Quick, low-risk migration since
  the pattern is proven next door.
  - Progress:

- [ ] **7. `react-hooks/set-state-in-effect` violations are spreading, not
  shrinking.** The rule was downgraded to `warn` in `eslint.config.mjs` for
  two legacy mega-components (tracked as Phase 4.5 in the previous review).
  Two *new*, small sheets now trip it too: `group-share-schedule-sheet.tsx:32`
  and `simulation-line-sheet.tsx:115`. These are cheap effect-to-event-handler
  fixes (unlike the mega-components) — fix them now so the warning doesn't
  become permanent cover for new violations.
  - Progress:

- [ ] **8. Duplicated float-epsilon magic number**: `groups.ts:319` compares
  `overrideTotal > data.amount + 0.005` and `group-entry-sheet.tsx:109` uses
  the same literal, while the file already has a named `SHARE_EPSILON` for
  percentages (`groups.ts:33`). Extract a named `AMOUNT_EPSILON`-style
  constant for the money comparison.
  - Progress:

- [ ] **9. New balance feature uses raw date slicing**:
  `transactions-client.tsx:477` does `t.date.slice(0, 7)` instead of
  `monthOf()` from `lib/dates.ts`, inconsistent with the module built
  specifically to centralize this (Phase 1.4/1.5 of the previous review).
  Same file, one-line fix.
  - Progress:

## P3 — Documentation / process hygiene

- [ ] **10. `docs/issues/saving-accounts.md` is stale**: header says "Status —
  implemented. All 7 phases landed" with no mention of the `interest` kind
  added afterward in schema, actions, queries, and UI. Update it (or close it
  and fold the interest kind + the still-open recurring-ghost-row gap into a
  short new issue doc).
  - Progress:

- [ ] **11. No `docs/features/groups.md`** — every other feature/module has a
  page under `docs/features/`; Groups is the only one missing one.
  - Progress:

- [ ] **12. "divorce" naming vs. "reimbursements" feature**: the module
  flag/id is `divorce` (`lib/settings-options.ts`, `user_settings.module_divorce`,
  `requireModule('divorce')`) while every variable it gates is named
  `divorceEnabled`, and it controls the *reimbursements* feature — unrelated
  to the new `groups` (bill-splitting) module despite the superficial
  "splitting money between people" similarity. Not a bug (confirmed no shared
  code/tables), but worth a rename or a clarifying comment at the module-key
  definition so a future session doesn't assume they're related.
  - Progress:

- [ ] **13. Confirm intent**: the new "Total saved"/"Overspent" figures on the
  transactions page are a *period net* (income − expense for the visible
  months), not a true running/opening account balance — they don't route
  through `currentBalance()` or `lib/queries/opening-balance.ts`. If that's
  intentional, fine; if the label implies a running balance to the user,
  either re-label or recompute.
  - Progress:

- [ ] **14. i18n covers ~207 keys with full en/fr parity (verified, no
  drift)**, but large swaths of client components still hardcode English text
  (dashboard, budgets, simulation-detail, transaction-filters, groups-detail,
  goals, recurring clients). Matches the "Phase 2 in progress" status already
  tracked in memory — just confirming the remaining surface is still large.
  - Progress:

## Carry-forward (already tracked in `docs/improvement-plan.md`, still valid)

- ⏸ **4.1 Money as integer cents** — deferred by explicit prior decision; the
  scope has grown since (saving accounts + interest add more float columns).
  Revisit before multi-user deployment.
- [ ] **4.3** Wire up the configurable `currency` setting (rides with 4.1).
- [ ] **4.5** Decompose `transactions-client.tsx` (now larger, with the new
  balance feature), `reimbursements-client.tsx`, `simulation-detail-client.tsx`.
- [ ] **4.7** Pick one app name — `docs/features.md` already uses "FinAlly"
  consistently, so this may be de facto decided; worth a quick confirmation
  with the user to close the item out.
- [ ] **Phase 0 leftovers**: Prettier/format script, lint-staged pre-commit —
  still absent.
- [ ] **3.6**: drop needless `'use client'`, `useTransactionFilters`,
  simulation-line context — untouched since last review.

---

## Verification

- `npm test` — 143 tests must stay green; new tests added for item 3 should
  fail before any fix they pin, then pass.
- `npm run typecheck` and `npm run lint` clean (currently: 0 errors, 15
  `warn`-level items — item 7 should reduce that count).
- Item 1 and item 5: exercise manually via the `/accounts` and `/recurring`
  UI (create a saving transfer that would overdraw; create a recurring saving
  transfer and check it never appears as a planned/ghost row today).
- Item 2 (restored CI): confirm the workflow runs on a throwaway branch/PR
  before relying on it.
