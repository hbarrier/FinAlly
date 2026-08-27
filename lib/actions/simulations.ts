'use server'

import { revalidateApp } from './_shared'
import { db } from '../db'
import { simulations, simulationLines, recurring, transactions, categories, merchants } from '../schema'
import { nanoid } from '../utils'
import { eq, and, or, isNull, gte, lt, inArray } from 'drizzle-orm'
import { completeMonthsWindow } from '../derive'
import type { SimulationInputs } from '../db-types'

export type { SimulationInputs } from '../db-types'

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
    origin: data.sourceRecurringId ? 'recurring' : 'manual',
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

type NewLine = typeof simulationLines.$inferInsert

async function recurringLines(
  simulationId: string,
  rec: SimulationInputs['recurring'],
): Promise<NewLine[]> {
  const wanted: { cadence: 'monthly' | 'yearly'; kind: 'expense' | 'income' }[] = []
  if (rec.monthlyExpenses) wanted.push({ cadence: 'monthly', kind: 'expense' })
  if (rec.monthlyIncome) wanted.push({ cadence: 'monthly', kind: 'income' })
  if (rec.yearlyExpenses) wanted.push({ cadence: 'yearly', kind: 'expense' })
  if (rec.yearlyIncome) wanted.push({ cadence: 'yearly', kind: 'income' })
  if (wanted.length === 0) return []

  const cadences = [...new Set(wanted.map((w) => w.cadence))]
  const kinds = [...new Set(wanted.map((w) => w.kind))]
  const wantedKeys = new Set(wanted.map((w) => `${w.cadence}:${w.kind}`))
  const today = new Date().toISOString().slice(0, 10)

  const rows = await db
    .select()
    .from(recurring)
    .where(
      and(
        inArray(recurring.cadence, cadences),
        inArray(recurring.kind, kinds),
        or(isNull(recurring.endDate), gte(recurring.endDate, today)),
      ),
    )

  return rows
    .filter((r) => wantedKeys.has(`${r.cadence}:${r.kind}`))
    .map((r) => ({
      id: nanoid(),
      simulationId,
      name: r.name,
      kind: r.kind,
      categoryId: r.categoryId,
      merchantId: r.merchantId,
      amount: r.amount,
      frequency: r.cadence,
      sourceRecurringId: r.id,
      origin: 'recurring',
    }))
}

async function averagedLinesForKind(
  simulationId: string,
  kind: 'expense' | 'income',
  avg: SimulationInputs['avg'],
  categoryNames: Map<string, string>,
  merchantNames: Map<string, string>,
): Promise<NewLine[]> {
  const { start, endExclusive } = completeMonthsWindow(avg.periodMonths)
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      merchantId: transactions.merchantId,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.kind, kind),
        isNull(transactions.recurringId),
        gte(transactions.date, start),
        lt(transactions.date, endExclusive),
      ),
    )

  const sums = new Map<string, { categoryId: string | null; merchantId: string | null; sum: number }>()
  for (const r of rows) {
    const key = `${r.categoryId ?? ''}|${r.merchantId ?? ''}`
    const entry = sums.get(key) ?? { categoryId: r.categoryId, merchantId: r.merchantId, sum: 0 }
    entry.sum += Number(r.amount || 0)
    sums.set(key, entry)
  }

  const combos = [...sums.values()].map((c) => ({
    categoryId: c.categoryId,
    merchantId: c.merchantId,
    avgMonthly: c.sum / avg.periodMonths,
  }))

  const otherLabel = (categoryId: string | null) =>
    categoryId ? `Other ${categoryNames.get(categoryId) ?? 'category'}` : 'Other (uncategorized)'

  const kept: typeof combos = []
  const rolled = new Map<string, number>() // categoryId ('' for null) -> summed avg

  for (const c of combos) {
    if (avg.rollup === 'all' || c.avgMonthly >= avg.thresholdMonthly) {
      kept.push(c)
      continue
    }
    if (avg.rollup === 'other') {
      const k = c.categoryId ?? ''
      rolled.set(k, (rolled.get(k) ?? 0) + c.avgMonthly)
    }
    // 'drop' -> discard
  }

  const lines: NewLine[] = kept.map((c) => ({
    id: nanoid(),
    simulationId,
    name: c.merchantId ? (merchantNames.get(c.merchantId) ?? null) : null,
    kind,
    categoryId: c.categoryId,
    merchantId: c.merchantId,
    amount: c.avgMonthly,
    frequency: 'monthly',
    sourceRecurringId: null,
    origin: 'average',
  }))

  for (const [k, amount] of rolled) {
    const categoryId = k === '' ? null : k
    lines.push({
      id: nanoid(),
      simulationId,
      name: otherLabel(categoryId),
      kind,
      categoryId,
      merchantId: null,
      amount,
      frequency: 'monthly',
      sourceRecurringId: null,
      rollup: 1,
      origin: 'rollup',
    })
  }

  return lines
}

export async function populateSimulationFromInputs(
  simulationId: string,
  inputs: SimulationInputs,
): Promise<void> {
  const lines: NewLine[] = [...(await recurringLines(simulationId, inputs.recurring))]

  if (inputs.avg.expenses || inputs.avg.income) {
    const [cats, merchs] = await Promise.all([
      db.select({ id: categories.id, name: categories.name }).from(categories),
      db.select({ id: merchants.id, name: merchants.name }).from(merchants),
    ])
    const categoryNames = new Map(cats.map((c) => [c.id, c.name]))
    const merchantNames = new Map(merchs.map((m) => [m.id, m.name]))
    if (inputs.avg.expenses) {
      lines.push(...(await averagedLinesForKind(simulationId, 'expense', inputs.avg, categoryNames, merchantNames)))
    }
    if (inputs.avg.income) {
      lines.push(...(await averagedLinesForKind(simulationId, 'income', inputs.avg, categoryNames, merchantNames)))
    }
  }

  if (lines.length > 0) await db.insert(simulationLines).values(lines)
  await db.update(simulations).set({ inputs: JSON.stringify(inputs) }).where(eq(simulations.id, simulationId))
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
      inputs: original.inputs,
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
          rollup: l.rollup,
          origin: l.origin,
        })),
      )
    }

    return newId
  })

  revalidateApp()
  return { id: newId }
}
