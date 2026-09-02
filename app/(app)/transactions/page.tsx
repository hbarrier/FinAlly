import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Transactions | FinAlly' }
import { asc, desc, eq, sql, and, gte, lte } from 'drizzle-orm'
import { transactions, merchants, recurringAmounts, recurringInstances } from '@/lib/schema'
import { getMovementGroupLinks, getGroupList } from '@/lib/queries/groups'
import { TransactionsClient } from './transactions-client'
import { getModules } from '@/lib/queries/user-settings'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string
    months?: string
    merchant?: string
  }>
}) {
  const { year, months, merchant } = await searchParams
  const modules = await getModules()

  const currentYear = new Date().getFullYear()
  const selectedYear = year ? parseInt(year, 10) : currentYear
  const yearStart = `${selectedYear}-01-01`
  const yearEnd = `${selectedYear}-12-31`

  const initialMonths = Math.max(1, Math.min(12, months ? parseInt(months, 10) || 2 : 2))

  // How far into the future planned (future-dated) transactions reach, capped 12 months out.
  const [{ maxDate }] = await db
    .select({ maxDate: sql<string | null>`max(${transactions.date})` })
    .from(transactions)
  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const horizonCap = new Date()
  horizonCap.setUTCMonth(horizonCap.getUTCMonth() + 12)
  const horizonCapStr = horizonCap.toISOString().slice(0, 7)
  const plannedHorizon =
    maxDate && maxDate.slice(0, 7) > currentMonthStr
      ? (maxDate.slice(0, 7) < horizonCapStr ? maxDate.slice(0, 7) : horizonCapStr)
      : currentMonthStr

  const endMonth =
    selectedYear < currentYear
      ? `${selectedYear}-12`
      : selectedYear > currentYear
        ? (plannedHorizon >= `${selectedYear}-01`
            ? (plannedHorizon < `${selectedYear}-12` ? plannedHorizon : `${selectedYear}-12`)
            : `${selectedYear}-01`)
        : (plannedHorizon < `${currentYear}-12` ? plannedHorizon : `${currentYear}-12`)

  // Anchor the start of the window on the current month (not the planned-future horizon),
  // so the default view always includes the most recent real months.
  const anchorMonth =
    selectedYear < currentYear
      ? endMonth
      : currentMonthStr < endMonth
        ? currentMonthStr
        : endMonth
  const startMonthDate = new Date(anchorMonth + '-15T12:00:00Z')
  startMonthDate.setUTCMonth(startMonthDate.getUTCMonth() - (initialMonths - 1))
  if (startMonthDate.getUTCFullYear() < selectedYear) startMonthDate.setUTCFullYear(selectedYear, 0, 15)

  const startMonth = `${startMonthDate.getUTCFullYear()}-${String(startMonthDate.getUTCMonth() + 1).padStart(2, '0')}`
  const timelineFrom = `${startMonth}-01`
  const [endYear, endMonthNum] = endMonth.split('-').map(Number)
  const lastDay = new Date(endYear, endMonthNum, 0).getDate()
  const timelineTo = `${endMonth}-${String(lastDay).padStart(2, '0')}`

  const [
    cats,
    merchantsList,
    recurringList,
    instancesList,
    yearsResult,
    budget,
  ] = await Promise.all([
    db.query.categories.findMany(),
    db.query.merchants.findMany({ where: eq(merchants.isActive, 1) }),
    modules.recurring
      ? db.query.recurring.findMany({
          with: { amounts: { orderBy: [asc(recurringAmounts.startDate)] } },
        })
      : Promise.resolve([]),
    modules.recurring
      ? db.select().from(recurringInstances).where(
          and(
            gte(recurringInstances.month, `${selectedYear}-01`),
            lte(recurringInstances.month, `${selectedYear}-12`),
          )
        )
      : Promise.resolve([]),
    db.select({ year: sql<string>`substr(${transactions.date}, 1, 4)` })
      .from(transactions)
      .groupBy(sql`substr(${transactions.date}, 1, 4)`)
      .orderBy(sql`substr(${transactions.date}, 1, 4) DESC`),
    modules.budgets
      ? db.query.budgets.findFirst({ with: { lines: true } })
      : Promise.resolve(undefined),
  ])

  // When a merchant filter is active, load the full year for that merchant.
  // Otherwise load the windowed timeline (last N months).
  const txns = merchant
    ? await db.query.transactions.findMany({
        where: (t, { and, gte, lte, eq }) =>
          and(gte(t.date, yearStart), lte(t.date, yearEnd), eq(t.merchantId, merchant)),
        orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      })
    : await db.query.transactions.findMany({
        where: (t, { and, gte, lte }) => and(gte(t.date, timelineFrom), lte(t.date, timelineTo)),
        orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      })

  const years = yearsResult.map((r) => r.year)
  const merchantById = new Map(merchantsList.map((m) => [m.id, m]))
  const categoryById = new Map(cats.map((c) => [c.id, c]))

  const [movementLinks, activeGroups] = modules.groups
    ? await Promise.all([
        getMovementGroupLinks(txns.map((t) => t.id)),
        getGroupList().then((gs) => gs.filter((g) => g.isActive === 1)),
      ])
    : [{}, []]

  return (
    <TransactionsClient
      transactions={txns}
      categories={cats}
      merchants={merchantsList}
      recurring={recurringList}
      instances={instancesList}
      groups={activeGroups}
      movementLinks={movementLinks}
      recurringEnabled={modules.recurring}
      groupsEnabled={modules.groups}
      budgetEnabled={modules.budgets}
      budget={budget ?? null}
      initialMerchantId={merchant ?? 'all'}
      selectedYear={selectedYear}
      years={years}
      initialMonths={merchant ? 12 : initialMonths}
    />
  )
}
