'use server'

import { revalidatePath } from 'next/cache'
import { db } from '../db'
import { userSettings } from '../schema'
import { eq } from 'drizzle-orm'

export async function updateSettings(data: Partial<{
  name: string
  startingBalance: number
  currency: string
}>) {
  await db.update(userSettings).set(data).where(eq(userSettings.id, 1))
  revalidatePath('/', 'layout')
}
