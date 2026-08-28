'use server'

import { revalidateApp } from './_shared'
import { db } from '../db'
import { budgets, budgetAmounts, simulations } from '../schema'
import { nanoid } from '../utils'
import { and, desc, eq, ne } from 'drizzle-orm'
import { simulationLinesByCategory, roundUpToFifty } from '../derive'

export async function createBudget(data: {
  name: string
  description: string | null
}): Promise<{ id: string }> {
  const id = nanoid()
  const existing = await db.query.budgets.findFirst()
  await db.insert(budgets).values({
    id,
    name: data.name,
    description: data.description,
    isActive: existing ? 0 : 1,
  })
  revalidateApp()
  return { id }
}

export async function updateBudget(
  id: string,
  data: Partial<{ name: string; description: string | null }>,
) {
  await db.update(budgets).set(data).where(eq(budgets.id, id))
  revalidateApp()
}

export async function deleteBudget(id: string) {
  const budget = await db.query.budgets.findFirst({ where: eq(budgets.id, id) })
  await db.delete(budgets).where(eq(budgets.id, id))
  if (budget?.isActive) {
    const next = await db.query.budgets.findFirst({ orderBy: [desc(budgets.createdAt)] })
    if (next) await db.update(budgets).set({ isActive: 1 }).where(eq(budgets.id, next.id))
  }
  revalidateApp()
}

export async function setActiveBudget(id: string) {
  await db.transaction(async (tx) => {
    await tx.update(budgets).set({ isActive: 0 }).where(ne(budgets.id, id))
    await tx.update(budgets).set({ isActive: 1 }).where(eq(budgets.id, id))
  })
  revalidateApp()
}

export async function setBudgetAmount(budgetId: string, categoryId: string, limitAmount: number) {
  await db
    .insert(budgetAmounts)
    .values({ id: nanoid(), budgetId, categoryId, limitAmount })
    .onConflictDoUpdate({
      target: [budgetAmounts.budgetId, budgetAmounts.categoryId],
      set: { limitAmount },
    })
  revalidateApp()
}

export async function deleteBudgetAmount(budgetId: string, categoryId: string) {
  await db
    .delete(budgetAmounts)
    .where(and(eq(budgetAmounts.budgetId, budgetId), eq(budgetAmounts.categoryId, categoryId)))
  revalidateApp()
}

/**
 * Creates a new budget from a simulation's per-category expense totals.
 * `createdOnLabel` is the current date formatted on the client (user's locale + timezone).
 */
export async function createBudgetFromSimulation(data: {
  simulationId: string
  roundUp: boolean
  includeYearly: boolean
  createdOnLabel: string
}): Promise<{ id: string }> {
  const [simulation, cats] = await Promise.all([
    db.query.simulations.findFirst({
      where: eq(simulations.id, data.simulationId),
      with: { lines: true },
    }),
    db.query.categories.findMany(),
  ])
  if (!simulation) throw new Error('Simulation not found')

  const view = data.includeYearly ? 'monthly-with-yearly' : 'monthly'
  const bars = simulationLinesByCategory(simulation.lines, cats, 'expense', view)
    .filter((b) => b.id !== 'uncategorized')
    .map((b) => ({
      categoryId: b.id,
      amount: data.roundUp ? roundUpToFifty(b.amount) : Math.round(b.amount),
    }))
    .filter((b) => b.amount > 0)

  const existing = await db.query.budgets.findFirst()
  const id = nanoid()
  await db.insert(budgets).values({
    id,
    name: simulation.name,
    description: `Created from ${simulation.name} on ${data.createdOnLabel}`,
    isActive: existing ? 0 : 1,
  })
  if (bars.length > 0) {
    await db.insert(budgetAmounts).values(
      bars.map((b) => ({
        id: nanoid(),
        budgetId: id,
        categoryId: b.categoryId,
        limitAmount: b.amount,
      })),
    )
  }
  revalidateApp()
  return { id }
}
