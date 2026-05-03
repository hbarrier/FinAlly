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

Open [http://localhost:3000](http://localhost:3000).

Run migrations with `npx drizzle-kit migrate` after schema changes.
