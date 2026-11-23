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

Open <http://localhost:3737>. On first boot the app:

- seeds `user_settings` and a set of default categories, then
- redirects to a short onboarding form — your name, currency, starting balance,
  and which optional modules to enable (recurring, divorce, budgets, simulations,
  goals). Modules can be toggled later in Settings.

For a production build:

```bash
npm run build
npm run start
```

### Run as a Mac app (optional)

The app is a PWA, so it can be installed as a standalone app with its own window
and Dock icon. The app only works while the server runs, so first set up the
background server, then install the app.

**1. Keep the server running.** A launchd job runs the production server on
port 3737 from login onwards and restarts it if it stops:

```bash
npm run build
sed "s|__REPO__|$PWD|g" launchd/com.finances.app.plist \
  > ~/Library/LaunchAgents/com.finances.app.plist
launchctl load -w ~/Library/LaunchAgents/com.finances.app.plist
```

Logs go to `.next/app.log`.

To update to a new version, pull the code, install dependencies, apply any new
migrations (a backup of `finance.db` is taken first), then rebuild and restart:

```bash
git pull
npm install
npm run db:migrate
npm run build && launchctl kickstart -k gui/$(id -u)/com.finances.app
```

After editing the code locally, only the last line is needed. The installed app
picks up the new version on its next reload (Cmd+R); there is nothing to
reinstall.

`npm run dev` needs port 3737 too, so stop the job before developing. To stop
the server and turn auto-start off (run the `load` command above to turn it back
on):

```bash
launchctl unload -w ~/Library/LaunchAgents/com.finances.app.plist
```

**2. Install the app.** Open <http://localhost:3737>, then either:

- Chrome: click the install icon at the right of the address bar (or menu >
  Cast, save and share > Install page as app).
- Safari: File > Add to Dock.

**3. Add it to the Dock.** Safari adds it to the Dock for you. For Chrome, open
the app, right-click its Dock icon, and choose Options > Keep in Dock. It is also
in Launchpad and Spotlight under "FinAlly".

**4. Uninstall.**

- Chrome: in the app window, open the menu (top right) > Uninstall FinAlly.
- Safari: drag FinAlly from `~/Applications` to the Bin.
- Remove the Dock icon by dragging it off the Dock.
- Remove the background server as well:

  ```bash
  launchctl unload -w ~/Library/LaunchAgents/com.finances.app.plist
  rm ~/Library/LaunchAgents/com.finances.app.plist
  ```

Uninstalling the app never touches your data, which stays in `finance.db`.

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

## Backups

`finance.db` is the only copy of real data. `scripts/backup-db.sh` writes a
compacted, integrity-checked snapshot to `backups/finance.db.auto-<timestamp>`
(via `VACUUM INTO`, safe while the app is running). It refuses to snapshot a
missing, truncated, or corrupt file, skips writing when nothing changed, and
keeps the newest 14 `auto-` snapshots (hand-made `pre*` save-points are never
pruned).

```bash
npm run db:backup      # snapshot now
```

`npm run db:migrate` takes a snapshot first automatically (`predb:migrate`).

For an unattended daily snapshot, install the launchd job (runs at 12:30 and on
login):

```bash
sed "s|__REPO__|$PWD|g" launchd/com.finances.db-backup.plist \
  > ~/Library/LaunchAgents/com.finances.db-backup.plist
launchctl load -w ~/Library/LaunchAgents/com.finances.db-backup.plist
```

## Tests

```bash
npm run test        # vitest — runs against a fresh temp SQLite db, never finance.db
npm run typecheck
npm run lint
```

CI runs `typecheck`, `lint`, `test`, and `build` on every push and PR
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
