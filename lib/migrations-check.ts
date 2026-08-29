import { readFileSync } from 'fs'
import { join } from 'path'
import { sql } from 'drizzle-orm'
import { db } from './db'

type Journal = { entries: { tag: string }[] }

/**
 * Warns (loudly) at startup when `drizzle/` has migrations that haven't been
 * applied to `finance.db` — the usual cause of confusing runtime errors after
 * pulling a schema change. Does not auto-apply: destructive migrations should be
 * run deliberately with `npm run db:migrate` (see AGENTS.md §5).
 */
export async function checkPendingMigrations(): Promise<void> {
  let journal: Journal
  try {
    journal = JSON.parse(
      readFileSync(join(process.cwd(), 'drizzle', 'meta', '_journal.json'), 'utf8'),
    )
  } catch {
    return
  }

  let appliedCount = 0
  try {
    const [row] = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM __drizzle_migrations`)
    appliedCount = Number(row?.n ?? 0)
  } catch {
    // table absent = nothing applied yet
  }

  const pending = journal.entries.length - appliedCount
  if (pending > 0) {
    console.warn(
      `\n  ⚠  ${pending} pending database migration${pending === 1 ? '' : 's'}. ` +
        `Run \`npm run db:migrate\`.\n`,
    )
  }
}
