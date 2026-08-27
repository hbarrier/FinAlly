import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { simulations } from '@/lib/schema'
import { getUserSettings, getModules } from '@/lib/queries/user-settings'
import { requireModule } from '@/lib/modules'
import { SimulationDetailClient } from './simulation-detail-client'

export const metadata: Metadata = { title: 'Simulation | FinAlly' }

export default async function SimulationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule('simulations')
  const { id } = await params

  const recurringEnabled = (await getModules()).recurring

  const [simulation, cats, merchantsList, recurringItems, settings, allTxns] = await Promise.all([
    db.query.simulations.findFirst({ where: eq(simulations.id, id), with: { lines: true } }),
    db.query.categories.findMany(),
    db.query.merchants.findMany(),
    recurringEnabled ? db.query.recurring.findMany() : Promise.resolve([]),
    getUserSettings(),
    db.query.transactions.findMany(),
  ])

  if (!simulation) notFound()

  const startingBalance = Number(settings?.startingBalance ?? 0)

  return (
    <SimulationDetailClient
      simulation={simulation}
      categories={cats}
      merchants={merchantsList}
      recurringOptions={recurringItems}
      recurringEnabled={recurringEnabled}
      startingBalance={startingBalance}
      transactions={allTxns}
    />
  )
}
