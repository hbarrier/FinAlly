import { db } from '@/lib/db'
import { desc, eq, sql } from 'drizzle-orm'
import { transactions, merchants, reimbursementAllocations, reimbursementRates } from '@/lib/schema'
import {
  expenseReimbursementStatusLabel,
  getApplicableReimbursementRate,
  getExpenseReimbursementSummary,
  getIncomeReimbursementSummary,
  incomeReimbursementStatusLabel,
} from '@/lib/reimbursement-mapping'
import { indexReimbursementAllocations } from '@/lib/queries/reimbursement-allocations'
import { TransactionsClient } from './transactions-client'

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ merchant?: string; year?: string }> }) {
  const { merchant, year } = await searchParams

  const currentYear = new Date().getFullYear()
  const selectedYear = year ? parseInt(year, 10) : currentYear
  const yearStart = `${selectedYear}-01-01`
  const yearEnd = `${selectedYear}-12-31`

  const [
    txns,
    cats,
    merchantsList,
    recurringList,
    yearsResult,
    rates,
    allocations,
    reimbursableExpenses,
  ] = await Promise.all([
    db.query.transactions.findMany({
      where: (t, { and, gte, lte }) => and(gte(t.date, yearStart), lte(t.date, yearEnd)),
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    }),
    db.query.categories.findMany(),
    db.query.merchants.findMany({ where: eq(merchants.isActive, 1) }),
    db.query.recurring.findMany(),
    db.select({ year: sql<string>`substr(${transactions.date}, 1, 4)` })
      .from(transactions)
      .groupBy(sql`substr(${transactions.date}, 1, 4)`)
      .orderBy(sql`substr(${transactions.date}, 1, 4) DESC`),
    db.select().from(reimbursementRates).orderBy(desc(reimbursementRates.startDate)),
    db.select().from(reimbursementAllocations),
    db.query.transactions.findMany({
      where: (t, { and, eq }) => and(eq(t.kind, 'expense'), eq(t.reimbursable, 1)),
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    }),
  ])

  const years = yearsResult.map((r) => r.year)
  const reimbursementCategoryIds = new Set(
    cats
      .filter((c) => c.kind === 'income' && c.name === 'Remboursements')
      .map((c) => c.id),
  )
  const merchantById = new Map(merchantsList.map((merchant) => [merchant.id, merchant]))
  const categoryById = new Map(cats.map((category) => [category.id, category]))

  const { allocationsByReimbursementTxId, allocationsByExpenseTxId } =
    indexReimbursementAllocations(allocations)

  const reimbursementSummaries: Record<string, { status: string; label: string }> = {}
  const reimbursementMappingCounts: Record<string, number> = {}
  for (const allocation of allocations) {
    reimbursementMappingCounts[allocation.reimbursementTxId] =
      (reimbursementMappingCounts[allocation.reimbursementTxId] ?? 0) + 1
    reimbursementMappingCounts[allocation.expenseTxId] =
      (reimbursementMappingCounts[allocation.expenseTxId] ?? 0) + 1
  }

  for (const txn of txns) {
    if (txn.kind === 'income' && txn.categoryId && reimbursementCategoryIds.has(txn.categoryId)) {
      const summary = getIncomeReimbursementSummary(
        txn,
        allocationsByReimbursementTxId.get(txn.id) ?? [],
      )
      const status = summary.status
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

  const eligibleReimbursementExpenses = reimbursableExpenses.map((expense) => {
    const expenseAllocations = allocationsByExpenseTxId.get(expense.id) ?? []
    const rate = getApplicableReimbursementRate(rates, expense.date)
    const reimbursementSummary = getExpenseReimbursementSummary(expense, rates, expenseAllocations)
    return {
      id: expense.id,
      date: expense.date,
      amount: expense.amount,
      categoryName: expense.categoryId ? categoryById.get(expense.categoryId)?.name ?? null : null,
      merchantName: expense.merchantId ? merchantById.get(expense.merchantId)?.name ?? null : null,
      manualSettlementAt: expense.manualSettlementAt,
      applicableRate: rate?.percent ?? null,
      expectedAmount: reimbursementSummary.expectedAmount,
      allocatedAmount: reimbursementSummary.allocatedAmount,
      remainingExpectedAmount: reimbursementSummary.remainingExpectedAmount,
      allocations: expenseAllocations.map((allocation) => ({
        reimbursementTxId: allocation.reimbursementTxId,
        amount: allocation.amount,
      })),
    }
  })

  return (
    <TransactionsClient
      transactions={txns}
      categories={cats}
      merchants={merchantsList}
      recurring={recurringList}
      eligibleReimbursementExpenses={eligibleReimbursementExpenses}
      reimbursementSummaries={reimbursementSummaries}
      reimbursementMappingCounts={reimbursementMappingCounts}
      initialMerchantId={merchant ?? 'all'}
      selectedYear={selectedYear}
      years={years}
    />
  )
}
