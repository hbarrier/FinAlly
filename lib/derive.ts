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
  SimulationInputs,
} from './db-types'
import type {
  Category,
  Transaction,
  Recurring,
  RecurringAmount,
  RecurringInstance,
  SimulationLine,
  SimulationInputs,
} from './db-types'
import {
  todayISO,
  currentMonth,
  monthOf,
  addMonths,
  firstDayOfMonth,
  parseLocalDate,
  completeMonthsWindow,
} from './dates'
import { formatConfig, currencySymbol } from './format-config'

export { completeMonthsWindow } from './dates'

export function effectiveAmount(amounts: RecurringAmount[], date: Date = new Date()): number {
  if (amounts.length === 0) return 0
  const dateStr = todayISO(date)
  const sorted = [...amounts].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const past = sorted.filter((a) => a.startDate <= dateStr)
  return past.length > 0 ? past[past.length - 1].amount : sorted[0].amount
}

// ---- date helpers ----

export function monthTransactions<T extends { date: string }>(txns: T[], month: string): T[] {
  return txns.filter((t) => monthOf(t.date) === month)
}

export function thisMonthTransactions<T extends { date: string }>(
  txns: T[],
  ref: Date = new Date(),
): T[] {
  return monthTransactions(txns, currentMonth(ref))
}

