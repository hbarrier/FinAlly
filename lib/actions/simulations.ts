'use server'

import { revalidateApp } from './_shared'
import { db } from '../db'
import { simulations, simulationLines, recurring } from '../schema'
import { nanoid } from '../utils'
import { eq, and, or, isNull, gte, ne } from 'drizzle-orm'

export async function addSimulation(data: {
  name: string
  description: string | null
}): Promise<{ id: string }> {
  const id = nanoid()
  await db.insert(simulations).values({
    id,
    name: data.name,
    description: data.description,
  })
  revalidateApp()
  return { id }
}

export async function updateSimulation(
  id: string,
  data: Partial<{ name: string; description: string | null }>,
) {
  await db.update(simulations).set(data).where(eq(simulations.id, id))
  revalidateApp()
}

export async function deleteSimulation(id: string) {
  await db.delete(simulations).where(eq(simulations.id, id))
  revalidateApp()
}

export async function addSimulationLine(
  simulationId: string,
  data: {
    name: string | null
    kind: 'expense' | 'income'
    categoryId: string | null
    merchantId: string | null
    amount: number
    frequency: 'monthly' | 'yearly'
    sourceRecurringId?: string | null
  },
) {
  await db.insert(simulationLines).values({
    id: nanoid(),
    simulationId,
    name: data.name,
    kind: data.kind,
    categoryId: data.categoryId,
    merchantId: data.merchantId,
    amount: data.amount,
    frequency: data.frequency,
    sourceRecurringId: data.sourceRecurringId ?? null,
  })
  revalidateApp()
}

export async function updateSimulationLine(
  id: string,
  data: Partial<{
    name: string | null
    kind: 'expense' | 'income'
    categoryId: string | null
    merchantId: string | null
    amount: number
    frequency: 'monthly' | 'yearly'
  }>,
) {
  await db.update(simulationLines).set(data).where(eq(simulationLines.id, id))
  revalidateApp()
}

export async function deleteSimulationLine(id: string) {
  await db.delete(simulationLines).where(eq(simulationLines.id, id))
  revalidateApp()
}

export async function bulkAddSimulationLinesFromRecurring(simulationId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const activeRecurring = await db
    .select()
    .from(recurring)
    .where(
      and(
        ne(recurring.cadence, 'weekly'),
        or(isNull(recurring.endDate), gte(recurring.endDate, today)),
      ),
    )

  if (activeRecurring.length === 0) {
    revalidateApp()
    return
  }

  await db.insert(simulationLines).values(
    activeRecurring.map((r) => ({
      id: nanoid(),
      simulationId,
      name: r.name,
      kind: r.kind,
      categoryId: r.categoryId,
      merchantId: r.merchantId,
      amount: r.amount,
      frequency: r.cadence as 'monthly' | 'yearly',
      sourceRecurringId: r.id,
    })),
  )
  revalidateApp()
}

export async function duplicateSimulation(id: string): Promise<{ id: string }> {
  const newId = await db.transaction(async (tx) => {
    const original = await tx.query.simulations.findFirst({
      where: eq(simulations.id, id),
      with: { lines: true },
    })
    if (!original) throw new Error('Simulation not found')

    const newId = nanoid()
    await tx.insert(simulations).values({
      id: newId,
      name: `${original.name} (copy)`,
      description: original.description,
    })

    if (original.lines.length > 0) {
      await tx.insert(simulationLines).values(
        original.lines.map((l) => ({
          id: nanoid(),
          simulationId: newId,
          name: l.name,
          kind: l.kind,
          categoryId: l.categoryId,
          merchantId: l.merchantId,
          amount: l.amount,
          frequency: l.frequency,
          sourceRecurringId: l.sourceRecurringId,
        })),
      )
    }

    return newId
  })

  revalidateApp()
  return { id: newId }
}
