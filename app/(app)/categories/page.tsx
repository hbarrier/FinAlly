import { db } from '@/lib/db'
import { CategoriesClient } from './categories-client'

export default async function CategoriesPage() {
  const [cats, txns] = await Promise.all([
    db.query.categories.findMany(),
    db.query.transactions.findMany({ columns: { id: true, categoryId: true, kind: true, amount: true, date: true } }),
  ])
  return <CategoriesClient categories={cats} transactions={txns as any} />
}
