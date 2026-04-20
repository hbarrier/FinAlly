'use server'

import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { goals } from '../schema'
import { nanoid } from '../utils'
import { eq } from 'drizzle-orm'

export async function addGoal(data: {
  name: string
  target: number
  saved?: number
  icon: string
  color: string
  deadline?: string | null
}) {
  await db.insert(goals).values({ id: nanoid(), saved: 0, ...data })
  revalidatePath('/', 'layout')
}

export async function updateGoal(
  id: string,
  data: Partial<{
    name: string
    target: number
    saved: number
    icon: string
    color: string
    deadline: string | null
  }>,
) {
  await db.update(goals).set(data).where(eq(goals.id, id))
  revalidatePath('/', 'layout')
}

export async function deleteGoal(id: string) {
  await db.delete(goals).where(eq(goals.id, id))
  revalidatePath('/', 'layout')
}
