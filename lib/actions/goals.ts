'use server'

import { z } from 'zod'
import { revalidateApp } from './_shared'
import { db } from '../db'
import { goals } from '../schema'
import { nanoid } from '../utils'
import { eq } from 'drizzle-orm'
import { parse, zId, zName, zAmount, zSignedAmount, zDateISO } from '../schemas'

const goalFields = z.object({
  name: zName,
  target: zAmount,
  saved: zSignedAmount.optional(),
  icon: z.string().min(1),
  color: z.string().min(1),
  deadline: zDateISO.nullable().optional(),
})

export async function addGoal(input: {
  name: string
  target: number
  saved?: number
  icon: string
  color: string
  deadline?: string | null
}) {
  const data = parse(goalFields, input)
  await db.insert(goals).values({ id: nanoid(), saved: 0, ...data })
  revalidateApp()
}

export async function updateGoal(
  id: string,
  input: Partial<{
    name: string
    target: number
    saved: number
    icon: string
    color: string
    deadline: string | null
  }>,
) {
  parse(zId, id)
  const data = parse(goalFields.partial(), input)
  await db.update(goals).set(data).where(eq(goals.id, id))
  revalidateApp()
}

export async function deleteGoal(id: string) {
  parse(zId, id)
  await db.delete(goals).where(eq(goals.id, id))
  revalidateApp()
}
