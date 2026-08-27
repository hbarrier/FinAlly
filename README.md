# Fern

Personal finance app for tracking income, expenses, recurring bills, budgets, goals, and reimbursements.

Local-only — no cloud sync, no subscriptions. The database is a SQLite file (`finance.db`) on your machine.

## Docs

- [`docs/mission.md`](docs/mission.md) — what Fern is and what it is not
- [`docs/techstack.md`](docs/techstack.md) — stack, architecture patterns, project layout
- [`docs/features.md`](docs/features.md) — feature index with links to per-feature detail
- [`docs/ui.md`](docs/ui.md) — Fern design system reference

## Dev

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). First run walks through a
short setup (name, currency, starting balance, modules).

## Database

`finance.db` is a SQLite file. To create or update it, run the Drizzle pipeline
after any change to `lib/schema.ts`:

```bash
npm run db:generate   # writes a new drizzle/NNNN_*.sql from the schema diff
npm run db:migrate    # applies pending migrations
```

`drizzle/0000_*.sql` is a squashed baseline (April–Aug 2025 history is in
`drizzle/_archive/`). One hand edit lives in the baseline: the `transactions_fts`
FTS5 virtual table and its triggers, which Drizzle cannot model.
