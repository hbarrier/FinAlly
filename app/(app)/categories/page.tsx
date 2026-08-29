import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getCategoryStats } from '@/lib/queries/category-stats'
import { CategoriesClient } from './categories-client'

export const metadata: Metadata = { title: 'Categories | FinAlly' }

export default async function CategoriesPage() {
  const [cats, stats] = await Promise.all([
    db.query.categories.findMany(),
    getCategoryStats(),
  ])
  return <CategoriesClient categories={cats} stats={stats} />
}
