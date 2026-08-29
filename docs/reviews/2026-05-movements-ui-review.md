# Movements UI — State Assessment & Recommendations

## Architecture Overview

The page has three views selected via a segmented control and the `?view=` param:

| View | Data loading | Filter scope |
|---|---|---|
| **Timeline** | Server: last N months (default 2) | Client-side on loaded data |
| **Summary** | Server: full year aggregates | Server-side via URL params |
| **Search** | Server: full-year FTS | Server-side via URL params |

Filters in each view are completely independent and do not carry over between views.

---

## Issues — Timeline View

### P0 · Filters are silently scoped to loaded months

The `txns` array only contains the months currently loaded (default: 2). Every client-side filter — merchant, category, kind, cleared, reimbursement, text — operates on this partial dataset.

**Effect:** if you pick a merchant or category, you see at most 2 months of results. There is no way to see all of a merchant's transactions for the year from this view. This is the primary broken use case.

**Evidence:** `transactions-client.tsx:248` — `filtered` useMemo runs over `[...txns, ...virtualEntries]`, where `txns` only covers `timelineFrom`–`timelineTo` (`page.tsx:61–62`).

### P1 · Text search ignores merchant names

The inline `q` filter only searches `note` and `category name` (`transactions-client.tsx:284–288`). Searching "Amazon" finds nothing if the note is blank — even though the merchant name is right there.

```ts
// hay only contains note + cat name
const hay = `${t.note ?? ''} ${cat?.name ?? ''}`.toLowerCase()
```

### P1 · Merchant filter silently drops all virtual/scheduled entries

When any merchant filter is active, every virtual (scheduled) entry is discarded without explanation (`transactions-client.tsx:255–256`). A recurring entry for that merchant disappears.

### P1 · "X of Y" counter is misleading

The header shows e.g. `"12 of 87"` — but `87` is the count for the loaded 2-month window, not the full year. The user cannot tell how many matching entries exist in the remaining months.

### P2 · Year picker resets view to timeline

Clicking a different year always navigates to `?year=X` with no `view` param, landing on timeline and losing the active view (`transactions-client.tsx:603`).

### P2 · Reimbursement filter has 9 options in a plain `<select>`

Most of the 9 options apply only to specific sub-populations (reimbursable expenses or reimbursement income). Selecting them with no matching data silently shows empty. There is no indication of whether the current year has any such transactions.

---

## Issues — Summary View

### P1 · Drill-down is the only path to "full year for a vendor/category" — but it is hidden

The summary drill-down (`summaryDrilldown`) loads full-year transactions for a selected merchant or category server-side. This is the right data, but:
- It requires switching to Summary view first
- The drill-down panel appears below the charts with no clear heading that links back to the selection
- There is no total shown (sum, count) before the list
- Clicking a year from the year-picker clears the drill-down (no `merchant`/`category` in `?year=X`)

### P2 · Summary top lists are capped at 20 and show only expense amounts

Both `getYearTotalsByMerchant` and `getYearTotalsByCategory` are hardcoded to `limit 20` and the UI only renders `−{expense}`. Income transactions attributed to a merchant are invisible, and beyond-top-20 merchants are inaccessible.

### P2 · No total row in monthly net table

The summary shows per-month net but no year total, making it impossible to see the annual balance at a glance.

---

## Issues — Search View

### P2 · Search is scoped to the selected year

The placeholder says "Search matches transaction notes across the full year" — but "full year" means only `selectedYear`, which defaults to the current year. Prior-year results require manually switching the year first.

### P2 · Search only matches notes (FTS index scope unclear)

The FTS join is on `transactionsFts` (`transactions-search.ts:63`), which presumably indexes note text. Merchant names and category names are not searchable. The placeholder "Search notes…" is technically accurate but the user may expect broader matching.

### P2 · No year-crossing search

There is no way to search "all time" — each search is constrained to `?year=X`.

---

## Issues — Performance

### P3 · Reimbursable expenses loaded on every page visit

`page.tsx:82–86` fetches all reimbursable expenses with no limit, regardless of `selectedView`. This data is only used to populate the `ReimbursementMappingSheet`, which only opens from Timeline. It should be deferred or lazy-loaded.

### P3 · Timeline "load more" re-fetches entire history

Each "load more" click increments `months`, triggering a full server re-render that re-fetches all months from scratch (`timelineFrom`–`timelineTo`). A proper cursor-based approach would fetch only the next page.

### P3 · Cursor encoding duplicated

`encodeCursor` / `decodeCursor` are copy-pasted identically in `transactions-search.ts` and `transactions-summary.ts`. Minor but worth extracting.

---

## Recommendations — Prioritized

### R1 (P0) — Make merchant/category filters server-side for full-year results

When a merchant or category filter is active, redirect to server-side data (same mechanism as `summaryDrilldown`) instead of filtering the client array. This gives the user the full year without loading all months upfront.

Concretely: when `merchantFilter` or `catFilter` is set and non-`all`, navigate to `?view=summary&merchant=X&year=Y` (or a dedicated filtered timeline URL). The server already has the machinery (`getMovementsPage` with `merchantId`/`categoryId`).

Alternatively, unify by exposing `getMovementsPage` for the timeline view too, making all year-scoped facet filtering server-side.

### R2 (P1) — Add merchant name to timeline text search

One-line fix in `transactions-client.tsx:286`:

```ts
const hay = `${t.note ?? ''} ${cat?.name ?? ''} ${merchant?.name ?? ''}`.toLowerCase()
```

### R3 (P1) — Show virtual entries under merchant filter or explain why they're hidden

Either include virtual entries whose `merchantId` matches the filter, or show a note explaining scheduled entries are not filtered by merchant.

### R4 (P1) — Fix "X of Y" to reflect full year or clarify scope

The Y figure should either reflect the true year total (via a count query) or the label should say "in view" / "in loaded months" so the user understands the scope.

### R5 (P2) — Cross-link Summary drill-down from Timeline filters

Add a "View full year →" action when a merchant or category filter is active in Timeline. This bridges the two views without forcing the user to discover Summary.

### R6 (P2) — Preserve year and view on year-picker navigation

When clicking a year, keep the current view:

```ts
onClick={() => {
  const params = new URLSearchParams(window.location.search)
  params.set('year', y)
  router.push(`?${params.toString()}`)
}}
```

### R7 (P2) — Replace reimbursement `<select>` with a cleaner filter

Collapse to 3 options visible by default (All / Has open work / Fully resolved) with an optional expanded mode showing the granular states. Hide the filter entirely when the year has no reimbursable transactions.

### R8 (P3) — Defer reimbursable expense loading

Only fetch `reimbursableExpenses` when `selectedView === 'timeline'` (already the only place it is used). This removes an unbounded query from Summary and Search page loads.

### R9 (P3) — Replace timeline "load more" with proper cursor pagination

Instead of widening `timelineFrom`, pass the last loaded transaction's cursor and append results. The infrastructure is already built in `getMovementsPage`.

---

## Summary Table

| ID | Severity | Area | Impact |
|---|---|---|---|
| R1 | P0 | Timeline | Merchant/category → full year broken |
| R2 | P1 | Timeline | Text search misses merchant names |
| R3 | P1 | Timeline | Virtual entries silently disappear |
| R4 | P1 | Timeline | Counter is misleading |
| R5 | P2 | Cross-view | No link from filters to full-year view |
| R6 | P2 | Year picker | Year change loses current view |
| R7 | P2 | Timeline | Reimbursement filter too complex |
| R8 | P3 | Performance | Unnecessary query on all page loads |
| R9 | P3 | Performance | Load-more re-fetches entire history |
