# FinAlly

Personal finance app for tracking income, expenses, recurring bills, budgets,
goals, and reimbursements.

Local-only — no cloud sync, no subscriptions, no bank connections. All data lives
in a single SQLite file (`finance.db`) on your machine. Built for one user, with a
French/European context first-class (EUR amounts formatted `€1.234,56`, dates
`31/08/2026`, `pension alimentaire` reimbursement model).

## Stack

Next.js 16 (App Router, Server Components + Server Actions) · React 19 ·
TypeScript · SQLite via LibSQL · Drizzle ORM · Tailwind CSS v4 · shadcn/ui + Radix.

## Docs

- [`docs/mission.md`](docs/mission.md) — what FinAlly is and is not
- [`docs/techstack.md`](docs/techstack.md) — architecture patterns and project layout
- [`docs/features.md`](docs/features.md) — feature index (base features + optional modules)
- [`docs/ui.md`](docs/ui.md) — design system reference

## Install

Prerequisites: **Node 24** (see [`.nvmrc`](.nvmrc)) and npm.

```bash
git clone https://github.com/hbarrier/FinAlly.git
cd FinAlly
nvm use            # or otherwise switch to Node 24
npm install
```

### Set up the database

`finance.db` is **not** committed — it holds real data. On a fresh clone it does
not exist yet; the first migration run creates it:

```bash
cp .env.example .env    # optional — defaults are fine for local use
npm run db:migrate      # creates finance.db and applies all migrations
```

`.env` is only needed to point at a hosted (Turso) database instead of the local
file. Leave `DATABASE_URL` unset to use `finance.db` in the project root.

### Run

```bash
npm run dev
```

Open <http://localhost:3000>. On first boot the app:

- seeds `user_settings` and a set of default categories, then
- redirects to a short onboarding form — your name, currency, starting balance,
  and which optional modules to enable (recurring, divorce, budgets, simulations,
  goals). Modules can be toggled later in Settings.

For a production build:

```bash
npm run build
npm run start
```

## Database workflow

Migrations live in `drizzle/` as SQL files plus snapshots. `drizzle/0000_*.sql` is
a squashed baseline (earlier history in `drizzle/_archive/`).

```bash
npm run db:migrate     # apply pending migrations
```

At startup the app warns if `drizzle/` has migrations not yet applied to
`finance.db` — it never auto-applies them.

After editing `lib/schema.ts` (the single source of truth for all tables):

```bash
npm run db:generate    # write a new drizzle/NNNN_*.sql from the schema diff
npm run db:migrate
```

`db:generate` needs a TTY. See [`AGENTS.md`](AGENTS.md) §5 for the migration
rules, including how to hand-write a migration and how to preserve data across
destructive changes. Save-points before risky migrations go in `backups/`
(gitignored).

## Tests

```bash
npm run test        # vitest — runs against a fresh temp SQLite db, never finance.db
npm run typecheck
npm run lint
```

CI runs `typecheck`, `lint`, `test`, and `build` on every push and PR
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
