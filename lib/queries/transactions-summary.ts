import { cache } from 'react'
import { db } from '@/lib/db'
import { categories, merchants, transactions } from '@/lib/schema'
import { and, desc, eq, gte, lt, or, sql } from 'drizzle-orm'
import type { Transaction } from '@/lib/db-types'

type DateRange = { from: string; to: string }

export type MonthTotal = {
  month: string // YYYY-MM
  net: number
  income: number
  expense: number
  count: number
}

export type FacetTotal = {
  id: string | null
  name: string | null
  net: number
  income: number
  expense: number
  count: number
}

const signedAmount = sql<number>`(case when ${transactions.kind} = 'income' then ${transactions.amount} else -${transactions.amount} end)`
const incomeAmount = sql<number>`(case when ${transactions.kind} = 'income' then ${transactions.amount} else 0 end)`
const expenseAmount = sql<number>`(case when ${transactions.kind} = 'expense' then ${transactions.amount} else 0 end)`

export type MovementsPage = {
  items: Transaction[]
  nextCursor: string | null
}

type MovementFilters = {
  from: string
  to: string
  merchantId?: string
  categoryId?: string
  limit?: number
  cursor?: string
}

type Cursor = { date: string; createdAt: string; id: string }

function encodeCursor(c: Cursor): string {
  const b64 = Buffer.from(JSON.stringify(c), 'utf8').toString('base64')
  return b64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const padded = raw.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((raw.length + 3) % 4)
    const json = Buffer.from(padded, 'base64').toString('utf8')
    const parsed = JSON.parse(json) as Cursor
    if (!parsed?.date || !parsed?.createdAt || !parsed?.id) return null
    return parsed
  } catch {
    return null
  }
}

export const getYearTotalsByMonth = cache(async ({ from, to }: DateRange): Promise<MonthTotal[]> => {
  const rows = await db
    .select({
      month: sql<string>`substr(${transactions.date}, 1, 7)`,
      net: sql<number>`sum(${signedAmount})`,
      income: sql<number>`sum(${incomeAmount})`,
      expense: sql<number>`sum(${expenseAmount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(sql`${transactions.date} >= ${from} and ${transactions.date} <= ${to}`)
    .groupBy(sql`substr(${transactions.date}, 1, 7)`)
    .orderBy(desc(sql`substr(${transactions.date}, 1, 7)`))

  return rows.map((r) => ({
    month: r.month,
    net: Number(r.net ?? 0),
    income: Number(r.income ?? 0),
    expense: Number(r.expense ?? 0),
    count: Number(r.count ?? 0),
  }))
})

export const getYearTotalsByMerchant = cache(async (
  { from, to }: DateRange,
  limit = 20,
): Promise<FacetTotal[]> => {
  const rows = await db
    .select({
      id: transactions.merchantId,
      name: merchants.name,
      net: sql<number>`sum(${signedAmount})`,
      income: sql<number>`sum(${incomeAmount})`,
      expense: sql<number>`sum(${expenseAmount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
    .where(sql`${transactions.date} >= ${from} and ${transactions.date} <= ${to}`)
    .groupBy(transactions.merchantId)
    .orderBy(desc(sql`sum(${expenseAmount})`))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    name: r.id ? r.name ?? null : 'No merchant',
    net: Number(r.net ?? 0),
    income: Number(r.income ?? 0),
    expense: Number(r.expense ?? 0),
    count: Number(r.count ?? 0),
  }))
})

export const getYearTotalsByCategory = cache(async (
  { from, to }: DateRange,
  limit = 20,
): Promise<FacetTotal[]> => {
  const rows = await db
    .select({
      id: transactions.categoryId,
      name: categories.name,
      net: sql<number>`sum(${signedAmount})`,
      income: sql<number>`sum(${incomeAmount})`,
      expense: sql<number>`sum(${expenseAmount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(sql`${transactions.date} >= ${from} and ${transactions.date} <= ${to}`)
    .groupBy(transactions.categoryId)
    .orderBy(desc(sql`sum(${expenseAmount})`))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    name: r.id ? r.name ?? null : 'Uncategorized',
    net: Number(r.net ?? 0),
    income: Number(r.income ?? 0),
    expense: Number(r.expense ?? 0),
    count: Number(r.count ?? 0),
  }))
})

export const getMovementsPage = cache(async ({
  from,
  to,
  merchantId,
  categoryId,
  limit = 50,
  cursor,
}: MovementFilters): Promise<MovementsPage> => {
  const cursorObj = cursor ? decodeCursor(cursor) : null

  const rangeCond = and(gte(transactions.date, from), sql`${transactions.date} <= ${to}`)
  const facetCond = and(
    merchantId ? eq(transactions.merchantId, merchantId) : undefined,
    categoryId ? eq(transactions.categoryId, categoryId) : undefined,
  )

  const cursorCond = cursorObj
    ? or(
        lt(transactions.date, cursorObj.date),
        and(eq(transactions.date, cursorObj.date), lt(transactions.createdAt, cursorObj.createdAt)),
        and(
          eq(transactions.date, cursorObj.date),
          eq(transactions.createdAt, cursorObj.createdAt),
          lt(transactions.id, cursorObj.id),
        ),
      )
    : undefined

  const items = await db.query.transactions.findMany({
    where: (t, { and }) => and(rangeCond, facetCond, cursorCond),
    orderBy: [desc(transactions.date), desc(transactions.createdAt), desc(transactions.id)],
    limit: limit + 1,
  })

  const pageItems = items.slice(0, limit) as unknown as Transaction[]
  const last = pageItems[pageItems.length - 1]
  const nextCursor =
    items.length > limit && last
      ? encodeCursor({ date: last.date, createdAt: last.createdAt, id: last.id })
      : null

  return { items: pageItems, nextCursor }
})

