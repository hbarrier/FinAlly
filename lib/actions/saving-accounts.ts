'use server'

import { z } from 'zod'
import { db } from '../db'
import { savingAccounts } from '../schema'
import { nanoid } from '../utils'
import { eq } from 'drizzle-orm'
import { revalidateApp } from './_shared'
import { parse, zId, zName, zSignedAmount, zOptionalText } from '../schemas'
import { savingAccountHasTransfers } from '../queries/saving-accounts'

const savingAccountFields = z.object({
  name: zName,
  description: zOptionalText,
  startBalance: zSignedAmount,
})

export async function addSavingAccount(input: {
  name: string
  description?: string | null
  startBalance: number
}) {
  const data = parse(savingAccountFields, input)
  await db.insert(savingAccounts).values({
    id: nanoid(),
    name: data.name,
    description: data.description ?? null,
    startBalance: data.startBalance,
  })
  revalidateApp()
}

export async function updateSavingAccount(
  id: string,
  input: Partial<{ name: string; description: string | null; startBalance: number }>,
) {
  parse(zId, id)
  const data = parse(savingAccountFields.partial(), input)
  await db.update(savingAccounts).set(data).where(eq(savingAccounts.id, id))
  revalidateApp()
}

export async function deleteSavingAccount(id: string) {
  parse(zId, id)
  if (await savingAccountHasTransfers(id)) {
    throw new Error('This account has transfers recorded and cannot be deleted.')
  }
  await db.delete(savingAccounts).where(eq(savingAccounts.id, id))
  revalidateApp()
}
