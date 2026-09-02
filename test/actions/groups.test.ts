import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { makeTestDb, type TestDb } from '../helpers/db'
import {
  groupMembers,
  groupMemberShares,
  groupEntries,
  transactions,
} from '@/lib/schema'

const h = vi.hoisted(() => ({ db: null as TestDb | null }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))

let cleanup: () => void

beforeEach(async () => {
  const t = await makeTestDb()
  h.db = t.db
  cleanup = t.cleanup
  await t.db.run("INSERT INTO user_settings (id, name) VALUES (1, 'Hermine')")
})
afterEach(() => cleanup())

async function makeGroup() {
  const { createGroup, addGroupMember } = await import('@/lib/actions/groups')
  const { id } = await createGroup({ name: 'Divorce', description: null })
  await addGroupMember(id, 'John Doe')
  const members = await h.db!.select().from(groupMembers).where(eq(groupMembers.groupId, id))
  const self = members.find((m) => m.isSelf === 1)!
  const john = members.find((m) => m.isSelf === 0)!
  return { id, selfId: self.id, johnId: john.id }
}

describe('createGroup', () => {
  it('creates a self member named from user settings, no schedule yet', async () => {
    const { createGroup } = await import('@/lib/actions/groups')
    const { id } = await createGroup({ name: 'Trip', description: 'ski' })
    const members = await h.db!.select().from(groupMembers).where(eq(groupMembers.groupId, id))
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({ name: 'Hermine', isSelf: 1 })
    const shares = await h.db!.select().from(groupMemberShares).where(eq(groupMemberShares.groupId, id))
    expect(shares).toHaveLength(0)
  })
})

describe('setGroupShareSchedule', () => {
  it('rejects a split that does not total 100', async () => {
    const { setGroupShareSchedule } = await import('@/lib/actions/groups')
    const g = await makeGroup()
    await expect(
      setGroupShareSchedule(g.id, '2025-01-01', [
        { memberId: g.selfId, percent: 60 },
        { memberId: g.johnId, percent: 30 },
      ]),
    ).rejects.toThrow(/total 100/)
  })

  it('rejects when a member is missing from the split', async () => {
    const { setGroupShareSchedule } = await import('@/lib/actions/groups')
    const g = await makeGroup()
    await expect(
      setGroupShareSchedule(g.id, '2025-01-01', [{ memberId: g.selfId, percent: 100 }]),
    ).rejects.toThrow(/every group member/i)
  })

  it('closes the open period the day before the new effective date', async () => {
    const { setGroupShareSchedule } = await import('@/lib/actions/groups')
    const g = await makeGroup()
    await setGroupShareSchedule(g.id, '2025-01-01', [
      { memberId: g.selfId, percent: 60 },
      { memberId: g.johnId, percent: 40 },
    ])
    await setGroupShareSchedule(g.id, '2025-07-01', [
      { memberId: g.selfId, percent: 70 },
      { memberId: g.johnId, percent: 30 },
    ])
    const rows = await h.db!.select().from(groupMemberShares).where(eq(groupMemberShares.groupId, g.id))
    const janSelf = rows.find((r) => r.startDate === '2025-01-01' && r.memberId === g.selfId)!
    expect(janSelf.endDate).toBe('2025-06-30')
    const julSelf = rows.find((r) => r.startDate === '2025-07-01' && r.memberId === g.selfId)!
    expect(julSelf.endDate).toBeNull()
    expect(julSelf.percent).toBe(70)
  })

  it('replaces a period that starts on the same date instead of stacking', async () => {
    const { setGroupShareSchedule } = await import('@/lib/actions/groups')
    const g = await makeGroup()
    await setGroupShareSchedule(g.id, '2025-01-01', [
      { memberId: g.selfId, percent: 60 },
      { memberId: g.johnId, percent: 40 },
    ])
    await setGroupShareSchedule(g.id, '2025-01-01', [
      { memberId: g.selfId, percent: 55 },
      { memberId: g.johnId, percent: 45 },
    ])
    const rows = await h.db!
      .select()
      .from(groupMemberShares)
      .where(eq(groupMemberShares.groupId, g.id))
    const jan = rows.filter((r) => r.startDate === '2025-01-01')
    expect(jan).toHaveLength(2)
    expect(jan.find((r) => r.memberId === g.selfId)!.percent).toBe(55)
  })
})

