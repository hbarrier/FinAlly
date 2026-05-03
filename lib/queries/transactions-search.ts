import { cache } from 'react'
import { db } from '@/lib/db'
import { transactions, transactionsFts } from '@/lib/schema'
import { and, desc, eq, gte, lt, or, sql } from 'drizzle-orm'
import type { Transaction } from '@/lib/db-types'

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

export type SearchPage = { items: Transaction[]; nextCursor: string | null }

export const searchMovementsFTS = cache(async ({
  q,
  from,
  to,
  cursor,
  limit = 50,
}: {
  q: string
  from: string
  to: string
  cursor?: string
  limit?: number
}): Promise<SearchPage> => {
  const trimmed = q.trim()
  if (!trimmed) return { items: [], nextCursor: null }

  const cursorObj = cursor ? decodeCursor(cursor) : null
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

  // Note: FTS5 MATCH expects the table name (or an alias) on the left side.
  const matchCond = sql`${transactionsFts} MATCH ${trimmed}`

  const rows = await db
    .select({ t: transactions })
    .from(transactions)
    .innerJoin(transactionsFts, eq(transactions.id, transactionsFts.transactionId))
    .where(and(gte(transactions.date, from), sql`${transactions.date} <= ${to}`, matchCond, cursorCond))
    .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
    .limit(limit + 1)

  const items = rows.slice(0, limit).map((r) => r.t) as unknown as Transaction[]
  const last = items[items.length - 1]
  const nextCursor =
    rows.length > limit && last
      ? encodeCursor({ date: last.date, createdAt: last.createdAt, id: last.id })
      : null

  return { items, nextCursor }
})

