import { db } from '@/lib/db'
import { desc, eq } from 'drizzle-orm'
import { transactions, merchants } from '@/lib/schema'
import { TransactionsClient } from './transactions-client'

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ merchant?: string }> }) {
  const { merchant } = await searchParams
  const [txns, cats, merchantsList, recurringList] = await Promise.all([
    db.query.transactions.findMany({ orderBy: [desc(transactions.date), desc(transactions.createdAt)] }),
    db.query.categories.findMany(),
    db.query.merchants.findMany(),
    db.query.recurring.findMany(),
  ])

  return <TransactionsClient transactions={txns} categories={cats} merchants={merchantsList} recurring={recurringList} initialMerchantId={merchant ?? 'all'} />
}
