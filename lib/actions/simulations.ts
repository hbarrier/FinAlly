'use server'

import { z } from 'zod'
import { revalidateApp } from './_shared'
import { db } from '../db'
import { simulations, simulationLines, recurring, transactions, categories, merchants } from '../schema'
import { nanoid } from '../utils'
import { eq, and, or, isNull, gte, lt, inArray, sql } from 'drizzle-orm'
import { completeMonthsWindow, roundToTen, simulationLineSourceTransactions } from '../derive'
import { parse, zId, zName, zKind, zFrequency, zPriority, zAmountOrZero, zNullableId, zOptionalId } from '../schemas'
import type { SimulationInputs } from '../db-types'

export type { SimulationInputs } from '../db-types'

const simMetaSchema = z.object({ name: zName, description: z.string().nullable() })

const simulationInputsSchema = z.object({
  recurring: z.object({
    monthlyExpenses: z.boolean(),
    monthlyIncome: z.boolean(),
    yearlyExpenses: z.boolean(),
    yearlyIncome: z.boolean(),
  }),
  avg: z.object({
    expenses: z.boolean(),
    income: z.boolean(),
    periodMonths: z.union([z.literal(1), z.literal(6), z.literal(12)]),
    rollup: z.enum(['all', 'drop', 'other']),
    thresholdMonthly: z.number().finite().nonnegative(),
  }),
})
const simLineSchema = z.object({
  name: z.string().nullable(),
  kind: zKind,
  categoryId: zNullableId,
  merchantId: zNullableId,
  amount: zAmountOrZero,
  frequency: zFrequency,
  sourceRecurringId: zOptionalId,
})
const simLineUpdateSchema = z.object({
  name: z.string().nullable(),
  kind: zKind,
  categoryId: zNullableId,
  merchantId: zNullableId,
  amount: zAmountOrZero,
  frequency: zFrequency,
  priority: zPriority,
}).partial()

/**
 * Adds an amount-0 line for every active category not yet represented in the
 * simulation (matching the kind), so new and duplicated simulations list all
 * active categories the way the budget does. Idempotent.
 */
export async function seedZeroCategoryLines(simulationId: string): Promise<void> {
  parse(zId, simulationId)
  // One transaction so a double-submit (or concurrent populateSimulationFromInputs)
  // can't both read "no lines yet" and both insert the placeholder set.
  await db.transaction(async (tx) => {
    const [existing, activeCats] = await Promise.all([
      tx.select({ kind: simulationLines.kind, categoryId: simulationLines.categoryId })
        .from(simulationLines)
        .where(eq(simulationLines.simulationId, simulationId)),
      tx.select().from(categories).where(eq(categories.isActive, 1)),
    ])
    const present = new Set(existing.map((l) => `${l.kind}:${l.categoryId ?? ''}`))
    const rows = activeCats
      .filter((c) => !present.has(`${c.kind}:${c.id}`))
      .map((c) => ({
        id: nanoid(),
        simulationId,
        name: null,
        kind: c.kind,
        categoryId: c.id,
        merchantId: null,
        amount: 0,
        frequency: 'monthly' as const,
        sourceRecurringId: null,
        origin: 'manual' as const,
      }))
    if (rows.length > 0) await tx.insert(simulationLines).values(rows)
  })
  revalidateApp()
}

export async function addSimulation(input: {
  name: string
  description: string | null
}): Promise<{ id: string }> {
  const data = parse(simMetaSchema, input)
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
  input: Partial<{ name: string; description: string | null }>,
) {
  parse(zId, id)
  const data = parse(simMetaSchema.partial(), input)
  await db.update(simulations).set(data).where(eq(simulations.id, id))
  revalidateApp()
}

export async function deleteSimulation(id: string) {
  parse(zId, id)
  await db.delete(simulations).where(eq(simulations.id, id))
  revalidateApp()
}

export async function addSimulationLine(
  simulationId: string,
  input: {
    name: string | null
    kind: 'expense' | 'income'
    categoryId: string | null
    merchantId: string | null
    amount: number
    frequency: 'monthly' | 'yearly'
    sourceRecurringId?: string | null
  },
) {
  parse(zId, simulationId)
  const data = parse(simLineSchema, input)
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
  input: Partial<{
    name: string | null
    kind: 'expense' | 'income'
    categoryId: string | null
    merchantId: string | null
    amount: number
    frequency: 'monthly' | 'yearly'
    priority: 'must' | 'should' | 'nice'
  }>,
) {
  parse(zId, id)
  const data = parse(simLineUpdateSchema, input)
  const patch: Record<string, unknown> = { ...data }
  if (data.amount !== undefined) {
    const line = await db.query.simulationLines.findFirst({ where: eq(simulationLines.id, id) })
    if (line && (line.origin === 'average' || line.origin === 'rollup') && data.amount !== line.amount) {
      patch.amountManual = 1
    }
  }
  await db.update(simulationLines).set(patch).where(eq(simulationLines.id, id))
  revalidateApp()
}

export async function deleteSimulationLine(id: string) {
  parse(zId, id)
  await db.delete(simulationLines).where(eq(simulationLines.id, id))
  revalidateApp()
}

/**
 * Recomputes an averaged/grouped line's amount from its source transactions over
 * the given look-back window, minus any flagged (excluded) rows, and persists the
 * window and exclusions on the line.
 */
export async function applySimulationLineAverage(
  lineId: string,
  input: { months: number; excludedTxnIds: string[] },
) {
  parse(zId, lineId)
  const data = parse(
    z.object({ months: z.number().int().positive().max(120), excludedTxnIds: z.array(zId) }),
    input,
  )
  const line = await db.query.simulationLines.findFirst({ where: eq(simulationLines.id, lineId) })
  if (!line) throw new Error('Simulation line not found')

  const simulation = await db.query.simulations.findFirst({ where: eq(simulations.id, line.simulationId) })
  if (!simulation?.inputs) throw new Error('Simulation was not seeded from inputs')
  const inputs = JSON.parse(simulation.inputs) as SimulationInputs

  const allTxns = await db.query.transactions.findMany()
  const source = simulationLineSourceTransactions(line, inputs, allTxns, undefined, data.months)

  const excluded = new Set(data.excludedTxnIds)
  const sum = source
    .filter((t) => !excluded.has(t.id))
    .reduce((s, t) => s + Number(t.amount || 0), 0)

  await db
    .update(simulationLines)
    .set({
      amount: roundToTen(sum / data.months),
      avgMonths: data.months,
      excludedTxnIds: data.excludedTxnIds.length > 0 ? JSON.stringify(data.excludedTxnIds) : null,
      amountManual: 0,
    })
    .where(eq(simulationLines.id, lineId))
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
    amount: roundToTen(c.avgMonthly),
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
      amount: roundToTen(amount),
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
  rawInputs: SimulationInputs,
): Promise<void> {
  parse(zId, simulationId)
  const inputs = parse(simulationInputsSchema, rawInputs)

  // Idempotent: never double-seed a simulation that already has lines.
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(simulationLines)
    .where(eq(simulationLines.simulationId, simulationId))
  if (n > 0) {
    revalidateApp()
    return
  }

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
  await seedZeroCategoryLines(simulationId)
  revalidateApp()
}

export async function duplicateSimulation(id: string): Promise<{ id: string }> {
  parse(zId, id)
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
          priority: l.priority,
          excludedTxnIds: l.excludedTxnIds,
          avgMonths: l.avgMonths,
          amountManual: l.amountManual,
        })),
      )
    }

    return newId
  })

  await seedZeroCategoryLines(newId)
  revalidateApp()
  return { id: newId }
}
