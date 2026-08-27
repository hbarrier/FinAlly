import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Simulations | FinAlly' }

import { SimulationsClient } from './simulations-client'
import { requireModule } from '@/lib/modules'
import { getModules } from '@/lib/queries/user-settings'

export default async function SimulationsPage() {
  await requireModule('simulations')
  const recurringEnabled = (await getModules()).recurring
  const simulations = await db.query.simulations.findMany({
    with: { lines: true },
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  })

  return <SimulationsClient simulations={simulations} recurringEnabled={recurringEnabled} />
}
