import type { Metadata } from 'next'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { divorceSplitEntries, divorceSplitRentMonths, divorceSplitSettings } from '@/lib/schema'
import { requireModule } from '@/lib/modules'
import { currentMonth } from '@/lib/dates'
import { CostSplitClient } from './cost-split-client'

export const metadata: Metadata = { title: 'Cost split | FinAlly' }

export default async function CostSplitPage() {
  await requireModule('divorce')
  const [[settings], rentRows, entries] = await Promise.all([
    db.select().from(divorceSplitSettings),
    db.select().from(divorceSplitRentMonths),
    db.select().from(divorceSplitEntries).orderBy(desc(divorceSplitEntries.date), desc(divorceSplitEntries.createdAt)),
  ])
  return <CostSplitClient settings={settings} rentRows={rentRows} entries={entries} currentMonth={currentMonth()} />
}
