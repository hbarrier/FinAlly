import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Goals | FinAlly' }
import { GoalsClient } from './goals-client'
import { requireModule } from '@/lib/modules'

export default async function GoalsPage() {
  await requireModule('objectives')
  const goalsList = await db.query.goals.findMany()
  return <GoalsClient goals={goalsList} />
}