/** True when the date is strictly after `ref` (a not-yet-happened / planned transaction). */
export function isPlannedDate(date: string, ref: Date = new Date()): boolean {
  return date.slice(0, 10) > todayISO(ref)
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
  month: string,
  includeYearlyAmortized: boolean = false,
): RecurringCategoryGroup[] {
  const recurringById = new Map(recurring.map((r) => [r.id, r]))
  const txnById = new Map(transactions.map((t) => [t.id, t]))
  const catById = new Map(categories.map((c) => [c.id, c]))
  const groups = new Map<string, RecurringCategoryGroup>()

  instances
    .filter((i) => i.month === month && i.status !== 'not_applicable')
    .forEach((i) => {
      const r = recurringById.get(i.recurringId)
      if (!r || r.kind !== 'expense') return
      // Yearly bills are never shown as a full lump here: excluded entirely when
      // the "+ Yearly" toggle is off, folded in amortized (1/12) below when on.
      if (r.cadence === 'yearly') return

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
    const windowStart = addMonths(month, -11)
    const paidRecently = new Set(
      transactions
        .filter((t) => t.recurringId && t.kind === 'expense' && monthOf(t.date) >= windowStart && monthOf(t.date) <= month)
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
  // Clamp to the month's real length so a "31st" bill still fires on the 30th /
  // 28th in shorter months instead of being skipped entirely.
  if (dayOfMonth >= 1) return Math.min(dayOfMonth, lastDayOf(d))
  return lastDayOf(d) + dayOfMonth + 1
}

function matchesCadence(d: Date, r: Recurring): boolean {
  const dom = d.getDate()
  if (r.cadence === 'monthly') return dom === resolvedDayOfMonth(r.dayOfMonth || 1, d)
  if (r.cadence === 'yearly') {
    const s = parseLocalDate(r.startDate)
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
    const itemStart = r.startDate ? parseLocalDate(r.startDate) : monthStart
    const itemEnd = r.endDate ? parseLocalDate(r.endDate) : monthEnd

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
    const itemStart = parseLocalDate(r.startDate)
    const itemEnd = r.endDate ? parseLocalDate(r.endDate) : to
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
    if (r.endDate < todayISO(ref)) return 0
  }
  const a = Number(r.amount || 0)
  if (r.cadence === 'yearly') return a / 12
  return a
}

// ---- simulations ----

export type SimulationView = 'monthly' | 'monthly-with-yearly' | 'yearly'

/** Rounds an averaged/grouped simulation line amount to the nearest 10. */
export function roundToTen(n: number): number {
  return Math.round(n / 10) * 10
}

// ---- budgets ----

export type BudgetLineLite = {
  id: string
  name: string | null
  kind: 'expense' | 'income'
  categoryId: string
  merchantId: string | null
  amount: number
  frequency: 'monthly' | 'yearly'
  recurring: number
  sourceRecurringId: string | null
}

type BudgetTxnLite = {
  id: string
  date: string
  amount: number
  kind: 'expense' | 'income' | 'saving' | 'interest'
  categoryId: string | null
  merchantId: string | null
  recurringId: string | null
}

/**
 * A budget line's contribution to a single month. Monthly lines count at face
 * value; yearly lines amortize to 1/12, or drop to 0 when `includeYearly` is false.
 */
export function budgetLineMonthly(
  line: { amount: number; frequency: 'monthly' | 'yearly' },
  includeYearly: boolean,
): number {
  if (line.frequency === 'yearly') return includeYearly ? Number(line.amount ?? 0) / 12 : 0
  return Number(line.amount ?? 0)
}

/** Monthly budgeted total for one category across its lines. */
export function budgetCategoryMonthly(
  lines: BudgetLineLite[],
  categoryId: string,
  includeYearly: boolean,
): number {
  return lines.reduce(
    (s, l) => (l.categoryId === categoryId ? s + budgetLineMonthly(l, includeYearly) : s),
    0,
  )
}

/** Where `actual` sits against `budgeted`, given a "near" threshold (0-1, e.g. 0.8).
 *  Kind-neutral: for expenses 'atOrOver' is bad and 'under' is good; for income it's
 *  the reverse. Callers pick colors accordingly. `actual === budgeted` lands in
 *  'near', not 'atOrOver' (strict `>`, not `>=`). */
export type RatioState = 'under' | 'near' | 'atOrOver'

export function ratioState(actual: number, budgeted: number, threshold: number): RatioState {
  if (budgeted > 0 && actual > budgeted) return 'atOrOver'
  if (budgeted > 0 && actual > budgeted * threshold) return 'near'
  return 'under'
}

export interface MonthBudgetCategory {
  category: Category
  budgeted: number
  actual: number
  status: RatioState
  /** budget line paired with actual spend of the same merchant and recurring nature */
  matched: { line: BudgetLineLite; budgeted: number; actual: number }[]
  /** budget lines with no matching actual spend */
  unmatchedLines: { line: BudgetLineLite; budgeted: number }[]
  /** actual spend with no matching budget line, grouped by merchant + recurring nature */
  unmatchedActual: { merchantId: string | null; recurring: boolean; amount: number; count: number }[]
}

export interface MonthBudgetComparison {
  income: { budgeted: number; actual: number }
  expense: { budgeted: number; actual: number }
  categories: MonthBudgetCategory[]
}

/**
 * Builds the "this month vs budget" view model: global income / expense totals plus,
 * per expense category (budgeted total descending), the actual spend matched to
 * budget lines by merchant.
 */
export function monthBudgetComparison(
  lines: BudgetLineLite[],
  txns: BudgetTxnLite[],
  month: string,
  categories: Category[],
  includeYearly: boolean,
  ref: Date = new Date(),
  expenseThreshold: number = 0.8,
): MonthBudgetComparison {
  const monthTxns = txns.filter(
    (t) => t.date.slice(0, 7) === month && !isPlannedDate(t.date, ref),
  )
  const sumLines = (kind: 'expense' | 'income') =>
    lines.reduce((s, l) => (l.kind === kind ? s + budgetLineMonthly(l, includeYearly) : s), 0)
  const sumTxns = (kind: 'expense' | 'income') =>
    monthTxns.reduce((s, t) => (t.kind === kind ? s + Number(t.amount ?? 0) : s), 0)

  const expenseCats = categories.filter((c) => c.kind === 'expense')
  const cats: MonthBudgetCategory[] = expenseCats
    .map((category) => {
      const catLines = lines.filter((l) => l.categoryId === category.id && l.kind === 'expense')
      const catTxns = monthTxns.filter((t) => t.categoryId === category.id && t.kind === 'expense')

      // Key by merchant + recurring nature: a recurring transaction is compared
      // with the merchant's recurring budget line, the rest with its ad-hoc line.
      const actualKey = (merchantId: string | null, recurring: boolean) =>
        `${recurring ? 'r' : 'a'}|${merchantId ?? ''}`
      const actualByBucket = new Map<
        string,
        { merchantId: string | null; recurring: boolean; amount: number; count: number }
      >()
      for (const t of catTxns) {
        const recurring = t.recurringId != null
        const key = actualKey(t.merchantId, recurring)
        const cur = actualByBucket.get(key) ?? { merchantId: t.merchantId, recurring, amount: 0, count: 0 }
        cur.amount += Number(t.amount ?? 0)
        cur.count += 1
        actualByBucket.set(key, cur)
      }

      const matched: MonthBudgetCategory['matched'] = []
      const unmatchedLines: MonthBudgetCategory['unmatchedLines'] = []
      for (const line of catLines) {
        const budgeted = budgetLineMonthly(line, includeYearly)
        const key = line.merchantId ? actualKey(line.merchantId, line.recurring === 1) : null
        const hit = key ? actualByBucket.get(key) : undefined
        if (hit && key) {
          matched.push({ line, budgeted, actual: hit.amount })
          actualByBucket.delete(key)
        } else {
          unmatchedLines.push({ line, budgeted })
        }
      }

      const unmatchedActual = [...actualByBucket.values()].map((v) => ({
        merchantId: v.merchantId,
        recurring: v.recurring,
        amount: v.amount,
        count: v.count,
      }))

      const budgeted = catLines.reduce((s, l) => s + budgetLineMonthly(l, includeYearly), 0)
      const actual = catTxns.reduce((s, t) => s + Number(t.amount ?? 0), 0)
      return {
        category,
        budgeted,
        actual,
        status: ratioState(actual, budgeted, expenseThreshold),
        matched,
        unmatchedLines,
        unmatchedActual,
      }
    })
    .filter((c) => c.budgeted > 0 || c.actual > 0)
    .sort((a, b) => b.budgeted - a.budgeted)

  return {
    income: { budgeted: sumLines('income'), actual: sumTxns('income') },
    expense: { budgeted: sumLines('expense'), actual: sumTxns('expense') },
    categories: cats,
  }
}

export type BudgetActualTxn = {
  id: string
  date: string
  amount: number
  kind: 'expense' | 'income'
  categoryId: string
  merchantId: string | null
  recurringId: string | null
  cleared: number
}

export type BudgetLineTier = 'recurring' | 'merchant' | 'category'

export interface BudgetLineActual {
  line: BudgetLineLite
  tier: BudgetLineTier
  budgeted: number
  /** null only for an ambiguous category-tier line (zero or multiple generic lines in its category/frequency) */
  actual: number | null
  /** The transactions behind `actual` — empty when `actual` is null (ambiguous). */
  movements: BudgetActualTxn[]
}

export interface BudgetWaterfallCategory {
  category: Category
  budgeted: number
  actual: number
  status: RatioState
  lines: BudgetLineActual[]
  /** True when this category/frequency has real unclaimed spend but zero generic lines to attach it to. */
  needsOtherLine: boolean
  /** The exact transactions summed into `actual` — powers the movements modal. */
  movements: BudgetActualTxn[]
}

export interface BudgetWaterfallComparison {
  income: { budgeted: number; actual: number }
  expense: { budgeted: number; actual: number }
  categories: BudgetWaterfallCategory[]
}

/** Tier 1: every transaction whose `recurringId` matches a line's `sourceRecurringId`, global and
 * window-independent — this money belongs to that specific recurring template, in full, regardless
 * of which tab is asking. Returns each claimed line's transactions plus the set of claimed txn ids
 * so callers can remove them from the merchant/category pool for every frequency at once. */
function claimByRecurringIdentity(
  lines: BudgetLineLite[],
  txns: BudgetActualTxn[],
): { byLineId: Map<string, BudgetActualTxn[]>; claimedIds: Set<string> } {
  const lineBySourceRecurringId = new Map(
    lines.filter((l) => l.sourceRecurringId).map((l) => [l.sourceRecurringId as string, l]),
  )
  const byLineId = new Map<string, BudgetActualTxn[]>()
  const claimedIds = new Set<string>()
  for (const t of txns) {
    if (!t.recurringId) continue
    const line = lineBySourceRecurringId.get(t.recurringId)
    if (!line) continue
    const arr = byLineId.get(line.id) ?? []
    arr.push(t)
    byLineId.set(line.id, arr)
    claimedIds.add(t.id)
  }
  return { byLineId, claimedIds }
}

/** One frequency's tier-2/3 waterfall over an already tier-1-stripped, already cross-frequency-
 * stripped pool, windowed to `[windowStart, windowEnd]`. Tier 1 lines are windowed for display here
 * too, from their own (window-independent) claims. Returns the comparison plus which txn ids tier
 * 2/3 claimed here, so a higher-priority frequency (Monthly) can strip them from a lower-priority
 * one's (Yearly) pool. */
function budgetWaterfallForFrequency(
  lines: BudgetLineLite[],
  pool: BudgetActualTxn[],
  categories: Category[],
  tier1ByLineId: Map<string, BudgetActualTxn[]>,
  windowStart: string,
  windowEnd: string,
  deferGenericCategories: Set<string>,
  thresholds: { expense: number; income: number },
): { comparison: BudgetWaterfallComparison; claimedTxnIds: Set<string> } {
  const claimedTxnIds = new Set<string>()
  const inWindow = (t: BudgetActualTxn) => {
    const m = t.date.slice(0, 7)
    return m >= windowStart && m <= windowEnd
  }

  let deferredExpense = 0
  let deferredIncome = 0

  const cats: BudgetWaterfallCategory[] = categories
    .map((category) => {
      const catLines = lines.filter((l) => l.categoryId === category.id)
      const catPool = pool.filter((t) => t.categoryId === category.id && t.kind === category.kind)

      const lineResults: BudgetLineActual[] = []
      const movements: BudgetActualTxn[] = []

      // Tier 1 — recurring identity, windowed for display.
      let tier1Total = 0
      for (const line of catLines.filter((l) => l.sourceRecurringId)) {
        const claimed = (tier1ByLineId.get(line.id) ?? []).filter(inWindow)
        const actual = claimed.reduce((s, t) => s + Number(t.amount ?? 0), 0)
        tier1Total += actual
        movements.push(...claimed)
        lineResults.push({ line, tier: 'recurring', budgeted: Number(line.amount ?? 0), actual, movements: claimed })
      }

      // Tier 2 — merchant, exact match, consumes from the pool.
      let remaining = [...catPool]
      for (const line of catLines.filter((l) => !l.sourceRecurringId && l.merchantId)) {
        const matches = remaining.filter((t) => t.merchantId === line.merchantId)
        matches.forEach((t) => claimedTxnIds.add(t.id))
        remaining = remaining.filter((t) => t.merchantId !== line.merchantId)
        movements.push(...matches)
        lineResults.push({
          line,
          tier: 'merchant',
          budgeted: Number(line.amount ?? 0),
          actual: matches.reduce((s, t) => s + Number(t.amount ?? 0), 0),
          movements: matches,
        })
      }

      // Tier 3 — category/generic, whatever's left; ambiguous when 0 or 2+ such lines.
      const genericLines = catLines.filter((l) => !l.sourceRecurringId && !l.merchantId)
      const deferToYearly = deferGenericCategories.has(category.id) && remaining.length > 0
      const needsOtherLine = !deferToYearly && genericLines.length === 0 && remaining.length > 0
      let deferredAmount = 0
      if (deferToYearly) {
        // A single unambiguous yearly generic line exists for this category — leave `remaining`
        // unclaimed so it flows through to the yearly pool instead of this (monthly) frequency.
        deferredAmount = remaining.reduce((s, t) => s + Number(t.amount ?? 0), 0)
        if (category.kind === 'expense') deferredExpense += deferredAmount
        else deferredIncome += deferredAmount
        for (const line of genericLines) {
          lineResults.push({ line, tier: 'category', budgeted: Number(line.amount ?? 0), actual: genericLines.length === 1 ? 0 : null, movements: [] })
        }
      } else {
        remaining.forEach((t) => claimedTxnIds.add(t.id))
        movements.push(...remaining)
        const remainder = remaining.reduce((s, t) => s + Number(t.amount ?? 0), 0)
        for (const line of genericLines) {
          lineResults.push({
            line,
            tier: 'category',
            budgeted: Number(line.amount ?? 0),
            actual: genericLines.length === 1 ? remainder : null,
            movements: genericLines.length === 1 ? remaining : [],
          })
        }
      }

      const budgeted = catLines.reduce((s, l) => s + Number(l.amount ?? 0), 0)
      const actual = tier1Total + catPool.reduce((s, t) => s + Number(t.amount ?? 0), 0) - deferredAmount
      return {
        category,
        budgeted,
        actual,
        status: ratioState(actual, budgeted, category.kind === 'income' ? thresholds.income : thresholds.expense),
        lines: lineResults,
        needsOtherLine,
        movements: movements.sort((a, b) => b.date.localeCompare(a.date)),
      }
    })
    .filter((c) => c.budgeted > 0 || c.actual > 0)
    .sort((a, b) => b.budgeted - a.budgeted)

  const sumLines = (kind: 'expense' | 'income') =>
    lines.reduce((s, l) => (l.kind === kind ? s + Number(l.amount ?? 0) : s), 0)
  const tier1ActualByKind = (kind: 'expense' | 'income') =>
    lines
      .filter((l) => l.kind === kind && l.sourceRecurringId)
      .reduce((s, l) => s + (tier1ByLineId.get(l.id) ?? []).filter(inWindow).reduce((a, t) => a + Number(t.amount ?? 0), 0), 0)
  const poolActualByKind = (kind: 'expense' | 'income') =>
    pool.reduce((s, t) => (t.kind === kind ? s + Number(t.amount ?? 0) : s), 0) -
    (kind === 'expense' ? deferredExpense : deferredIncome)

  return {
    comparison: {
      income: { budgeted: sumLines('income'), actual: tier1ActualByKind('income') + poolActualByKind('income') },
      expense: { budgeted: sumLines('expense'), actual: tier1ActualByKind('expense') + poolActualByKind('expense') },
      categories: cats,
    },
    claimedTxnIds,
  }
}

/** For months before the current one, claims the transactions that a monthly-frequency line would
 * have claimed had they happened this month — a merchant match (tier 2), or a category's sole/
 * ambiguous generic line (tier 3), but only when that category actually has such a line. Used only
 * to strip these ids from Yearly's pool: a category with no monthly line at all is left untouched,
 * so its past-month spend still falls to Yearly exactly as before. No comparison is built here —
 * these months are never displayed on the Monthly tab (current-month only), so only the id set
 * matters. */
function claimPastMonthsForMonthlyLines(
  monthlyLines: BudgetLineLite[],
  pastMonthsPool: BudgetActualTxn[],
  categories: Category[],
  deferGenericCategories: Set<string>,
): Set<string> {
  const claimedTxnIds = new Set<string>()
  for (const category of categories) {
    const catLines = monthlyLines.filter((l) => l.categoryId === category.id)
    let remaining = pastMonthsPool.filter((t) => t.categoryId === category.id && t.kind === category.kind)

    for (const line of catLines.filter((l) => !l.sourceRecurringId && l.merchantId)) {
      const matches = remaining.filter((t) => t.merchantId === line.merchantId)
      matches.forEach((t) => claimedTxnIds.add(t.id))
      remaining = remaining.filter((t) => t.merchantId !== line.merchantId)
    }

    const genericLines = catLines.filter((l) => !l.sourceRecurringId && !l.merchantId)
    if (genericLines.length > 0 && !deferGenericCategories.has(category.id)) {
      remaining.forEach((t) => claimedTxnIds.add(t.id))
    }
  }
  return claimedTxnIds
}

/**
 * Unified budget-vs-actual engine for both Budgets-page tabs, applying a specificity waterfall —
 * recurring template, then merchant, then category — so a transaction is never double-counted:
 *  1. Tier 1 (recurring) is a global, window-independent claim: any transaction whose `recurringId`
 *     matches a line's `sourceRecurringId` belongs to that line alone, in any month, on top of
 *     tiers 2/3 — removed from the merchant/category pool for both tabs before anything else runs.
 *  2. Yearly-ad-hoc-first: for a category with exactly one generic (no merchant, no
 *     `sourceRecurringId`) yearly line, Monthly's tier 3 never claims that category's leftover
 *     spend — it's left in the pool so it falls through to the Yearly tab's own generic line
 *     instead (`deferGenericCategories`). Only when no such unambiguous yearly ad-hoc line exists
 *     does unmatched spend fall to a monthly generic line (or flag `needsOtherLine` so the page can
 *     auto-create one at €0).
 *  3. The Monthly tab (current month only) runs first against what's left.
 *  4. The Yearly tab (`[startMonth, currentMonth]`) runs against what's left after ALSO removing
 *     whatever Monthly's tier 2/3 just claimed for the current month — the only month the two
 *     windows can overlap on, since Monthly's window is always a subset of Yearly's — AND whatever
 *     a monthly line would have claimed in earlier months of that same window (`claimPastMonthsForMonthlyLines`),
 *     so a merchant or ad-hoc line's spend counts as monthly for every month it happened in, not just
 *     the current one. This is what keeps a merchant or category's non-recurring spend counted as
 *     either monthly or yearly, never both.
 */
export function budgetWaterfall(
  lines: BudgetLineLite[],
  txns: BudgetActualTxn[],
  categories: Category[],
  startMonth: string,
  currentMonth: string,
  thresholds: { expense: number; income: number } = { expense: 0.8, income: 0.8 },
): { monthly: BudgetWaterfallComparison; yearly: BudgetWaterfallComparison } {
  const monthlyLines = lines.filter((l) => l.frequency === 'monthly')
  const yearlyLines = lines.filter((l) => l.frequency === 'yearly')

  const yearlyGenericCounts = new Map<string, number>()
  for (const l of yearlyLines) {
    if (l.sourceRecurringId || l.merchantId) continue
    yearlyGenericCounts.set(l.categoryId, (yearlyGenericCounts.get(l.categoryId) ?? 0) + 1)
  }
  const deferGenericCategories = new Set(
    [...yearlyGenericCounts].filter(([, count]) => count === 1).map(([categoryId]) => categoryId),
  )

  const { byLineId: tier1ByLineId, claimedIds: tier1ClaimedIds } = claimByRecurringIdentity(lines, txns)
  const poolAfterTier1 = txns.filter((t) => !tier1ClaimedIds.has(t.id))

  const monthlyPool = poolAfterTier1.filter((t) => t.date.slice(0, 7) === currentMonth)
  const { comparison: monthly, claimedTxnIds: monthlyClaimed } = budgetWaterfallForFrequency(
    monthlyLines,
    monthlyPool,
    categories,
    tier1ByLineId,
    currentMonth,
    currentMonth,
    deferGenericCategories,
    thresholds,
  )

  const pastMonthsPool = poolAfterTier1.filter((t) => {
    const m = t.date.slice(0, 7)
    return m >= startMonth && m < currentMonth
  })
  const pastMonthsClaimed = claimPastMonthsForMonthlyLines(monthlyLines, pastMonthsPool, categories, deferGenericCategories)

  const yearlyPool = poolAfterTier1.filter((t) => {
    const m = t.date.slice(0, 7)
    return m >= startMonth && m <= currentMonth && !monthlyClaimed.has(t.id) && !pastMonthsClaimed.has(t.id)
  })
  const { comparison: yearly } =
    budgetWaterfallForFrequency(yearlyLines, yearlyPool, categories, tier1ByLineId, startMonth, currentMonth, new Set(), thresholds)

  return { monthly, yearly }
}

/** Sum of budget-linked recurring amounts (lines with `sourceRecurringId` set, of the given
 *  `kind`) expected in-window but not yet cleared: either no transaction recorded yet for that
 *  occurrence (instance status 'expected'), or one recorded but not cleared. A cleared,
 *  linked instance is already counted in `budgetWaterfall`'s `actual` and is excluded here to
 *  avoid double-counting. Reuses the already-materialized `recurringInstances` rows (see
 *  lib/recurring-instances.ts) instead of recomputing cadence/month-rules math. Also breaks the
 *  total down by category so a single category's bar can show its own not-yet-cleared amount. */
export function plannedUncleared(
  lines: BudgetLineLite[],
  recurring: Recurring[],
  instances: RecurringInstance[],
  transactions: BudgetActualTxn[],
  startMonth: string,
  currentMonth: string,
  kind: 'expense' | 'income',
): { monthly: number; yearly: number; monthlyByCategory: Map<string, number>; yearlyByCategory: Map<string, number> } {
  const recurringById = new Map(recurring.map((r) => [r.id, r]))
  const txnById = new Map(transactions.map((t) => [t.id, t]))

  const sumWindow = (freqLines: BudgetLineLite[], windowStart: string, windowEnd: string) => {
    const lineByRecurringId = new Map(
      freqLines.filter((l) => l.kind === kind && l.sourceRecurringId).map((l) => [l.sourceRecurringId as string, l]),
    )
    const byCategory = new Map<string, number>()
    let total = 0
    if (lineByRecurringId.size === 0) return { total, byCategory }
    for (const i of instances) {
      if (i.status === 'not_applicable' || i.month < windowStart || i.month > windowEnd) continue
      const line = lineByRecurringId.get(i.recurringId)
      if (!line) continue
      const r = recurringById.get(i.recurringId)
      if (!r || r.kind !== kind) continue
      let amount = Number(r.amount)
      if (i.status === 'linked' && i.transactionId) {
        const t = txnById.get(i.transactionId)
        if (t) {
          if (t.cleared === 1) continue
          amount = Number(t.amount)
        }
      }
      total += amount
      byCategory.set(line.categoryId, (byCategory.get(line.categoryId) ?? 0) + amount)
    }
    return { total, byCategory }
  }

  const monthly = sumWindow(lines.filter((l) => l.frequency === 'monthly'), currentMonth, currentMonth)
  const yearly = sumWindow(lines.filter((l) => l.frequency === 'yearly'), startMonth, currentMonth)

  return {
    monthly: monthly.total,
    yearly: yearly.total,
    monthlyByCategory: monthly.byCategory,
    yearlyByCategory: yearly.byCategory,
  }
}

/** @deprecated use `plannedUncleared(..., 'income')` — kept for existing income-only callers. */
export function plannedUnclearedIncome(
  lines: BudgetLineLite[],
  recurring: Recurring[],
  instances: RecurringInstance[],
  transactions: BudgetActualTxn[],
  startMonth: string,
  currentMonth: string,
): { monthly: number; yearly: number } {
  const { monthly, yearly } = plannedUncleared(lines, recurring, instances, transactions, startMonth, currentMonth, 'income')
  return { monthly, yearly }
}

/** How much a line's amount counts under a given simulation view. */
function viewFactor(line: { frequency: 'monthly' | 'yearly' }, view: SimulationView): number {
  if (view === 'yearly') return line.frequency === 'yearly' ? 1 : 12
  return line.frequency === 'monthly' ? 1 : 1 / 12
}

export function simulationTotals(
  lines: SimulationLine[],
  view: SimulationView,
): { income: number; expense: number } {
  const relevant = view === 'monthly' ? lines.filter((l) => l.frequency === 'monthly') : lines
  const factor = (l: SimulationLine) => viewFactor(l, view)
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

export function simulationExpenseByPriority(
  lines: SimulationLine[],
  view: SimulationView,
): { must: number; should: number; nice: number } {
  const relevant = (view === 'monthly' ? lines.filter((l) => l.frequency === 'monthly') : lines).filter(
    (l) => l.kind === 'expense',
  )
  const factor = (l: SimulationLine) => viewFactor(l, view)
  return relevant.reduce(
    (acc, l) => {
      const key = l.priority ?? 'should'
      acc[key] += Number(l.amount || 0) * factor(l)
      return acc
    },
    { must: 0, should: 0, nice: 0 },
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
  const factor = (l: SimulationLine) => viewFactor(l, view)
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

/**
 * Amount for one simulation line as shown under the monthly/yearly toggle.
 * Monthly view: yearly lines are split into 12. Yearly view: monthly lines
 * are multiplied by 12.
 */
export function simulationLineDisplayAmount(
  line: SimulationLine,
  viewMode: 'monthly' | 'yearly',
): number {
  const amt = Number(line.amount || 0)
  if (viewMode === 'yearly') return line.frequency === 'yearly' ? amt : amt * 12
  return line.frequency === 'yearly' ? amt / 12 : amt
}

export function sortSimulationLines(
  lines: SimulationLine[],
  viewMode: 'monthly' | 'yearly' = 'monthly',
): SimulationLine[] {
  return [...lines].sort((a, b) => {
    const aRecurring = a.origin === 'recurring' ? 0 : 1
    const bRecurring = b.origin === 'recurring' ? 0 : 1
    if (aRecurring !== bRecurring) return aRecurring - bRecurring
    return simulationLineDisplayAmount(b, viewMode) - simulationLineDisplayAmount(a, viewMode)
  })
}

export function groupSimulationLinesByCategory(
  lines: SimulationLine[],
  cats: Category[],
  viewMode: 'monthly' | 'yearly' = 'monthly',
): { key: string; cat: Category | undefined; total: number; lines: SimulationLine[] }[] {
  const catById = new Map(cats.map((c) => [c.id, c]))
  const groups = new Map<string, { cat: Category | undefined; lines: SimulationLine[] }>()
  for (const l of sortSimulationLines(lines, viewMode)) {
    const cat = l.categoryId ? catById.get(l.categoryId) : undefined
    const key = cat?.name ?? 'Uncategorized'
    if (!groups.has(key)) groups.set(key, { cat, lines: [] })
    groups.get(key)!.lines.push(l)
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      cat: g.cat,
      total: g.lines.reduce((s, l) => s + simulationLineDisplayAmount(l, viewMode), 0),
      lines: g.lines,
    }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Re-derives the non-recurring transactions that fed an averaged or grouped
 * simulation line. Mirrors the seeding math in `averagedLinesForKind`, so with
 * no exclusions `sum(result) / inputs.avg.periodMonths` is the exact average the
 * line amount was rounded (to the nearest 10) from.
 * Pass the simulation's `createdAt` as `ref` to reproduce the original window.
 */
export function simulationLineSourceTransactions(
  line: Pick<SimulationLine, 'kind' | 'categoryId' | 'merchantId' | 'origin'>,
  inputs: SimulationInputs,
  transactions: Transaction[],
  ref: Date = new Date(),
  overrideMonths?: number,
): Transaction[] {
  const months = overrideMonths ?? inputs.avg.periodMonths
  const { start, endExclusive } = completeMonthsWindow(months, ref)
  const inWindow = transactions.filter(
    (t) => t.kind === line.kind && !t.recurringId && t.date >= start && t.date < endExclusive,
  )

  let source: Transaction[]
  if (line.origin === 'rollup') {
    const inCategory = inWindow.filter((t) => (t.categoryId ?? '') === (line.categoryId ?? ''))
    const comboSum = new Map<string, number>()
    for (const t of inCategory) {
      const k = t.merchantId ?? ''
      comboSum.set(k, (comboSum.get(k) ?? 0) + Number(t.amount || 0))
    }
    source = inCategory.filter(
      (t) => (comboSum.get(t.merchantId ?? '') ?? 0) / months < inputs.avg.thresholdMonthly,
    )
  } else {
    source = inWindow.filter(
      (t) =>
        (t.categoryId ?? '') === (line.categoryId ?? '') &&
        (t.merchantId ?? '') === (line.merchantId ?? ''),
    )
  }

  return source.sort((a, b) => b.date.localeCompare(a.date))
}

/** Groups transactions by calendar month, newest month first, rows within a month by date desc. */
export function groupTransactionsByMonth(
  txns: Transaction[],
): { month: string; total: number; txns: Transaction[] }[] {
  const byMonth = new Map<string, Transaction[]>()
  for (const t of txns) {
    const key = monthOf(t.date)
    const list = byMonth.get(key) ?? []
    list.push(t)
    byMonth.set(key, list)
  }
  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, list]) => ({
      month,
      total: list.reduce((s, t) => s + Number(t.amount || 0), 0),
      txns: list.sort((a, b) => b.date.localeCompare(a.date)),
    }))
}

/** Human-readable bullets describing the wizard inputs a simulation was seeded with. */
export function describeSimulationInputs(inputs: SimulationInputs): string[] {
  const out: string[] = []
  const rec = inputs.recurring
  if (rec.monthlyExpenses) out.push('Recurring monthly expenses')
  if (rec.monthlyIncome) out.push('Recurring monthly income')
  if (rec.yearlyExpenses) out.push('Recurring yearly expenses')
  if (rec.yearlyIncome) out.push('Recurring yearly income')

  const period = inputs.avg.periodMonths === 1 ? 'last month' : `last ${inputs.avg.periodMonths} months`
  if (inputs.avg.expenses) out.push(`Averaged non-recurring expenses · ${period}`)
  if (inputs.avg.income) out.push(`Averaged non-recurring income · ${period}`)

  if ((inputs.avg.expenses || inputs.avg.income) && inputs.avg.rollup !== 'all') {
    const under = `Items under ${fmt(inputs.avg.thresholdMonthly)}/mo`
    out.push(inputs.avg.rollup === 'drop' ? `${under} dropped` : `${under} rolled into "Other <category>"`)
  }
  return out
}

export function currentRecurringMonthlyNet(recurringItems: Recurring[], ref: Date = new Date()): number {
  return recurringItems.reduce((net, r) => {
    if (r.kind === 'saving') {
      // A recurring transfer only moves the credit balance through its NULL endpoint.
      if (r.destSavingAccountId == null) return net + monthlyEstimate(r, ref)
      if (r.sourceSavingAccountId == null) return net - monthlyEstimate(r, ref)
      return net
    }
    return net + (r.kind === 'income' ? 1 : -1) * monthlyEstimate(r, ref)
  }, 0)
}

export function simulationBalanceProjection(
  startingBalance: number,
  netMonthly: number,
  months: number = 12,
): { date: string; balance: number }[] {
  const thisMonth = currentMonth()
  const points: { date: string; balance: number }[] = [
    { date: todayISO(), balance: startingBalance },
  ]
  for (let i = 1; i <= months; i++) {
    points.push({
      date: firstDayOfMonth(addMonths(thisMonth, i)),
      balance: startingBalance + netMonthly * i,
    })
  }
  return points
}

export interface SimMonthComparison {
  month: string // YYYY-MM
  label: string // localized short month name
  ongoing: boolean // true only for the current (last) month
  actual: { recurring: number; variable: number; recurringYearly: number }
  sim: { recurring: number; variable: number; recurringYearly: number }
  actualTotal: number
  simTotal: number
  pct: number | null // actualTotal / simTotal * 100, null when simTotal === 0
}

type ComparisonTxn = {
  date: string
  amount: number
  kind: 'expense' | 'income' | 'saving' | 'interest'
  categoryId: string | null
  recurringId: string | null
  cleared: number
}

type ComparisonRecurring = {
  id: string
  cadence: 'monthly' | 'yearly'
  startDate: string
}

/**
 * Compares, month by month over the trailing 12 months (current month last),
 * the expenses actually cleared against what the simulation implies for a month.
 * Revenues are excluded.
 *
 * `monthly` view: two buckets. `recurring` = monthly-cadence recurring; `variable`
 * = everything else, with all yearly simulation lines amortized to 1/12 and actual
 * yearly-recurring transactions shown as their real lump.
 * `yearly` view: adds `recurringYearly`. Yearly-recurring simulation lines are no
 * longer amortized; each is placed in the month a same-category yearly-recurring
 * transaction cleared (else the source recurring's anchor month, else the current month).
 */
export function simulationVsActualsMonthly(
  lines: SimulationLine[],
  txns: ComparisonTxn[],
  recurring: ComparisonRecurring[],
  viewMode: 'monthly' | 'yearly',
  ref: Date = new Date(),
): SimMonthComparison[] {
  const months: SimMonthComparison[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    months.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(formatConfig().locale, { month: 'short' }),
      ongoing: i === 0,
      actual: { recurring: 0, variable: 0, recurringYearly: 0 },
      sim: { recurring: 0, variable: 0, recurringYearly: 0 },
      actualTotal: 0,
      simTotal: 0,
      pct: null,
    })
  }
  const byMonth = new Map(months.map((m) => [m.month, m]))
  const recurringById = new Map(recurring.map((r) => [r.id, r]))

  // Actual side: cleared expense transactions in the window.
  for (const t of txns) {
    if (t.kind !== 'expense' || t.cleared !== 1) continue
    const row = byMonth.get(t.date.slice(0, 7))
    if (!row) continue
    const amt = Number(t.amount || 0)
    const isYearlyRec = t.recurringId && recurringById.get(t.recurringId)?.cadence === 'yearly'
    if (isYearlyRec) {
      if (viewMode === 'yearly') row.actual.recurringYearly += amt
      else row.actual.variable += amt
    } else if (t.recurringId) {
      row.actual.recurring += amt
    } else {
      row.actual.variable += amt
    }
  }

  // Simulation side: a steady monthly figure, same for every month.
  const expenseLines = lines.filter((l) => l.kind === 'expense')
  let simRecurring = 0
  let simVariable = 0
  for (const l of expenseLines) {
    const amt = Number(l.amount || 0)
    const isRecurring = l.origin === 'recurring'
    if (l.frequency === 'yearly') {
      if (isRecurring && viewMode === 'yearly') continue // placed as a lump below
      simVariable += amt / 12
    } else if (isRecurring) {
      simRecurring += amt
    } else {
      simVariable += amt
    }
  }
  for (const m of months) {
    m.sim.recurring = simRecurring
    m.sim.variable = simVariable
  }

  if (viewMode === 'yearly') {
    const yearlyRecLines = expenseLines.filter(
      (l) => l.origin === 'recurring' && l.frequency === 'yearly',
    )
    // Months where an actual yearly-recurring transaction cleared, per category.
    const actualMonthsByCat = new Map<string, string[]>()
    for (const t of txns) {
      if (t.kind !== 'expense' || t.cleared !== 1 || !t.recurringId) continue
      if (recurringById.get(t.recurringId)?.cadence !== 'yearly') continue
      const key = t.categoryId ?? ''
      if (!byMonth.has(t.date.slice(0, 7))) continue
      const list = actualMonthsByCat.get(key) ?? []
      list.push(t.date.slice(0, 7))
      actualMonthsByCat.set(key, list)
    }
    for (const l of yearlyRecLines) {
      const amt = Number(l.amount || 0)
      const catMonths = actualMonthsByCat.get(l.categoryId ?? '')
      let target: string | undefined
      if (catMonths && catMonths.length) {
        target = [...catMonths].sort()[0]
      } else if (l.sourceRecurringId) {
        const anchor = recurringById.get(l.sourceRecurringId)?.startDate.slice(5, 7)
        target = anchor ? months.find((m) => m.month.slice(5, 7) === anchor)?.month : undefined
      }
      const row = (target && byMonth.get(target)) || months[months.length - 1]
      row.sim.recurringYearly += amt
    }
  }

  for (const m of months) {
    m.actualTotal = m.actual.recurring + m.actual.variable + m.actual.recurringYearly
    m.simTotal = m.sim.recurring + m.sim.variable + m.sim.recurringYearly
    m.pct = m.simTotal ? (m.actualTotal / m.simTotal) * 100 : null
  }
  return months
}

// ---- select helpers ----

export function buildCategorySelectOptions(
  cats: Category[],
): { value: string; label: string; group: string }[] {
  const active = cats.filter((c) => c.isActive === 1 && c.isSavings !== 1)
  return [
    ...active
      .filter((c) => c.kind === 'expense')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name, group: 'Expenses' })),
    ...active
      .filter((c) => c.kind === 'income')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name, group: 'Income' })),
  ]
}

