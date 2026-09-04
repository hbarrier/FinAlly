import { db } from './db'
import { categories } from './schema'
import { nanoid, REIMBURSEMENT_CATEGORY_NAME, SAVINGS_CATEGORY_NAME } from './utils'
import { eq, sql } from 'drizzle-orm'

const DEFAULT_CATEGORIES = [
  { icon: 'cat-cart', name: 'Groceries', color: 'sage', kind: 'expense' as const, isPensionAlimentaire: 0 },
  { icon: 'cat-house', name: 'Rent & utilities', color: 'terracotta', kind: 'expense' as const, isPensionAlimentaire: 0 },
  { icon: 'cat-bus', name: 'Transport', color: 'teal', kind: 'expense' as const, isPensionAlimentaire: 0 },
  { icon: 'cat-fork', name: 'Dining out', color: 'rose', kind: 'expense' as const, isPensionAlimentaire: 0 },
  { icon: 'cat-film', name: 'Entertainment', color: 'lilac', kind: 'expense' as const, isPensionAlimentaire: 0 },
  { icon: 'cat-heart', name: 'Health', color: 'butter', kind: 'expense' as const, isPensionAlimentaire: 0 },
  { icon: 'cat-briefcase', name: 'Salary', color: 'sage', kind: 'income' as const, isPensionAlimentaire: 0 },
  { icon: 'cat-pen', name: 'Freelance', color: 'teal', kind: 'income' as const, isPensionAlimentaire: 0 },
]

// Special categories that must always exist (seeded by name, not in the initial batch)
const SPECIAL_CATEGORIES = [
  { icon: 'receipt', name: REIMBURSEMENT_CATEGORY_NAME, color: 'teal', kind: 'income' as const, isPensionAlimentaire: 0, isSavings: 0 },
  { icon: 'cat-gift', name: 'Pension alimentaire', color: 'lilac', kind: 'income' as const, isPensionAlimentaire: 1, isSavings: 0 },
  { icon: 'cat-seed', name: SAVINGS_CATEGORY_NAME, color: 'sage', kind: 'expense' as const, isPensionAlimentaire: 0, isSavings: 1 },
]

// Singleton: only seed once per process regardless of how many pages call it
let seedPromise: Promise<void> | null = null

async function doSeed() {
  // Use INSERT OR IGNORE so concurrent calls are safe
  await db.run(sql`
    INSERT OR IGNORE INTO user_settings (id, name, starting_balance, currency)
    VALUES (1, 'You', 0, 'EUR')
  `)

  const existingCats = await db.query.categories.findMany()
  if (existingCats.length === 0) {
    await db.insert(categories).values(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, id: nanoid() }))
    )
  }

  // Always ensure special categories exist (idempotent: pension alimentaire by its
  // flag, reimbursements by name — a partial unique index backs both)
  for (const special of SPECIAL_CATEGORIES) {
    const exists = await db.query.categories.findFirst({
      where:
        special.isPensionAlimentaire === 1
          ? eq(categories.isPensionAlimentaire, 1)
          : special.isSavings === 1
            ? eq(categories.isSavings, 1)
            : eq(categories.name, special.name),
      columns: { id: true },
    })
    if (!exists) {
      await db.insert(categories).values({ ...special, id: nanoid() })
    }
  }
}

export function seed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = doSeed().catch((err) => {
      // Reset so next startup can retry
      seedPromise = null
      throw err
    })
  }
  return seedPromise
}