describe('removeGroupMember', () => {
  it('refuses when the member is a payer on an entry', async () => {
    const { removeGroupMember } = await import('@/lib/actions/groups')
    const g = await makeGroup()
    await h.db!.insert(groupEntries).values({
      id: 'e1', groupId: g.id, date: '2025-02-01', amount: 20, direction: 'expense', payerId: g.johnId,
    })
    await expect(removeGroupMember(g.johnId)).rejects.toThrow(/movements in the group/)
  })

  it('removes an unreferenced member and their shares', async () => {
    const { removeGroupMember, setGroupShareSchedule } = await import('@/lib/actions/groups')
    const g = await makeGroup()
    await setGroupShareSchedule(g.id, '2025-01-01', [
      { memberId: g.selfId, percent: 60 },
      { memberId: g.johnId, percent: 40 },
    ])
    await removeGroupMember(g.johnId)
    expect(await h.db!.select().from(groupMembers).where(eq(groupMembers.id, g.johnId))).toHaveLength(0)
    expect(
      await h.db!.select().from(groupMemberShares).where(eq(groupMemberShares.memberId, g.johnId)),
    ).toHaveLength(0)
  })

  it('refuses to remove the self member', async () => {
    const { removeGroupMember } = await import('@/lib/actions/groups')
    const g = await makeGroup()
    await expect(removeGroupMember(g.selfId)).rejects.toThrow(/yourself/)
  })
})

async function groupWithSplit() {
  const { setGroupShareSchedule } = await import('@/lib/actions/groups')
  const g = await makeGroup()
  await setGroupShareSchedule(g.id, '2025-01-01', [
    { memberId: g.selfId, percent: 60 },
    { memberId: g.johnId, percent: 40 },
  ])
  return g
}

const baseEntry = {
  date: '2025-03-01',
  amount: 100,
  direction: 'expense' as const,
  description: 'Groceries',
  involvesAll: true,
  participantMemberIds: [],
  overrides: [],
  categoryId: null,
  method: 'card' as const,
}

describe('addGroupEntry', () => {
  it('creates a linked movement when you are the payer', async () => {
    const { addGroupEntry } = await import('@/lib/actions/groups')
    const g = await groupWithSplit()
    const { id } = await addGroupEntry(g.id, { ...baseEntry, payerId: g.selfId })
    const [entry] = await h.db!.select().from(groupEntries).where(eq(groupEntries.id, id))
    expect(entry.transactionId).toBeTruthy()
    expect(entry.ownsTransaction).toBe(1)
    const [tx] = await h.db!.select().from(transactions).where(eq(transactions.id, entry.transactionId!))
    expect(tx).toMatchObject({ amount: 100, kind: 'expense', note: 'Groceries' })
  })

  it('does not create a movement when another member is the payer', async () => {
    const { addGroupEntry } = await import('@/lib/actions/groups')
    const g = await groupWithSplit()
    const { id } = await addGroupEntry(g.id, { ...baseEntry, payerId: g.johnId })
    const [entry] = await h.db!.select().from(groupEntries).where(eq(groupEntries.id, id))
    expect(entry.transactionId).toBeNull()
    expect(await h.db!.select().from(transactions)).toHaveLength(0)
  })

  it('rejects an entry outside any percentage period', async () => {
    const { addGroupEntry } = await import('@/lib/actions/groups')
    const g = await groupWithSplit()
    await expect(
      addGroupEntry(g.id, { ...baseEntry, date: '2020-01-01', payerId: g.selfId }),
    ).rejects.toThrow(/percentage split covering this date/)
  })

  it('deletes the owned movement when the entry is deleted', async () => {
    const { addGroupEntry, deleteGroupEntry } = await import('@/lib/actions/groups')
    const g = await groupWithSplit()
    const { id } = await addGroupEntry(g.id, { ...baseEntry, payerId: g.selfId })
    await deleteGroupEntry(id)
    expect(await h.db!.select().from(transactions)).toHaveLength(0)
    expect(await h.db!.select().from(groupEntries)).toHaveLength(0)
  })
})

