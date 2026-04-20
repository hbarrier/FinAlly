import { db } from '@/lib/db'
import { asc } from 'drizzle-orm'
import { recurringAmounts } from '@/lib/schema'
import { RecurringClient } from './recurring-client'

export default async function RecurringPage() {
  const [recurringItems, cats] = await Promise.all([
    db.query.recurring.findMany({
      with: { amounts: { orderBy: [asc(recurringAmounts.startDate)] } },
    }),
    db.query.categories.findMany(),
  ])
  return <RecurringClient recurring={recurringItems} categories={cats} />
}
