import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getMerchantUsage } from '@/lib/queries/merchant-usage'
import { MerchantsClient } from './merchants-client'

export const metadata: Metadata = { title: 'Merchants | FinAlly' }

export default async function MerchantsPage() {
  const [merchantsList, cats, usage] = await Promise.all([
    db.query.merchants.findMany(),
    db.query.categories.findMany(),
    getMerchantUsage(),
  ])
  return <MerchantsClient merchants={merchantsList} categories={cats} usage={usage} />
}
