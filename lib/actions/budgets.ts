'use server'

import { z } from 'zod'
import { revalidateApp } from './_shared'
import { db } from '../db'
import { budgets, budgetLines, simulations } from '../schema'
import { nanoid } from '../utils'
import { eq } from 'drizzle-orm'
import { parse, zId, zName, zKind, zAmount, zFrequency, zNullableId } from '../schemas'

type BudgetLineInput = {
  name: string | null
  kind: 'expense' | 'income'
  categoryId: string
  merchantId: string | null
  amount: number
  frequency: 'monthly' | 'yearly'
  recurring: boolean
}

const budgetMetaSchema = z.object({
  name: zName,
  description: z.string().nullable(),
})

const budgetLineSchema = z.object({
  name: z.string().nullable(),
  kind: zKind,
  categoryId: zId,
  merchantId: zNullableId,
  amount: zAmount,
  frequency: zFrequency,
  recurring: z.boolean(),
})

/** Creates the single budget, replacing any existing one (lines cascade). */
export async function createBudget(input: {
  name: string
  description: string | null
}): Promise<{ id: string }> {
  const data = parse(budgetMetaSchema, input)
  const id = nanoid()
  await db.transaction(async (tx) => {
    await tx.delete(budgets)
    await tx.insert(budgets).values({
      id,
      name: data.name,
      description: data.description,
      isActive: 1,
    })
  })
  revalidateApp()
  return { id }
}

export async function updateBudget(
  id: string,
  input: Partial<{ name: string; description: string | null }>,
) {
  parse(zId, id)
  const data = parse(budgetMetaSchema.partial(), input)
  await db.update(budgets).set(data).where(eq(budgets.id, id))
  revalidateApp()
}

export async function deleteBudget(id: string) {
  parse(zId, id)
  await db.delete(budgets).where(eq(budgets.id, id))
  revalidateApp()
}

export async function addBudgetLine(budgetId: string, input: BudgetLineInput) {
  parse(zId, budgetId)
  const data = parse(budgetLineSchema, input)
  await db.insert(budgetLines).values({
    id: nanoid(),
    budgetId,
    name: data.name,
    kind: data.kind,
    categoryId: data.categoryId,
    merchantId: data.merchantId,
    amount: data.amount,
    frequency: data.frequency,
    recurring: data.recurring ? 1 : 0,
  })
  revalidateApp()
}

export async function updateBudgetLine(
  id: string,
  input: Partial<Omit<BudgetLineInput, 'kind' | 'categoryId'>>,
) {
  parse(zId, id)
  const data = parse(budgetLineSchema.omit({ kind: true, categoryId: true }).partial(), input)
  const { recurring, ...rest } = data
  await db
    .update(budgetLines)
    .set({ ...rest, ...(recurring === undefined ? {} : { recurring: recurring ? 1 : 0 }) })
    .where(eq(budgetLines.id, id))
  revalidateApp()
}

export async function deleteBudgetLine(id: string) {
  parse(zId, id)
  await db.delete(budgetLines).where(eq(budgetLines.id, id))
  revalidateApp()
}

/**
 * Replaces the single budget with a line-for-line copy of a simulation. Every
 * simulation line that has a category becomes a budget line; recurring-origin
 * lines are marked recurring, the rest ad-hoc.
 * `createdOnLabel` is the current date formatted on the client (locale + timezone).
 */
export async function createBudgetFromSimulation(input: {
  simulationId: string
  createdOnLabel: string
}): Promise<{ id: string }> {
  const data = parse(
    z.object({ simulationId: zId, createdOnLabel: z.string().min(1) }),
    input,
  )
  const simulation = await db.query.simulations.findFirst({
    where: eq(simulations.id, data.simulationId),
    with: { lines: true },
  })
  if (!simulation) throw new Error('Simulation not found')

  const id = nanoid()
  const rows = simulation.lines
    .filter((l) => l.categoryId)
    .map((l) => ({
      id: nanoid(),
      budgetId: id,
      name: l.name,
      kind: l.kind,
      categoryId: l.categoryId as string,
      merchantId: l.merchantId,
      amount: Number(l.amount ?? 0),
      frequency: l.frequency,
      recurring: l.origin === 'recurring' ? 1 : 0,
    }))

  await db.transaction(async (tx) => {
    await tx.delete(budgets)
    await tx.insert(budgets).values({
      id,
      name: simulation.name,
      description: `Created from ${simulation.name} on ${data.createdOnLabel}`,
      isActive: 1,
    })
    if (rows.length > 0) await tx.insert(budgetLines).values(rows)
  })
  revalidateApp()
  return { id }
}
