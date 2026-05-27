import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Goals | FinAlly' }
import { GoalsClient } from './goals-client'

export default async function GoalsPage() {
  const goalsList = await db.query.goals.findMany()
  return <GoalsClient goals={goalsList} />
}
