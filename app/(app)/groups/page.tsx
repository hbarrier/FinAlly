import type { Metadata } from 'next'
import { requireModule } from '@/lib/modules'
import { getGroupList, balancesFor } from '@/lib/queries/groups'
import { GroupsClient } from './groups-client'

export const metadata: Metadata = { title: 'Groups | FinAlly' }

export default async function GroupsPage() {
  await requireModule('groups')
  const groups = await getGroupList()

  const cards = groups.map((g) => {
    const balances = balancesFor(g)
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      isActive: g.isActive === 1,
      memberCount: g.members.length,
      youNet: balances.youNet,
      hasActivity: g.entries.length > 0 || g.reimbursements.length > 0,
    }
  })

  return <GroupsClient cards={cards} />
}
