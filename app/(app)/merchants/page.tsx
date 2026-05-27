import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Merchants | FinAlly' }
import { MerchantsClient } from './merchants-client'

export default async function MerchantsPage() {
  const [merchantsList, cats, txns] = await Promise.all([
    db.query.merchants.findMany(),
    db.query.categories.findMany(),
    db.query.transactions.findMany({ columns: { id: true, merchantId: true } }),
  ])
  return <MerchantsClient merchants={merchantsList} categories={cats} transactions={txns} />
}
