import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Reimbursements | FinAlly' }
import { desc, eq, and, gte, lte, sql, inArray } from 'drizzle-orm'
import {
  transactions,
  reimbursementRates,
  categories,
  merchants,
  reimbursementClaims,
  reimbursementClaimAllocations,
  taxAllocations,
} from '@/lib/schema'
import { getApplicableReimbursementRate } from '@/lib/reimbursement-mapping'
import { REIMBURSEMENT_CATEGORY_NAME } from '@/lib/utils'
import { ReimbursementsClient } from './reimbursements-client'
import { requireModule } from '@/lib/modules'

export default async function ReimbursementsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  await requireModule('groups')
  const { year: yearParam } = await searchParams
  const year = Number(yearParam) || new Date().getFullYear()
  const from = `${year}-01-01`
  const to = `${year}-12-31`

  const [rates, cats, merchantsList, expenses, claims, allClaimAllocations, taxAllocRows] = await Promise.all([
    db.select().from(reimbursementRates).orderBy(desc(reimbursementRates.startDate)),
    db.select().from(categories),
    db.select().from(merchants).where(eq(merchants.isActive, 1)),
    db.select().from(transactions).where(
      and(eq(transactions.reimbursable, 1), gte(transactions.date, from), lte(transactions.date, to)),
    ).orderBy(transactions.date),
    db.select().from(reimbursementClaims).where(
      and(gte(reimbursementClaims.month, `${year}-01`), lte(reimbursementClaims.month, `${year}-12`)),
    ),
    db.select({ claimId: reimbursementClaimAllocations.claimId, reimbursementTxId: reimbursementClaimAllocations.reimbursementTxId })
      .from(reimbursementClaimAllocations)
      .innerJoin(reimbursementClaims, eq(reimbursementClaimAllocations.claimId, reimbursementClaims.id))
      .where(and(gte(reimbursementClaims.month, `${year}-01`), lte(reimbursementClaims.month, `${year}-12`))),
    db.select().from(taxAllocations),
  ])

  // Available years from reimbursable expenses
  const yearsRows = await db
    .selectDistinct({ year: sql<string>`substr(${transactions.date}, 1, 4)` })
    .from(transactions)
    .where(eq(transactions.reimbursable, 1))
    .orderBy(sql`substr(${transactions.date}, 1, 4) DESC`)
  const years = yearsRows.map((r) => r.year)

  // Fetch all cleared Remboursements income transactions (for the picker)
  const reimbCatIds = cats
    .filter((c) => c.kind === 'income' && c.name === REIMBURSEMENT_CATEGORY_NAME)
    .map((c) => c.id)
  const eligibleIncomes = reimbCatIds.length > 0
    ? await db.select().from(transactions).where(
        and(
          eq(transactions.kind, 'income'),
          eq(transactions.cleared, 1),
          inArray(transactions.categoryId, reimbCatIds),
        ),
      ).orderBy(transactions.date)
    : []

  // Index claim allocations by claimId and by reimbursementTxId
  const allocationsByClaimId = new Map<string, string[]>() // claimId → reimbursementTxIds
  const claimedTxToClaimId = new Map<string, string>() // reimbursementTxId → claimId
  for (const a of allClaimAllocations) {
    const list = allocationsByClaimId.get(a.claimId) ?? []
    list.push(a.reimbursementTxId)
    allocationsByClaimId.set(a.claimId, list)
    claimedTxToClaimId.set(a.reimbursementTxId, a.claimId)
  }

  const claimByMonth = new Map(claims.map((c) => [c.month, c]))
  const merchantById = new Map(merchantsList.map((m) => [m.id, m]))
  const categoryById = new Map(cats.map((c) => [c.id, c]))
  const taxAllocByTxId = new Map(taxAllocRows.map((r) => [r.transactionId, r.allocation]))

  // Group expenses by month
  const expensesByMonth = new Map<string, typeof expenses>()
  for (const expense of expenses) {
    const month = expense.date.slice(0, 7)
    const list = expensesByMonth.get(month) ?? []
    list.push(expense)
    expensesByMonth.set(month, list)
  }

  // Build month data
  const months = [...expensesByMonth.keys()].sort()

  const monthData = months.map((month) => {
    const monthExpenses = expensesByMonth.get(month) ?? []
    const claim = claimByMonth.get(month) ?? null
    const linkedTxIds = claim ? (allocationsByClaimId.get(claim.id) ?? []) : []

    return {
      month,
      claim,
      expenses: monthExpenses.map((e) => ({
        id: e.id,
        date: e.date,
        amount: e.amount,
        cleared: e.cleared,
        categoryId: e.categoryId,
        categoryName: e.categoryId ? (categoryById.get(e.categoryId)?.name ?? null) : null,
        categoryIcon: e.categoryId ? (categoryById.get(e.categoryId)?.icon ?? null) : null,
        categoryColor: e.categoryId ? (categoryById.get(e.categoryId)?.color ?? null) : null,
        merchantName: e.merchantId ? (merchantById.get(e.merchantId)?.name ?? null) : null,
        note: e.note,
        rate: getApplicableReimbursementRate(rates, e.date)?.percent ?? null,
        reimbursementAmountOverride: e.reimbursementAmountOverride,
        reimbursementComment: e.reimbursementComment,
        taxAllocation: taxAllocByTxId.get(e.id) ?? null,
      })),
      linkedIncomes: eligibleIncomes
        .filter((inc) => linkedTxIds.includes(inc.id))
        .map((inc) => ({
          reimbursementTxId: inc.id,
          date: inc.date,
          amount: inc.amount,
          note: inc.note,
        })),
    }
  })

  // Eligible incomes for the picker: all cleared Remboursements incomes,
  // with flag indicating which claim month they're already linked to
  const pickerIncomes = eligibleIncomes.map((inc) => ({
    id: inc.id,
    date: inc.date,
    amount: inc.amount,
    note: inc.note,
    claimedByMonth: claimedTxToClaimId.has(inc.id)
      ? claims.find((c) => c.id === claimedTxToClaimId.get(inc.id))?.month ?? null
      : null,
  }))

  return (
    <ReimbursementsClient
      monthData={monthData}
      pickerIncomes={pickerIncomes}
      rates={rates}
      years={years}
      selectedYear={year}
    />
  )
}
