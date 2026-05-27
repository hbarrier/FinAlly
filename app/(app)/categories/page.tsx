import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Categories | FinAlly' }
import { CategoriesClient } from './categories-client'

export default async function CategoriesPage() {
  const [cats, txns] = await Promise.all([
    db.query.categories.findMany(),
    db.query.transactions.findMany({ columns: { id: true, categoryId: true, kind: true, amount: true, date: true } }),
  ])
  return <CategoriesClient categories={cats} transactions={txns} />
}
