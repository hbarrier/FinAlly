import { db } from './db'
import { recurring, recurringInstances } from './schema'
import { nanoid } from './utils'
import { sql, and, eq, inArray } from 'drizzle-orm'
import type { Recurring } from './db-types'
import { monthsBetween } from './dates'
import { monthRulesSchema } from './schemas'
import { resolvedDayOfMonth } from './derive'

export { monthsBetween, currentMonth } from './dates'

function parseMonthRules(raw: string | null) {
  if (!raw) return {}
  try {
    const parsed = monthRulesSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

/** Returns false if the template's monthRules marks this month-of-year as not applicable. */
export function isMonthApplicable(month: string, monthRules: string | null): boolean {
  const rules = parseMonthRules(monthRules)
  const monthNum = parseInt(month.slice(5, 7), 10) // 1-12
  return !rules[String(monthNum)]?.notApplicable
}

/** Returns the amount override for this month-of-year, or null if none. */
export function monthAmountOverride(month: string, monthRules: string | null): number | null {
  const rules = parseMonthRules(monthRules)
  const monthNum = parseInt(month.slice(5, 7), 10)
  return rules[String(monthNum)]?.amount ?? null
}

/** Returns true if the recurring item has an occurrence in the given YYYY-MM. */
function recurringCoversMonth(r: Recurring, month: string): boolean {
  const monthStart = month + '-01'
  const monthEnd = month + '-31' // safe upper bound for string comparison
  if (r.startDate > monthEnd) return false
  if (r.endDate && r.endDate < monthStart) return false
  if (r.cadence === 'yearly') {
    // Only fires in the same calendar month as startDate, each year
    return r.startDate.slice(5, 7) === month.slice(5, 7)
  }
  // monthly fires every month within range, unless the end date falls before
  // this month's actual occurrence day (e.g. dayOfMonth=20 but endDate=the 1st)
  if (r.endDate && r.endDate >= monthStart && r.endDate <= monthEnd) {
    const dom = resolvedDayOfMonth(r.dayOfMonth || 1, new Date(month + '-15'))
    const occurrenceDate = `${month}-${String(dom).padStart(2, '0')}`
    return occurrenceDate <= r.endDate
  }
  return true
}

type DbClient = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db

/**
 * Inserts 'expected' instances for a single recurring item for months in [fromMonth, toMonth]
 * that don't already have an instance. Uses INSERT OR IGNORE so existing rows are untouched.
 */
export async function ensureInstancesForRecurring(
  client: DbClient,
  r: Recurring,
  fromMonth: string,
  toMonth: string,
): Promise<void> {
  const months = monthsBetween(fromMonth, toMonth)
  for (const month of months) {
    if (!recurringCoversMonth(r, month)) continue
    if (!isMonthApplicable(month, r.monthRules)) continue
    await client.run(sql`
      INSERT OR IGNORE INTO recurring_instances (id, recurring_id, month, status, transaction_id)
      VALUES (${nanoid()}, ${r.id}, ${month}, 'expected', NULL)
    `)
  }
}

// Skip the full instance-generation sweep when it already ran for this month in
// this server process — the app layout calls ensureInstancesUpTo on every render.
let lastEnsuredMonth: string | null = null

/** Creates expected instances for all active recurring items up to and including `toMonth`. */
export async function ensureInstancesUpTo(toMonth: string): Promise<void> {
  if (lastEnsuredMonth === toMonth) return
  const items = await db.select().from(recurring)
  await db.transaction(async (tx) => {
    for (const r of items) {
      const fromMonth = r.startDate.slice(0, 7)
      await ensureInstancesForRecurring(tx, r, fromMonth, toMonth)
    }
  })
  lastEnsuredMonth = toMonth
}

/** Upserts an instance to 'linked' status for a given (recurringId, month). */
export async function upsertLinkedInstance(
  client: DbClient,
  recurringId: string,
  month: string,
  transactionId: string,
): Promise<void> {
  await client.run(sql`
    INSERT INTO recurring_instances (id, recurring_id, month, status, transaction_id)
    VALUES (${nanoid()}, ${recurringId}, ${month}, 'linked', ${transactionId})
    ON CONFLICT(recurring_id, month) DO UPDATE SET status = 'linked', transaction_id = excluded.transaction_id
  `)
}

/** Reverts a linked instance back to 'expected' when its transaction is removed. */
export async function revertInstanceToExpected(
  client: DbClient,
  transactionId: string,
): Promise<void> {
  await client.run(sql`
    UPDATE recurring_instances
    SET status = 'expected', transaction_id = NULL
    WHERE transaction_id = ${transactionId}
  `)
}

/**
 * Deletes 'expected' instances that are no longer valid, e.g. after the recurring's
 * endDate was moved earlier than a month that already got an instance created for it.
 * Never touches 'linked' or 'not_applicable' instances.
 */
export async function pruneExpiredInstances(client: DbClient, r: Recurring): Promise<void> {
  const rows = await client
    .select({ id: recurringInstances.id, month: recurringInstances.month })
    .from(recurringInstances)
    .where(and(eq(recurringInstances.recurringId, r.id), eq(recurringInstances.status, 'expected')))
  const staleIds = rows.filter((row) => !recurringCoversMonth(r, row.month)).map((row) => row.id)
  if (staleIds.length > 0) {
    await client.delete(recurringInstances).where(inArray(recurringInstances.id, staleIds))
  }
}

