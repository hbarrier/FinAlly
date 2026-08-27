/**
 * Pure computation helpers — ported from the Fern prototype's state.jsx.
 * Usable on server and client.
 */

export type {
  Category,
  Transaction,
  Recurring,
  RecurringAmount,
  RecurringInstance,
  RecurringWithAmounts,
  SimulationLine,
} from './db-types'
import type {
  Category,
  Transaction,
  Recurring,
  RecurringAmount,
  RecurringInstance,
  SimulationLine,
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

/** The `periodMonths` complete calendar months immediately before the current month. */
export function completeMonthsWindow(
  periodMonths: number,
  ref: Date = new Date(),
): { start: string; endExclusive: string } {
  const firstOfMonth = (monthsAgo: number) => {
    const d = new Date(ref.getFullYear(), ref.getMonth() - monthsAgo, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }
  return { start: firstOfMonth(periodMonths), endExclusive: firstOfMonth(0) }
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
  const catById = new Map(cats.map((c) => [c.id, c]))
  return Object.entries(map)
    .map(([id, amount]) => {
      const c = catById.get(id)
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

export interface RecurringCategoryItem {
  id: string // recurring_instances.id, or `${recurringId}-amortized`
  name: string // recurring template name
  amount: number
  tier: 'cleared' | 'amortized' | 'pending'
  date: string | null // linked transaction's date; null for pending or amortized rows
}

export interface RecurringCategoryGroup {
  id: string // categoryId, or 'uncategorized'
  name: string
  color: string
  icon: string
  total: number
  cleared: number
  amortized: number
  items: RecurringCategoryItem[] // sorted: cleared+amortized (date asc, nulls last) then pending (date asc)
}

function getOrCreateGroup(
  groups: Map<string, RecurringCategoryGroup>,
  categoryId: string | null,
  catById: Map<string, Category>,
): RecurringCategoryGroup {
  const catId = categoryId || 'uncategorized'
  let group = groups.get(catId)
  if (!group) {
    const c = catId !== 'uncategorized' ? catById.get(catId) : undefined
    group = {
      id: catId,
      name: c?.name || 'Uncategorized',
      color: c?.color || 'teal',
      icon: c?.icon || 'tag',
      total: 0,
      cleared: 0,
      amortized: 0,
      items: [],
    }
    groups.set(catId, group)
  }
  return group
}

export function recurringExpensesByCategory(
  recurring: Recurring[],
  categories: Category[],
  instances: RecurringInstance[],
  transactions: Transaction[],
  monthKey: string,
  includeYearlyAmortized: boolean = false,
): RecurringCategoryGroup[] {
  const recurringById = new Map(recurring.map((r) => [r.id, r]))
  const txnById = new Map(transactions.map((t) => [t.id, t]))
  const catById = new Map(categories.map((c) => [c.id, c]))
  const groups = new Map<string, RecurringCategoryGroup>()

  instances
    .filter((i) => i.month === monthKey && i.status !== 'not_applicable')
    .forEach((i) => {
      const r = recurringById.get(i.recurringId)
      if (!r || r.kind !== 'expense') return
      if (includeYearlyAmortized && r.cadence === 'yearly') return

      let amount = r.amount
      let tier: 'cleared' | 'pending' = 'pending'
      let date: string | null = null
      if (i.status === 'linked' && i.transactionId) {
        const t = txnById.get(i.transactionId)
        if (t) {
          amount = Number(t.amount)
          tier = t.cleared === 1 ? 'cleared' : 'pending'
          date = t.date
        }
      }

      const group = getOrCreateGroup(groups, r.categoryId, catById)
      group.total += amount
      if (tier === 'cleared') group.cleared += amount
      group.items.push({ id: i.id, name: r.name, amount, tier, date })
    })

  if (includeYearlyAmortized) {
    const [wy, wm] = monthKey.split('-').map(Number)
    const windowStartDate = new Date(wy, wm - 1 - 11, 1)
    const windowStart = `${windowStartDate.getFullYear()}-${String(windowStartDate.getMonth() + 1).padStart(2, '0')}`
    const paidRecently = new Set(
      transactions
        .filter((t) => t.recurringId && t.kind === 'expense' && t.date.slice(0, 7) >= windowStart && t.date.slice(0, 7) <= monthKey)
        .map((t) => t.recurringId as string),
    )

    recurring
      .filter((r) => r.kind === 'expense' && r.cadence === 'yearly' && paidRecently.has(r.id))
      .forEach((r) => {
        const amount = r.amount / 12
        const group = getOrCreateGroup(groups, r.categoryId, catById)
        group.total += amount
        group.amortized += amount
        group.items.push({ id: `${r.id}-amortized`, name: r.name, amount, tier: 'amortized', date: null })
      })
  }

  const itemRank = (item: RecurringCategoryItem) => (item.tier === 'pending' ? 1 : 0)
  groups.forEach((group) => {
    group.items.sort((a, b) => itemRank(a) - itemRank(b) || (a.date ?? '￿').localeCompare(b.date ?? '￿'))
  })

  return Array.from(groups.values()).sort((a, b) => b.total - a.total)
}

// ---- recurring ----

function lastDayOf(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export function resolvedDayOfMonth(dayOfMonth: number, d: Date): number {
  if (dayOfMonth >= 1) return dayOfMonth
  return lastDayOf(d) + dayOfMonth + 1
}

function matchesCadence(d: Date, r: Recurring): boolean {
  const dom = d.getDate()
  if (r.cadence === 'monthly') return dom === resolvedDayOfMonth(r.dayOfMonth || 1, d)
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

export function allOccurrencesInRange<T extends Recurring>(
  items: T[],
  from: Date,
  to: Date,
): (T & { date: Date })[] {
  const out: (T & { date: Date })[] = []
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

export function monthlyEstimate(r: Recurring, ref: Date = new Date()): number {
  if (r.endDate) {
    const refStr = ref.toISOString().slice(0, 10)
    if (r.endDate < refStr) return 0
  }
  const a = Number(r.amount || 0)
  if (r.cadence === 'yearly') return a / 12
  return a
}

// ---- simulations ----

export type SimulationView = 'monthly' | 'monthly-with-yearly' | 'yearly'

export function simulationTotals(
  lines: SimulationLine[],
  view: SimulationView,
): { income: number; expense: number } {
  const relevant = view === 'monthly' ? lines.filter((l) => l.frequency === 'monthly') : lines
  const factor = (l: SimulationLine) => {
    if (view === 'yearly') return l.frequency === 'yearly' ? 1 : 12
    return l.frequency === 'monthly' ? 1 : 1 / 12
  }
  return relevant.reduce(
    (acc, l) => {
      const amt = Number(l.amount || 0) * factor(l)
      if (l.kind === 'income') acc.income += amt
      else acc.expense += amt
      return acc
    },
    { income: 0, expense: 0 },
  )
}

export function simulationLinesByCategory(
  lines: SimulationLine[],
  cats: Category[],
  kind: 'income' | 'expense',
  view: SimulationView,
): { id: string; name: string; amount: number; color: string; icon: string }[] {
  const relevant = lines.filter((l) => {
    if (l.kind !== kind) return false
    if (view === 'monthly') return l.frequency === 'monthly'
    return true
  })
  const factor = (l: SimulationLine) => {
    if (view === 'yearly') return l.frequency === 'yearly' ? 1 : 12
    return l.frequency === 'monthly' ? 1 : 1 / 12
  }
  const catById = new Map(cats.map((c) => [c.id, c]))
  const map: Record<string, number> = {}
  relevant.forEach((l) => {
    const key = l.categoryId || 'uncategorized'
    map[key] = (map[key] || 0) + Number(l.amount || 0) * factor(l)
  })
  return Object.entries(map)
    .map(([id, amount]) => {
      const c = id !== 'uncategorized' ? catById.get(id) : undefined
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

export function currentRecurringMonthlyNet(recurringItems: Recurring[], ref: Date = new Date()): number {
  return recurringItems.reduce(
    (net, r) => net + (r.kind === 'income' ? 1 : -1) * monthlyEstimate(r, ref),
    0,
  )
}

export function simulationBalanceProjection(
  startingBalance: number,
  netMonthly: number,
  months: number = 12,
): { date: string; balance: number }[] {
  const today = new Date()
  const points: { date: string; balance: number }[] = [
    { date: today.toISOString().slice(0, 10), balance: startingBalance },
  ]
  for (let i = 1; i <= months; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    points.push({ date: d.toISOString().slice(0, 10), balance: startingBalance + netMonthly * i })
  }
  return points
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
