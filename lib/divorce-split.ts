/**
 * Pure calculation core for the divorce cost-split page (me / Audrey / Vincent).
 *
 * Rent: I pay it, Audrey receives the APL. The shared base is rent − APL; Vincent owes
 * his share of it (paid to Audrey), and Audrey owes me that share plus the APL.
 * Expenses: Audrey pays them; I owe her my share and Vincent owes her his.
 * Shares flagged as paid drop out of the balances. Money is `real` euros.
 */

export type SplitSettings = { rent: number; apl: number; myPercent: number; startMonth: string }

/** Per-month rent row; null rent/apl fall back to the settings. */
export type RentMonthLike = {
  month: string
  rent: number | null
  apl: number | null
  vincentPaid: number
  audreyPaid: number
}

/** `myPercent` is only null on legacy payment rows (column is nullable); treated as 0. */
export type ExpenseLike = { date: string; amount: number; myPercent: number | null; mePaid: number; vincentPaid: number }

export type RentBreakdown = {
  rent: number
  apl: number
  shared: number
  vincentShare: number
  /** Vincent's share (paid to Audrey) + the APL she received. */
  audreyOwesMe: number
  vincentPaid: boolean
  audreyPaid: boolean
}

export type SplitBalance = {
  /** > 0: I owe Audrey; < 0: Audrey owes me. */
  iOweAudrey: number
  /** > 0: Vincent owes Audrey. */
  vincentOwesAudrey: number
}

function round2(n: number): number {
  return Math.round((n + (n >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100
}

export function rentBreakdown(settings: SplitSettings, row?: RentMonthLike): RentBreakdown {
  const rent = row?.rent ?? settings.rent
  const apl = row?.apl ?? settings.apl
  const shared = rent - apl
  const vincentShare = (shared * (100 - settings.myPercent)) / 100
  return {
    rent,
    apl,
    shared,
    vincentShare,
    audreyOwesMe: vincentShare + apl,
    vincentPaid: row?.vincentPaid === 1,
    audreyPaid: row?.audreyPaid === 1,
  }
}

export function expenseShares(e: ExpenseLike): { mine: number; vincent: number } {
  const mine = (e.amount * (e.myPercent ?? 0)) / 100
  return { mine, vincent: e.amount - mine }
}

/** Outstanding balances for one month (rent + expenses), ignoring paid shares. */
export function monthBalance(rent: RentBreakdown | null, expenses: ExpenseLike[]): SplitBalance {
  let me = rent && !rent.audreyPaid ? -rent.audreyOwesMe : 0
  let vincent = rent && !rent.vincentPaid ? rent.vincentShare : 0
  for (const e of expenses) {
    const { mine, vincent: his } = expenseShares(e)
    if (e.mePaid !== 1) me += mine
    if (e.vincentPaid !== 1) vincent += his
  }
  return { iOweAudrey: round2(me), vincentOwesAudrey: round2(vincent) }
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** Every month from the start month to the latest of `today`'s month and the expense months, newest first. */
export function splitMonths(startMonth: string, currentMonth: string, expenses: ExpenseLike[]): string[] {
  const months = new Set(expenses.map((e) => e.date.slice(0, 7)))
  const last = [currentMonth, ...months].sort().at(-1)!
  for (let m = startMonth; m <= last; m = nextMonth(m)) months.add(m)
  return [...months].sort().reverse()
}

export type MonthView<E extends ExpenseLike = ExpenseLike> = {
  month: string
  /** Null for expense months before the rent start month. */
  rent: RentBreakdown | null
  expenses: E[]
  balance: SplitBalance
}

export function buildMonths<E extends ExpenseLike>(
  settings: SplitSettings,
  rentRows: RentMonthLike[],
  expenses: E[],
  currentMonth: string,
): MonthView<E>[] {
  const rowByMonth = new Map(rentRows.map((r) => [r.month, r]))
  return splitMonths(settings.startMonth, currentMonth, expenses).map((month) => {
    const rent = month >= settings.startMonth ? rentBreakdown(settings, rowByMonth.get(month)) : null
    const items = expenses.filter((e) => e.date.startsWith(month))
    return { month, rent, expenses: items, balance: monthBalance(rent, items) }
  })
}

export function totalBalance(months: MonthView[]): SplitBalance {
  return {
    iOweAudrey: round2(months.reduce((s, m) => s + m.balance.iOweAudrey, 0)),
    vincentOwesAudrey: round2(months.reduce((s, m) => s + m.balance.vincentOwesAudrey, 0)),
  }
}
