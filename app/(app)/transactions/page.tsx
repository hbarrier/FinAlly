import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Transactions | FinAlly' }
import { asc, desc, eq, sql, and, gte, lte } from 'drizzle-orm'
import { transactions, merchants, reimbursementAllocations, reimbursementClaimAllocations, reimbursementRates, recurringAmounts, recurringInstances } from '@/lib/schema'
import {
  expenseReimbursementStatusLabel,
  getExpenseReimbursementSummary,
  getIncomeReimbursementSummary,
  incomeReimbursementStatusLabel,
} from '@/lib/reimbursement-mapping'
import { indexReimbursementAllocations } from '@/lib/queries/reimbursement-allocations'
import { TransactionsClient } from './transactions-client'
import { REIMBURSEMENT_CATEGORY_NAME } from '@/lib/utils'
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

  const endMonth =
    selectedYear < currentYear
      ? `${selectedYear}-12`
      : selectedYear > currentYear
        ? `${selectedYear}-01`
        : new Date().toISOString().slice(0, 7)

  const endMonthDate = new Date(endMonth + '-15T12:00:00Z')
  const startMonthDate = new Date(endMonthDate)
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
    rates,
    allocations,
    claimAllocationRows,
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
    modules.divorce
      ? db.select().from(reimbursementRates).orderBy(desc(reimbursementRates.startDate))
      : Promise.resolve([]),
    modules.divorce
      ? db.select().from(reimbursementAllocations).where(
          and(gte(reimbursementAllocations.createdAt, yearStart), lte(reimbursementAllocations.createdAt, yearEnd + 'T23:59:59Z'))
        )
      : Promise.resolve([]),
    modules.divorce
      ? db.select({ reimbursementTxId: reimbursementClaimAllocations.reimbursementTxId }).from(reimbursementClaimAllocations)
      : Promise.resolve([]),
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
  const reimbursementCategoryIds = new Set(
    cats
      .filter((c) => c.kind === 'income' && c.name === REIMBURSEMENT_CATEGORY_NAME)
      .map((c) => c.id),
  )
  const merchantById = new Map(merchantsList.map((m) => [m.id, m]))
  const categoryById = new Map(cats.map((c) => [c.id, c]))

  const { allocationsByReimbursementTxId, allocationsByExpenseTxId } =
    indexReimbursementAllocations(allocations)

  const claimedIncomeTxIds = new Set(claimAllocationRows.map((r) => r.reimbursementTxId))

  const reimbursementSummaries: Record<string, { status: string; label: string }> = {}
  const reimbursementMappingCounts: Record<string, number> = {}
  for (const allocation of allocations) {
    reimbursementMappingCounts[allocation.reimbursementTxId] =
      (reimbursementMappingCounts[allocation.reimbursementTxId] ?? 0) + 1
    reimbursementMappingCounts[allocation.expenseTxId] =
      (reimbursementMappingCounts[allocation.expenseTxId] ?? 0) + 1
  }

  for (const txn of modules.divorce ? txns : []) {
    if (txn.kind === 'income' && txn.categoryId && reimbursementCategoryIds.has(txn.categoryId)) {
      const summary = getIncomeReimbursementSummary(
        txn,
        allocationsByReimbursementTxId.get(txn.id) ?? [],
      )
      const status = summary.status === 'unmapped' && claimedIncomeTxIds.has(txn.id)
        ? 'claim_linked' as const
        : summary.status
      reimbursementSummaries[txn.id] = { status, label: incomeReimbursementStatusLabel(status) }
    }

    if (txn.kind === 'expense' && txn.reimbursable === 1) {
      const summary = getExpenseReimbursementSummary(
        txn,
        rates,
        allocationsByExpenseTxId.get(txn.id) ?? [],
      )
      const status = summary.status
      reimbursementSummaries[txn.id] = { status, label: expenseReimbursementStatusLabel(status) }
    }
  }

  return (
    <TransactionsClient
      transactions={txns}
      categories={cats}
      merchants={merchantsList}
      recurring={recurringList}
      instances={instancesList}
      reimbursementSummaries={reimbursementSummaries}
      reimbursementMappingCounts={reimbursementMappingCounts}
      recurringEnabled={modules.recurring}
      divorceEnabled={modules.divorce}
      initialMerchantId={merchant ?? 'all'}
      selectedYear={selectedYear}
      years={years}
      initialMonths={merchant ? 12 : initialMonths}
    />
  )
}
