/**
 * Pure computation helpers — ported from the Fern prototype's state.jsx.
 * Usable on server and client.
 */

export type {
  Category,
  Transaction,
  Recurring,
  RecurringAmount,
  RecurringWithAmounts,
} from './db-types'
import type {
  Category,
  Transaction,
  Recurring,
  RecurringAmount,
} from './db-types'

export function effectiveAmount(amounts: RecurringAmount[], date: Date = new Date()): number {
  if (amounts.length === 0) return 0
  const dateStr = date.toISOString().slice(0, 10)
  const sorted = [...amounts].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const past = sorted.filter((a) => a.startDate <= dateStr)
  return past.length > 0 ? past[past.length - 1].amount : sorted[0].amount
}

// ---- date helpers ----

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

export function thisMonthTransactions<T extends { date: string }>(
  txns: T[],
  ref: Date = new Date(),
): T[] {
  const key = ref.toISOString().slice(0, 7)
  return txns.filter((t) => monthKey(t.date) === key)
}

export function sumByKind(txns: Transaction[], kind: 'expense' | 'income') {
  return txns
    .filter((t) => t.kind === kind)
    .reduce((s, t) => s + Number(t.amount || 0), 0)
}

export function spendingByCategory(
  txns: Transaction[],
  cats: Category[],
): { id: string; amount: number; name: string; color: string; icon: string }[] {
  const map: Record<string, number> = {}
  txns
    .filter((t) => t.kind === 'expense')
    .forEach((t) => {
      if (!t.categoryId) return
      map[t.categoryId] = (map[t.categoryId] || 0) + Number(t.amount || 0)
    })
  return Object.entries(map)
    .map(([id, amount]) => {
      const c = cats.find((x) => x.id === id)
      return {
        id,
        amount,
        name: c?.name || 'Uncategorized',
        color: c?.color || 'teal',
        icon: c?.icon || 'tag',
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

// ---- recurring ----

function matchesCadence(d: Date, r: Recurring): boolean {
  const dow = d.getDay()
  const dom = d.getDate()
  if (r.cadence === 'monthly') return dom === (r.dayOfMonth || 1)
  if (r.cadence === 'weekly') return dow === (r.dayOfWeek ?? 1)
  if (r.cadence === 'yearly') {
    const s = new Date(r.startDate)
    return d.getMonth() === s.getMonth() && d.getDate() === s.getDate()
  }
  return false
}

type UpcomingItem = Recurring & { date: Date }

/**
 * Returns all occurrences of recurring items within the current calendar month,
 * including past occurrences (e.g. a monthly bill that started on the 1st when
 * today is the 19th will still appear).
 */
export function thisMonthRecurring(
  items: Recurring[],
  ref: Date = new Date(),
): UpcomingItem[] {
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0) // last day of month

  const out: UpcomingItem[] = []

  items.forEach((r) => {
    const itemStart = r.startDate ? new Date(r.startDate) : monthStart
    const itemEnd = r.endDate ? new Date(r.endDate) : monthEnd

    const effectiveStart = new Date(Math.max(monthStart.getTime(), itemStart.getTime()))
    const effectiveEnd = new Date(Math.min(monthEnd.getTime(), itemEnd.getTime()))

    if (effectiveStart > effectiveEnd) return

    const cursor = new Date(effectiveStart)
    while (cursor <= effectiveEnd) {
      if (matchesCadence(cursor, r)) {
        out.push({ ...r, date: new Date(cursor) })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  })

  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function allOccurrencesInRange(
  items: Recurring[],
  from: Date,
  to: Date,
): (Recurring & { date: Date })[] {
  const out: (Recurring & { date: Date })[] = []
  items.forEach((r) => {
    const itemStart = new Date(r.startDate)
    const itemEnd = r.endDate ? new Date(r.endDate) : to
    const effectiveStart = new Date(Math.max(from.getTime(), itemStart.getTime()))
    const effectiveEnd = new Date(Math.min(to.getTime(), itemEnd.getTime()))
    if (effectiveStart > effectiveEnd) return
    const cursor = new Date(effectiveStart)
    while (cursor <= effectiveEnd) {
      if (matchesCadence(cursor, r)) {
        out.push({ ...r, date: new Date(cursor) })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  })
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function monthlyEstimate(r: Recurring): number {
  const a = Number(r.amount || 0)
  if (r.cadence === 'monthly') return a
  if (r.cadence === 'weekly') return a * 4.33
  if (r.cadence === 'yearly') return a / 12
  return a
}

// ---- select helpers ----

export function buildCategorySelectOptions(
  cats: Category[],
): { value: string; label: string; group: string }[] {
  return [
    ...cats
      .filter((c) => c.kind === 'expense')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name, group: 'Expenses' })),
    ...cats
      .filter((c) => c.kind === 'income')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name, group: 'Income' })),
  ]
}

// ---- formatting ----

export function formatDate(
  iso: string,
  locale: string = 'fr-FR',
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  return new Date(iso).toLocaleDateString(locale, opts)
}

export function fmt(amt: number | string, opts: { noSymbol?: boolean } = {}): string {
  const n = Number(amt || 0)
  const abs = Math.abs(n)
  const s = abs.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return (n < 0 ? '−' : '') + (opts.noSymbol ? s : '€' + s)
}

export function fmtShort(amt: number | string): string {
  const n = Math.abs(Number(amt || 0))
  if (n >= 1000) return '€' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k'
  return '€' + n.toFixed(0)
}

export function splitCents(amt: number | string) {
  const n = Math.abs(Number(amt || 0))
  const whole = Math.floor(n)
  const cents = Math.round((n - whole) * 100)
  return {
    sign: Number(amt) < 0 ? '−' : '',
    whole: whole.toLocaleString('de-DE'),
    cents: String(cents).padStart(2, '0'),
  }
}

// ---- balance ----

export function currentBalance(
  startingBalance: number,
  txns: Transaction[],
): number {
  return (
    startingBalance +
    txns.reduce(
      (s, t) => s + (t.kind === 'income' ? 1 : -1) * Number(t.amount || 0),
      0,
    )
  )
}
