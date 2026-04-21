import { db } from '@/lib/db'
import { desc, eq } from 'drizzle-orm'
import { transactions, reimbursementRates, categories } from '@/lib/schema'
import { ReimbursementsClient } from './reimbursements-client'

export default async function ReimbursementsPage() {
  const [reimbursableExpenses, pensionCats, rates, merchants] = await Promise.all([
    db.select().from(transactions)
      .where(eq(transactions.reimbursable, 1))
      .orderBy(desc(transactions.date)),
    db.select().from(categories).where(eq(categories.isPensionAlimentaire, 1)),
    db.select().from(reimbursementRates).orderBy(desc(reimbursementRates.startDate)),
    db.query.merchants.findMany(),
  ])

  // Fetch reimbursement income txs
  const reimbursementTxIds = reimbursableExpenses
    .map((e) => e.reimbursementTxId)
    .filter((id): id is string => id != null)

  const reimbursementTxs = reimbursementTxIds.length > 0
    ? await db.query.transactions.findMany({
        where: (t, { inArray }) => inArray(t.id, reimbursementTxIds),
      })
    : []

  // Pension alimentaire income transactions
  const pensionCatIds = pensionCats.map((c) => c.id)
  const pensionTxs = pensionCatIds.length > 0
    ? await db.query.transactions.findMany({
        where: (t, { and, inArray, eq }) =>
          and(eq(t.kind, 'income'), inArray(t.categoryId, pensionCatIds)),
        orderBy: [desc(transactions.date)],
      })
    : []

  // Find applicable rate for each expense
  function getRate(expenseDate: string): number | null {
    const applicable = rates.filter((r) => r.startDate <= expenseDate)
    if (applicable.length === 0) return null
    return applicable[0].percent
  }

  const expenses = reimbursableExpenses.map((e) => {
    const reimbTx = e.reimbursementTxId
      ? reimbursementTxs.find((t) => t.id === e.reimbursementTxId) ?? null
      : null
    const merchant = e.merchantId ? merchants.find((m) => m.id === e.merchantId) : null
    return {
      id: e.id,
      date: e.date,
      amount: e.amount,
      merchantName: merchant?.name ?? null,
      reimbursementTxId: e.reimbursementTxId ?? null,
      claimedDate: e.claimedDate ?? null,
      reimbursement: reimbTx
        ? { date: reimbTx.date, amount: reimbTx.amount }
        : null,
      applicableRate: getRate(e.date),
    }
  })

  return (
    <ReimbursementsClient
      expenses={expenses}
      pensionTxs={pensionTxs}
      rates={rates}
    />
  )
}
