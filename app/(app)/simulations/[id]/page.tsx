import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { simulations } from '@/lib/schema'
import { getModules } from '@/lib/queries/user-settings'
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

  const modules = await getModules()
  const recurringEnabled = modules.recurring
  const budgetsEnabled = modules.budgets

  const [simulation, cats, merchantsList, recurringItems, allTxns] = await Promise.all([
    db.query.simulations.findFirst({ where: eq(simulations.id, id), with: { lines: true } }),
    db.query.categories.findMany(),
    db.query.merchants.findMany(),
    recurringEnabled ? db.query.recurring.findMany() : Promise.resolve([]),
    db.query.transactions.findMany(),
  ])

  if (!simulation) notFound()

  return (
    <SimulationDetailClient
      simulation={simulation}
      categories={cats}
      merchants={merchantsList}
      recurringOptions={recurringItems}
      recurringEnabled={recurringEnabled}
      budgetsEnabled={budgetsEnabled}
      transactions={allTxns}
    />
  )
}
