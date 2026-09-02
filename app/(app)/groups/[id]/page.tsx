import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requireModule } from '@/lib/modules'
import { getGroupDetail, balancesFor } from '@/lib/queries/groups'
import { GroupDetailClient } from './group-detail-client'

export const metadata: Metadata = { title: 'Group | FinAlly' }

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule('groups')
  const { id } = await params
  const [group, categories] = await Promise.all([
    getGroupDetail(id),
    db.query.categories.findMany(),
  ])
  if (!group) notFound()

  return (
    <GroupDetailClient group={group} balances={balancesFor(group)} categories={categories} />
  )
}
