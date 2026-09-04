import { and, gte, lt, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { monthlyOpeningBalances, transactions } from '@/lib/schema'

export async function getMonthOpeningBalance(input: {
  monthKey: string
  monthStart: string
  startingBalance: number
}): Promise<{ openingBalance: number; openingBalanceIsExplicit: boolean }> {
  const { monthKey, monthStart, startingBalance } = input

  const [explicitOpening, latestPriorOpening] = await Promise.all([
    db
      .select({ month: monthlyOpeningBalances.month, openingBalance: monthlyOpeningBalances.openingBalance })
      .from(monthlyOpeningBalances)
      .where(sql`${monthlyOpeningBalances.month} = ${monthKey}`)
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ month: monthlyOpeningBalances.month, openingBalance: monthlyOpeningBalances.openingBalance })
      .from(monthlyOpeningBalances)
      .where(sql`${monthlyOpeningBalances.month} < ${monthKey}`)
      .orderBy(desc(monthlyOpeningBalances.month))
      .limit(1)
      .then((rows) => rows[0]),
  ])

  if (explicitOpening) {
    return { openingBalance: Number(explicitOpening.openingBalance ?? 0), openingBalanceIsExplicit: true }
  }

  const deltaExpr = sql<number>`COALESCE(SUM(CASE
    WHEN ${transactions.kind} = 'income' THEN ${transactions.amount}
    WHEN ${transactions.kind} = 'expense' THEN -${transactions.amount}
    WHEN ${transactions.kind} = 'saving' AND ${transactions.destSavingAccountId} IS NULL THEN ${transactions.amount}
    WHEN ${transactions.kind} = 'saving' AND ${transactions.sourceSavingAccountId} IS NULL THEN -${transactions.amount}
    ELSE 0
  END), 0)`

  if (latestPriorOpening) {
    const priorStart = `${latestPriorOpening.month}-01`
    const deltaSincePrior = await db
      .select({ delta: deltaExpr })
      .from(transactions)
      .where(and(
        gte(transactions.date, priorStart),
        lt(transactions.date, monthStart),
      ))
      .then((rows) => rows[0]?.delta ?? 0)

    return {
      openingBalance: Number(latestPriorOpening.openingBalance ?? 0) + Number(deltaSincePrior ?? 0),
      openingBalanceIsExplicit: false,
    }
  }

  const deltaBeforeMonth = await db
    .select({ delta: deltaExpr })
    .from(transactions)
    .where(lt(transactions.date, monthStart))
    .then((rows) => rows[0]?.delta ?? 0)

  return {
    openingBalance: Number(startingBalance ?? 0) + Number(deltaBeforeMonth ?? 0),
    openingBalanceIsExplicit: false,
  }
}

