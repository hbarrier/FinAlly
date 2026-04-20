import { db } from '@/lib/db'
import { GoalsClient } from './goals-client'

export default async function GoalsPage() {
  const goalsList = await db.query.goals.findMany()
  return <GoalsClient goals={goalsList} />
}
