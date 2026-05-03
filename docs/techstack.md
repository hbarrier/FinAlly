# Tech Stack & Dev Principles

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js (App Router) | Server Components + Server Actions for all data mutations |
| Language | TypeScript 5 | Strict mode throughout |
| UI runtime | React 19 | Client components for interactivity only |
| Database | SQLite via LibSQL | Local file `finance.db`; uses `@libsql/client` with `drizzle-orm/libsql` |
| ORM | Drizzle ORM | Schema-first; migrations in `drizzle/` |
| UI components | shadcn/ui + Radix UI | Base primitives + Fern-specific components in `components/fern/` |
| Styling | Tailwind CSS v4 | Token-driven Fern theme in `app/globals.css` + utility usage as needed |
| Forms | React Hook Form + Zod | Validation schema co-located with form |
| Icons | Lucide React | Wrapped in `<Icon>` component |
| Fonts | Google fonts via `next/font` | Inter (body), Instrument Serif (display), JetBrains Mono (numbers) |

## Architecture patterns

### Server vs. client split
Pages are Server Components that fetch data directly from the DB and pass it as props to a `*-client.tsx` file. All interactive state (filters, open sheets, selections) lives in the client component. Mutations happen via Server Actions in `lib/actions/`.

### Server Actions
Every write operation is a named async function exported from `lib/actions/*.ts`. Each action ends with `revalidateApp()` (`revalidatePath('/', 'layout')`) to trigger a full data refresh. No optimistic updates.

### Pure derivation layer
`lib/derive.ts` contains pure functions for all computed values — monthly sums, recurring occurrence dates, effective amounts, balance. These have no DB access and can run in both server and client contexts.

### Schema-driven data model
`lib/schema.ts` is the single source of truth for all table structures, relations, and enums. Drizzle migrations live in `drizzle/`.

### Opening balances
The dashboard uses `monthly_opening_balances` for explicit per-month openings with a derived fallback from the latest prior opening (or `userSettings.startingBalance` if none exist).

### Sheets for CRUD
All create/edit/delete operations happen inside sheet (slide-over) components in `components/fern/sheets/`. Each sheet owns its form state and calls the relevant server action on submit.

## Dev principles

- **No external state management.** Server Components own data; client components own UI state only.
- **No mock data in tests.** Integration tests hit the real DB.
- **Don't invent abstractions prematurely.** Three similar lines of code beat a premature helper.
- **Security at boundaries only.** Validate user input via Zod at the action layer; trust internal data.
- **This Next.js version has breaking changes.** Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`.

## Project layout

```
app/
  (app)/          # All authenticated routes (layout, sidebar nav)
    dashboard/
    transactions/
    recurring/
    categories/
    merchants/
    budgets/
    goals/
    reimbursements/
components/
  fern/           # App-specific UI components
    sheets/       # CRUD sheet modals
    ui/           # Shared primitives (shadcn-based)
lib/
  schema.ts             # Drizzle table definitions
  derive.ts             # Pure computation helpers
  db.ts                 # DB client singleton
  db-types.ts           # TypeScript types derived from the schema
  payment-method.ts     # PaymentMethod enum, labels, defaults
  recurring-amounts.ts  # Amount versioning helpers (pick/upsert/sync)
  reimbursement-mapping.ts  # Allocation + status logic
  actions/              # Server Actions (one file per domain)
  queries/              # Reusable cached read queries
    opening-balance.ts          # Month opening balance (explicit or derived)
    reimbursement-allocations.ts  # Index allocations by tx id
    transactions-search.ts      # FTS5 full-text search over transactions
    transactions-summary.ts     # Paginated movements + year/facet aggregates
drizzle/          # Migration SQL + snapshots
finance.db        # Local SQLite database
```