// ---- formatting ----

export function formatDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  return new Date(iso).toLocaleDateString(formatConfig().locale, opts)
}

export function fmt(amt: number | string, opts: { noSymbol?: boolean } = {}): string {
  const { locale, currency } = formatConfig()
  const n = Number(amt || 0)
  const abs = Math.abs(n)
  const s = opts.noSymbol
    ? abs.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : abs.toLocaleString(locale, { style: 'currency', currency })
  return (n < 0 ? '−' : '') + s
}

/** `fmt` with an explicit leading `+` for non-negative amounts. */
export function signedFmt(amt: number): string {
  return (amt >= 0 ? '+' : '−') + fmt(Math.abs(amt))
}

export function fmtShort(amt: number | string): string {
  const sym = currencySymbol()
  const n = Math.abs(Number(amt || 0))
  if (n >= 1000) return sym + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k'
  return sym + n.toFixed(0)
}

export function splitCents(amt: number | string) {
  const n = Math.abs(Number(amt || 0))
  // Round to cents first, then split — otherwise a value like 2.999 yields
  // whole=2, cents=100 and renders as "€2,100".
  const totalCents = Math.round(n * 100)
  return {
    sign: Number(amt) < 0 ? '−' : '',
    whole: Math.floor(totalCents / 100).toLocaleString(formatConfig().locale),
    cents: String(totalCents % 100).padStart(2, '0'),
  }
}

