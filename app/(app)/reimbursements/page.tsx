import { db } from '@/lib/db'
import { desc, eq } from 'drizzle-orm'
import { transactions, reimbursementRates, categories, merchants, reimbursementAllocations } from '@/lib/schema'
import {
  expenseReimbursementStatusLabel,
  getApplicableReimbursementRate,
  getExpenseReimbursementSummary,
  getIncomeReimbursementSummary,
  incomeReimbursementStatusLabel,
} from '@/lib/reimbursement-mapping'
import { indexReimbursementAllocations } from '@/lib/queries/reimbursement-allocations'
import { ReimbursementsClient } from './reimbursements-client'

export default async function ReimbursementsPage() {
  const [cats, rates, merchantsList, allocations, reimbursableExpenses] = await Promise.all([
    db.select().from(categories),
    db.select().from(reimbursementRates).orderBy(desc(reimbursementRates.startDate)),
    db.select().from(merchants).where(eq(merchants.isActive, 1)),
    db.select().from(reimbursementAllocations),
    db.select().from(transactions)
      .where(eq(transactions.reimbursable, 1))
      .orderBy(desc(transactions.date)),
  ])

  const { allocationsByReimbursementTxId, allocationsByExpenseTxId } =
    indexReimbursementAllocations(allocations)

  const reimbursementCategoryIds = cats
    .filter((category) => category.kind === 'income' && category.name === 'Remboursements')
    .map((category) => category.id)

  const reimbursementIncomes = reimbursementCategoryIds.length > 0
    ? await db.query.transactions.findMany({
        where: (t, { and, eq, inArray }) =>
          and(eq(t.kind, 'income'), inArray(t.categoryId, reimbursementCategoryIds)),
        orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      })
    : []

  const merchantById = new Map(merchantsList.map((merchant) => [merchant.id, merchant]))
  const categoryById = new Map(cats.map((category) => [category.id, category]))

  const incomeSummaries = reimbursementIncomes.map((income) => {
    const incomeAllocations = allocationsByReimbursementTxId.get(income.id) ?? []
    const summary = getIncomeReimbursementSummary(income, incomeAllocations)
    return {
      id: income.id,
      date: income.date,
      amount: income.amount,
      method: income.method,
      note: income.note,
      createdAt: income.createdAt,
      allocatedAmount: summary.allocatedAmount,
      unallocatedAmount: summary.unallocatedAmount,
      status: summary.status,
      label: incomeReimbursementStatusLabel(summary.status),
    }
  })

  const expenseSummaries = reimbursableExpenses.map((expense) => {
    const expenseAllocations = allocationsByExpenseTxId.get(expense.id) ?? []
    const summary = getExpenseReimbursementSummary(expense, rates, expenseAllocations)
    return {
      id: expense.id,
      date: expense.date,
      amount: expense.amount,
      merchantName: expense.merchantId ? merchantById.get(expense.merchantId)?.name ?? null : null,
      categoryName: expense.categoryId ? categoryById.get(expense.categoryId)?.name ?? null : null,
      manualSettlementAt: expense.manualSettlementAt,
      expectedAmount: summary.expectedAmount,
      allocatedAmount: summary.allocatedAmount,
      remainingExpectedAmount: summary.remainingExpectedAmount,
      status: summary.status,
      label: expenseReimbursementStatusLabel(summary.status),
    }
  })

  const mappingExpenses = reimbursableExpenses.map((expense) => {
    const expenseAllocations = allocationsByExpenseTxId.get(expense.id) ?? []
    const rate = getApplicableReimbursementRate(rates, expense.date)
    const summary = getExpenseReimbursementSummary(expense, rates, expenseAllocations)
    return {
      id: expense.id,
      date: expense.date,
      amount: expense.amount,
      categoryName: expense.categoryId ? categoryById.get(expense.categoryId)?.name ?? null : null,
      merchantName: expense.merchantId ? merchantById.get(expense.merchantId)?.name ?? null : null,
      manualSettlementAt: expense.manualSettlementAt,
      applicableRate: rate?.percent ?? null,
      expectedAmount: summary.expectedAmount,
      allocatedAmount: summary.allocatedAmount,
      remainingExpectedAmount: summary.remainingExpectedAmount,
      allocations: expenseAllocations.map((allocation) => ({
        reimbursementTxId: allocation.reimbursementTxId,
        amount: allocation.amount,
      })),
    }
  })

  return (
    <ReimbursementsClient
      incomes={incomeSummaries}
      expenses={expenseSummaries}
      mappingExpenses={mappingExpenses}
      rates={rates}
    />
  )
}
