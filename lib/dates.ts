/**
 * Calendar-date helpers. One basis throughout: the **local wall-clock day**.
 *
 * Transaction dates are stored as `'YYYY-MM-DD'` strings and mean a calendar day,
 * not an instant. "Today" / "this month" therefore follow the user's local clock,
 * not UTC — mixing the two (`toISOString().slice(...)` vs `getFullYear()/getMonth()`)
 * is what caused month-boundary / midnight off-by-ones.
 *
 * All functions are pure and safe on server and client.
 */

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Local calendar day as `'YYYY-MM-DD'`. */
export function todayISO(ref: Date = new Date()): string {
  return `${ref.getFullYear()}-${pad2(ref.getMonth() + 1)}-${pad2(ref.getDate())}`
}

/** Local calendar month as `'YYYY-MM'`. */
export function currentMonth(ref: Date = new Date()): string {
  return `${ref.getFullYear()}-${pad2(ref.getMonth() + 1)}`
}

/** The `'YYYY-MM'` an ISO date string falls in (plain slice — no timezone math). */
export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

/** Parse `'YYYY-MM-DD'` (or a longer ISO string) to a Date at **local** midnight. */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** `'YYYY-MM'` shifted by `n` months (negative = earlier). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const base = new Date(y, m - 1 + n, 1)
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}`
}

/** First day of a `'YYYY-MM'` as `'YYYY-MM-01'`. */
export function firstDayOfMonth(month: string): string {
  return `${month}-01`
}

/** Last day of a `'YYYY-MM'` as `'YYYY-MM-DD'`, respecting month length. */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${pad2(new Date(y, m, 0).getDate())}`
}

/** Inclusive list of `'YYYY-MM'` from `from` to `to`. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let cursor = from
  while (cursor <= to) {
    out.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return out
}

/**
 * The `periodMonths` complete calendar months immediately before the current
 * month: `{ start: first day of the earliest, endExclusive: first day of this month }`.
 */
export function completeMonthsWindow(
  periodMonths: number,
  ref: Date = new Date(),
): { start: string; endExclusive: string } {
  const thisMonth = currentMonth(ref)
  return {
    start: firstDayOfMonth(addMonths(thisMonth, -periodMonths)),
    endExclusive: firstDayOfMonth(thisMonth),
  }
}