// ---- balance ----

type CreditMovement = {
  kind: 'expense' | 'income' | 'saving' | 'interest'
  amount: number | string
  sourceSavingAccountId?: string | null
  destSavingAccountId?: string | null
}

/**
 * How one movement changes the CREDIT (main) account balance.
 * income `+`, expense `−`. A `saving` transfer only touches credit through its
 * NULL endpoint: money leaving credit (`source` NULL) is `−`, money returning to
 * credit (`dest` NULL) is `+`; a saving↔saving transfer leaves credit untouched.
 * `interest` has no source at all and never touches credit.
 */
export function creditSignedAmount(t: CreditMovement): number {
  const amount = Number(t.amount || 0)
  if (t.kind === 'income') return amount
  if (t.kind === 'expense') return -amount
  if (t.kind === 'interest') return 0
  if (t.destSavingAccountId == null) return amount
  if (t.sourceSavingAccountId == null) return -amount
  return 0
}

export function currentBalance(
  startingBalance: number,
  txns: Transaction[],
): number {
  return startingBalance + txns.reduce((s, t) => s + creditSignedAmount(t), 0)
}

/**
 * Current balance of one saving account: its start balance plus every transfer
 * in (`dest` = id) minus every transfer out (`source` = id).
 */
export function savingAccountBalance(
  startBalance: number,
  txns: Pick<Transaction, 'kind' | 'amount' | 'sourceSavingAccountId' | 'destSavingAccountId'>[],
  accountId: string,
): number {
  return (
    startBalance +
    txns.reduce((s, t) => {
      if (t.kind === 'interest') {
        return t.destSavingAccountId === accountId ? s + Number(t.amount || 0) : s
      }
      if (t.kind !== 'saving') return s
      if (t.destSavingAccountId === accountId) return s + Number(t.amount || 0)
      if (t.sourceSavingAccountId === accountId) return s - Number(t.amount || 0)
      return s
    }, 0)
  )
}
