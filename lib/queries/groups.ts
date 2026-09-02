import { cache } from 'react'
import { db } from '@/lib/db'
import { eq, inArray } from 'drizzle-orm'
import { groups, groupEntries, groupReimbursements, transactions } from '@/lib/schema'
import type { PaymentMethod } from '@/lib/payment-method'
import { computeGroupBalances, type GroupBalances } from '@/lib/group-math'
import type {
  Group,
  GroupMember,
  GroupMemberShare,
  GroupEntry,
  GroupEntryParticipant,
  GroupEntryOverride,
  GroupReimbursement,
  GroupStatement,
} from '@/lib/db-types'

export type GroupEntryFull = GroupEntry & {
  participants: GroupEntryParticipant[]
  overrides: GroupEntryOverride[]
}

export type LinkedTxMeta = { categoryId: string | null; method: PaymentMethod }

export type GroupDetail = Group & {
  members: GroupMember[]
  shares: GroupMemberShare[]
  entries: GroupEntryFull[]
  reimbursements: GroupReimbursement[]
  statements: GroupStatement[]
  /** category + method of the movement linked to an entry / reimbursement, by transaction id. */
  linkedTx: Record<string, LinkedTxMeta>
}

const withAll = {
  members: true,
  shares: true,
  entries: { with: { participants: true, overrides: true } },
  reimbursements: true,
  statements: true,
} as const

/** Maps a group's rows into the pure `computeGroupBalances` input shape. */
export function groupBalanceInput(g: {
  members: GroupMember[]
  shares: GroupMemberShare[]
  entries: GroupEntryFull[]
  reimbursements: GroupReimbursement[]
}) {
  return {
    members: g.members.map((m) => ({ id: m.id, isSelf: m.isSelf === 1 })),
    shares: g.shares.map((s) => ({
      memberId: s.memberId,
      percent: s.percent,
      startDate: s.startDate,
      endDate: s.endDate,
    })),
    entries: g.entries.map((e) => ({
      id: e.id,
      date: e.date,
      amount: e.amount,
      direction: e.direction,
      payerId: e.payerId,
      involvesAll: e.involvesAll === 1,
      participantMemberIds: e.participants.map((p) => p.memberId),
      overrides: e.overrides.map((o) => ({ memberId: o.memberId, amount: o.amount })),
    })),
    reimbursements: g.reimbursements.map((r) => ({
      date: r.date,
      amount: r.amount,
      direction: r.direction,
      memberId: r.memberId,
    })),
  }
}

export function balancesFor(g: GroupDetail): GroupBalances {
  return computeGroupBalances(groupBalanceInput(g))
}

async function linkedTxMeta(rows: {
  entries: { transactionId: string | null }[]
  reimbursements: { transactionId: string | null }[]
}): Promise<Record<string, LinkedTxMeta>> {
  const ids = [
    ...rows.entries.map((e) => e.transactionId),
    ...rows.reimbursements.map((r) => r.transactionId),
  ].filter((x): x is string => x != null)
  if (ids.length === 0) return {}
  const txns = await db
    .select({ id: transactions.id, categoryId: transactions.categoryId, method: transactions.method })
    .from(transactions)
    .where(inArray(transactions.id, ids))
  return Object.fromEntries(
    txns.map((t) => [t.id, { categoryId: t.categoryId, method: t.method as PaymentMethod }]),
  )
}

export type MovementGroupLink = { groupId: string; groupName: string; kind: 'entry' | 'reimbursement' }

/** For a set of movement ids, the group (and mapping kind) each one is allocated to, if any. */
export async function getMovementGroupLinks(
  txIds: string[],
): Promise<Record<string, MovementGroupLink>> {
  if (txIds.length === 0) return {}
  const [entryRows, reimbRows] = await Promise.all([
    db
      .select({ txId: groupEntries.transactionId, groupId: groups.id, groupName: groups.name })
      .from(groupEntries)
      .innerJoin(groups, eq(groupEntries.groupId, groups.id))
      .where(inArray(groupEntries.transactionId, txIds)),
    db
      .select({ txId: groupReimbursements.transactionId, groupId: groups.id, groupName: groups.name })
      .from(groupReimbursements)
      .innerJoin(groups, eq(groupReimbursements.groupId, groups.id))
      .where(inArray(groupReimbursements.transactionId, txIds)),
  ])
  const out: Record<string, MovementGroupLink> = {}
  for (const r of entryRows) {
    if (r.txId) out[r.txId] = { groupId: r.groupId, groupName: r.groupName, kind: 'entry' }
  }
  for (const r of reimbRows) {
    if (r.txId) out[r.txId] = { groupId: r.groupId, groupName: r.groupName, kind: 'reimbursement' }
  }
  return out
}

export const getGroupList = cache(async (): Promise<GroupDetail[]> => {
  const rows = (await db.query.groups.findMany({
    with: withAll,
    orderBy: (t, { desc }) => [desc(t.isActive), desc(t.createdAt)],
  })) as Omit<GroupDetail, 'linkedTx'>[]
  return rows.map((g) => ({ ...g, linkedTx: {} }))
})

export const getGroupDetail = cache(async (id: string): Promise<GroupDetail | undefined> => {
  const g = (await db.query.groups.findFirst({
    where: eq(groups.id, id),
    with: withAll,
  })) as Omit<GroupDetail, 'linkedTx'> | undefined
  if (!g) return undefined
  return { ...g, linkedTx: await linkedTxMeta(g) }
})