describe('allocateMovementToGroup', () => {
  async function makeMovement(over: Partial<{ kind: 'expense' | 'income'; amount: number; date: string }> = {}) {
    const id = 'mv_' + Math.random().toString(36).slice(2, 8)
    await h.db!.insert(transactions).values({
      id,
      date: over.date ?? '2025-03-01',
      amount: over.amount ?? 100,
      kind: over.kind ?? 'expense',
      method: 'card',
      note: 'Bank movement',
    })
    return id
  }

  it('creates an owns_transaction = 0 entry from an expense movement', async () => {
    const { allocateMovementToGroup } = await import('@/lib/actions/groups')
    const g = await groupWithSplit()
    const mv = await makeMovement()
    await allocateMovementToGroup(mv, {
      groupId: g.id, involvesAll: true, participantMemberIds: [],
    })
    const [entry] = await h.db!.select().from(groupEntries).where(eq(groupEntries.transactionId, mv))
    expect(entry).toMatchObject({ amount: 100, direction: 'expense', ownsTransaction: 0, payerId: g.selfId })
  })

  it('rejects a second allocation of the same movement', async () => {
    const { allocateMovementToGroup } = await import('@/lib/actions/groups')
    const g = await groupWithSplit()
    const mv = await makeMovement()
    await allocateMovementToGroup(mv, {
      groupId: g.id, involvesAll: true, participantMemberIds: [],
    })
    await expect(
      allocateMovementToGroup(mv, { groupId: g.id, involvesAll: true, participantMemberIds: [] }),
    ).rejects.toThrow(/already allocated/)
  })

  it('maps an income movement to a shared revenue entry', async () => {
    const { allocateMovementToGroup } = await import('@/lib/actions/groups')
    const g = await groupWithSplit()
    const mv = await makeMovement({ kind: 'income', amount: 40 })
    await allocateMovementToGroup(mv, { groupId: g.id, involvesAll: true, participantMemberIds: [] })
    const [r] = await h.db!.select().from(groupEntries).where(eq(groupEntries.transactionId, mv))
    expect(r).toMatchObject({ amount: 40, direction: 'income', ownsTransaction: 0, payerId: g.selfId })
  })

  it('unallocateMovement removes the link and leaves the movement', async () => {
    const { allocateMovementToGroup, unallocateMovement } = await import('@/lib/actions/groups')
    const g = await groupWithSplit()
    const mv = await makeMovement()
    await allocateMovementToGroup(mv, {
      groupId: g.id, involvesAll: true, participantMemberIds: [],
    })
    await unallocateMovement(mv)
    expect(await h.db!.select().from(groupEntries)).toHaveLength(0)
    expect(await h.db!.select().from(transactions).where(eq(transactions.id, mv))).toHaveLength(1)
  })

  it('deleteGroupEntry on an allocated entry leaves the movement', async () => {
    const { allocateMovementToGroup, deleteGroupEntry } = await import('@/lib/actions/groups')
    const g = await groupWithSplit()
    const mv = await makeMovement()
    await allocateMovementToGroup(mv, {
      groupId: g.id, involvesAll: true, participantMemberIds: [],
    })
    const [entry] = await h.db!.select().from(groupEntries).where(eq(groupEntries.transactionId, mv))
    await deleteGroupEntry(entry.id)
    expect(await h.db!.select().from(transactions).where(eq(transactions.id, mv))).toHaveLength(1)
  })
})
