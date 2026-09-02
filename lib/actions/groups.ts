'use server'

import { z } from 'zod'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { revalidateApp } from './_shared'
import { db } from '../db'
import {
  groups,
  groupMembers,
  groupMemberShares,
  groupEntries,
  groupEntryParticipants,
  groupEntryOverrides,
  groupReimbursements,
  groupStatements,
  transactions,
  userSettings,
} from '../schema'
import { nanoid } from '../utils'
import { addDays } from '../dates'
import {
  parse,
  zId,
  zName,
  zNullableId,
  zDateISO,
  zPercent,
  zAmount,
  zPaymentMethod,
  zGroupEntryDirection,
  zGroupReimbursementDirection,
  zGroupStatementScope,
} from '../schemas'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const SHARE_EPSILON = 0.01

async function assertGroup(tx: Tx, groupId: string) {
  const [g] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).limit(1)
  if (!g) throw new Error('Group not found')
}

// --- groups ---

export async function createGroup(input: {
  name: string
  description: string | null
}): Promise<{ id: string }> {
  const data = parse(z.object({ name: zName, description: z.string().nullable() }), input)
  const id = nanoid()
  await db.transaction(async (tx) => {
    const settings = await tx.select({ name: userSettings.name }).from(userSettings).limit(1)
    await tx.insert(groups).values({ id, name: data.name, description: data.description })
    await tx.insert(groupMembers).values({
      id: nanoid(),
      groupId: id,
      name: settings[0]?.name ?? 'You',
      isSelf: 1,
      sortOrder: 0,
    })
  })
  revalidateApp()
  return { id }
}

export async function updateGroup(
  id: string,
  input: Partial<{ name: string; description: string | null; settlementDelayDays: number | null }>,
) {
  parse(zId, id)
  const data = parse(
    z
      .object({
        name: zName,
        description: z.string().nullable(),
        settlementDelayDays: z.number().int().min(0).max(3650).nullable(),
      })
      .partial(),
    input,
  )
  await db.update(groups).set(data).where(eq(groups.id, id))
  revalidateApp()
}

export async function setGroupActive(id: string, active: boolean) {
  parse(zId, id)
  await db.update(groups).set({ isActive: active ? 1 : 0 }).where(eq(groups.id, id))
  revalidateApp()
}

export async function deleteGroup(id: string) {
  parse(zId, id)
  await db.delete(groups).where(eq(groups.id, id))
  revalidateApp()
}

// --- members ---

export async function addGroupMember(groupId: string, name: string) {
  parse(zId, groupId)
  parse(zName, name)
  await db.transaction(async (tx) => {
    await assertGroup(tx, groupId)
    const existing = await tx
      .select({ sortOrder: groupMembers.sortOrder })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
    const nextOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1
    await tx
      .insert(groupMembers)
      .values({ id: nanoid(), groupId, name: name.trim(), sortOrder: nextOrder })
  })
  revalidateApp()
}

export async function updateGroupMember(id: string, name: string) {
  parse(zId, id)
  parse(zName, name)
  await db.update(groupMembers).set({ name: name.trim() }).where(eq(groupMembers.id, id))
  revalidateApp()
}

export async function removeGroupMember(id: string) {
  parse(zId, id)
  await db.transaction(async (tx) => {
    const [member] = await tx
      .select({ id: groupMembers.id, isSelf: groupMembers.isSelf })
      .from(groupMembers)
      .where(eq(groupMembers.id, id))
      .limit(1)
    if (!member) throw new Error('Member not found')
    if (member.isSelf) throw new Error('You cannot remove yourself from a group.')

    const [payer] = await tx
      .select({ id: groupEntries.id })
      .from(groupEntries)
      .where(eq(groupEntries.payerId, id))
      .limit(1)
    const [part] = await tx
      .select({ id: groupEntryParticipants.id })
      .from(groupEntryParticipants)
      .where(eq(groupEntryParticipants.memberId, id))
      .limit(1)
    const [over] = await tx
      .select({ id: groupEntryOverrides.id })
      .from(groupEntryOverrides)
      .where(eq(groupEntryOverrides.memberId, id))
      .limit(1)
    const [reimb] = await tx
      .select({ id: groupReimbursements.id })
      .from(groupReimbursements)
      .where(eq(groupReimbursements.memberId, id))
      .limit(1)
    if (payer || part || over || reimb) {
      throw new Error('This member has movements in the group. Remove or reassign them first.')
    }

    await tx.delete(groupStatements).where(eq(groupStatements.memberId, id))
    await tx.delete(groupMemberShares).where(eq(groupMemberShares.memberId, id))
    await tx.delete(groupMembers).where(eq(groupMembers.id, id))
  })
  revalidateApp()
}

// --- share schedule ---

/**
 * Sets the percentage split effective from `effectiveDate` onward. Every current
 * group member must be listed exactly once and the percentages must total 100.
 * The previously open period is closed the day before `effectiveDate`.
 */
export async function setGroupShareSchedule(
  groupId: string,
  effectiveDate: string,
  shares: { memberId: string; percent: number }[],
) {
  parse(zId, groupId)
  parse(zDateISO, effectiveDate)
  const rows = parse(z.array(z.object({ memberId: zId, percent: zPercent })).min(1), shares)

  await db.transaction(async (tx) => {
    await assertGroup(tx, groupId)

    const members = await tx
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
    const memberIds = new Set(members.map((m) => m.id))
    const listed = new Set(rows.map((r) => r.memberId))
    if (listed.size !== rows.length) throw new Error('A member is listed twice.')
    if (listed.size !== memberIds.size || [...listed].some((id) => !memberIds.has(id))) {
      throw new Error('Every group member must have a percentage.')
    }
    const total = rows.reduce((s, r) => s + r.percent, 0)
    if (Math.abs(total - 100) > SHARE_EPSILON) {
      throw new Error(`Percentages must total 100 (currently ${total}).`)
    }

    const existing = await tx
      .select()
      .from(groupMemberShares)
      .where(eq(groupMemberShares.groupId, groupId))
    const maxStart = existing.reduce((m, r) => (r.startDate > m ? r.startDate : m), '')
    if (maxStart && effectiveDate < maxStart) {
      throw new Error('The effective date must be on or after the latest schedule change.')
    }

    // Replace any period that already starts exactly on this date; close the open one.
    await tx
      .delete(groupMemberShares)
      .where(
        and(eq(groupMemberShares.groupId, groupId), eq(groupMemberShares.startDate, effectiveDate)),
      )
    await tx
      .update(groupMemberShares)
      .set({ endDate: addDays(effectiveDate, -1) })
      .where(
        and(
          eq(groupMemberShares.groupId, groupId),
          isNull(groupMemberShares.endDate),
          ne(groupMemberShares.startDate, effectiveDate),
        ),
      )

    await tx.insert(groupMemberShares).values(
      rows.map((r) => ({
        id: nanoid(),
        groupId,
        memberId: r.memberId,
        percent: r.percent,
        startDate: effectiveDate,
      })),
    )
  })
  revalidateApp()
}

/** Deletes one schedule period (all members' rows sharing a start date) and reopens the prior one. */
export async function deleteGroupSharePeriod(groupId: string, startDate: string) {
  parse(zId, groupId)
  parse(zDateISO, startDate)
  await db.transaction(async (tx) => {
    const all = await tx
      .select()
      .from(groupMemberShares)
      .where(eq(groupMemberShares.groupId, groupId))
    const starts = [...new Set(all.map((r) => r.startDate))].sort()
    if (starts.length <= 1) throw new Error('A group must always have one active split.')
    if (!starts.includes(startDate)) throw new Error('No schedule period starts on that date.')

    const idx = starts.indexOf(startDate)
    await tx
      .delete(groupMemberShares)
      .where(and(eq(groupMemberShares.groupId, groupId), eq(groupMemberShares.startDate, startDate)))

    if (idx > 0) {
      // Extend the previous period to cover the gap.
      const prevStart = starts[idx - 1]
      const newEnd = idx + 1 < starts.length ? addDays(starts[idx + 1], -1) : null
      await tx
        .update(groupMemberShares)
        .set({ endDate: newEnd })
        .where(
          and(eq(groupMemberShares.groupId, groupId), eq(groupMemberShares.startDate, prevStart)),
        )
    } else {
      // Removed the first period: the next one becomes open-ended at its own start.
      // Nothing to do — its startDate already anchors it.
    }
  })
  revalidateApp()
}

// --- shared helpers ---

async function groupMemberIds(tx: Tx, groupId: string): Promise<Set<string>> {
  const rows = await tx
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))
  return new Set(rows.map((r) => r.id))
}

async function selfMemberId(tx: Tx, groupId: string): Promise<string | null> {
  const [row] = await tx
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.isSelf, 1)))
    .limit(1)
  return row?.id ?? null
}

async function periodCovers(tx: Tx, groupId: string, date: string): Promise<boolean> {
  const rows = await tx
    .select({ startDate: groupMemberShares.startDate, endDate: groupMemberShares.endDate })
    .from(groupMemberShares)
    .where(eq(groupMemberShares.groupId, groupId))
  return rows.some((r) => r.startDate <= date && (r.endDate == null || date <= r.endDate))
}

// --- entries ---

const entrySchema = z.object({
  date: zDateISO,
  amount: zAmount,
  direction: zGroupEntryDirection,
  description: z.string().nullable(),
  payerId: zId,
  involvesAll: z.boolean(),
  participantMemberIds: z.array(zId),
  overrides: z.array(
    z.object({ memberId: zId, amount: zAmount, comment: z.string().nullable() }),
  ),
  categoryId: zNullableId,
  method: zPaymentMethod,
})

type GroupEntryInput = z.infer<typeof entrySchema>

async function validateEntry(tx: Tx, groupId: string, data: GroupEntryInput) {
  await assertGroup(tx, groupId)
  const members = await groupMemberIds(tx, groupId)
  if (!members.has(data.payerId)) throw new Error('The payer must be a member of the group.')

  const participants = data.involvesAll ? [...members] : data.participantMemberIds
  if (participants.length === 0) throw new Error('Pick at least one participant.')
  if (participants.some((id) => !members.has(id))) {
    throw new Error('A participant is not a member of the group.')
  }
  const overrideTotal = data.overrides.reduce((s, o) => s + o.amount, 0)
  if (data.overrides.some((o) => !participants.includes(o.memberId))) {
    throw new Error('An override is set for a non-participant.')
  }
  if (overrideTotal > data.amount + 0.005) {
    throw new Error('Overrides add up to more than the entry amount.')
  }
  const allOverridden = participants.every((id) => data.overrides.some((o) => o.memberId === id))
  if (!allOverridden && !(await periodCovers(tx, groupId, data.date))) {
    throw new Error('Set a percentage split covering this date first.')
  }
  return participants
}

async function writeEntryChildren(
  tx: Tx,
  entryId: string,
  data: GroupEntryInput,
) {
  await tx.delete(groupEntryParticipants).where(eq(groupEntryParticipants.entryId, entryId))
  await tx.delete(groupEntryOverrides).where(eq(groupEntryOverrides.entryId, entryId))
  if (!data.involvesAll) {
    await tx.insert(groupEntryParticipants).values(
      data.participantMemberIds.map((memberId) => ({ id: nanoid(), entryId, memberId })),
    )
  }
  if (data.overrides.length > 0) {
    await tx.insert(groupEntryOverrides).values(
      data.overrides.map((o) => ({
        id: nanoid(),
        entryId,
        memberId: o.memberId,
        amount: o.amount,
        comment: o.comment,
      })),
    )
  }
}

export async function addGroupEntry(groupId: string, input: GroupEntryInput): Promise<{ id: string }> {
  parse(zId, groupId)
  const data = parse(entrySchema, input)
  const id = nanoid()
  await db.transaction(async (tx) => {
    await validateEntry(tx, groupId, data)
    const selfId = await selfMemberId(tx, groupId)
    let transactionId: string | null = null
    if (data.payerId === selfId) {
      transactionId = nanoid()
      await tx.insert(transactions).values({
        id: transactionId,
        date: data.date,
        amount: data.amount,
        kind: data.direction,
        method: data.method,
        categoryId: data.categoryId,
        note: data.description,
      })
    }
    await tx.insert(groupEntries).values({
      id,
      groupId,
      date: data.date,
      amount: data.amount,
      direction: data.direction,
      description: data.description,
      payerId: data.payerId,
      transactionId,
      ownsTransaction: transactionId ? 1 : 0,
      involvesAll: data.involvesAll ? 1 : 0,
    })
    await writeEntryChildren(tx, id, data)
  })
  revalidateApp()
  return { id }
}

export async function updateGroupEntry(id: string, input: GroupEntryInput) {
  parse(zId, id)
  const data = parse(entrySchema, input)
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(groupEntries).where(eq(groupEntries.id, id)).limit(1)
    if (!existing) throw new Error('Entry not found')
    await validateEntry(tx, existing.groupId, data)
    const selfId = await selfMemberId(tx, existing.groupId)
    const wantsTx = data.payerId === selfId

    let transactionId = existing.transactionId
    let ownsTransaction = existing.ownsTransaction

    if (existing.ownsTransaction === 1 && existing.transactionId) {
      if (wantsTx) {
        await tx
          .update(transactions)
          .set({
            date: data.date,
            amount: data.amount,
            kind: data.direction,
            method: data.method,
            categoryId: data.categoryId,
            note: data.description,
          })
          .where(eq(transactions.id, existing.transactionId))
      } else {
        await tx.delete(transactions).where(eq(transactions.id, existing.transactionId))
        transactionId = null
        ownsTransaction = 0
      }
    } else if (!existing.transactionId && wantsTx) {
      transactionId = nanoid()
      ownsTransaction = 1
      await tx.insert(transactions).values({
        id: transactionId,
        date: data.date,
        amount: data.amount,
        kind: data.direction,
        method: data.method,
        categoryId: data.categoryId,
        note: data.description,
      })
    }

    await tx
      .update(groupEntries)
      .set({
        date: data.date,
        amount: data.amount,
        direction: data.direction,
        description: data.description,
        payerId: data.payerId,
        transactionId,
        ownsTransaction,
        involvesAll: data.involvesAll ? 1 : 0,
      })
      .where(eq(groupEntries.id, id))
    await writeEntryChildren(tx, id, data)
  })
  revalidateApp()
}

export async function deleteGroupEntry(id: string) {
  parse(zId, id)
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(groupEntries).where(eq(groupEntries.id, id)).limit(1)
    if (!existing) return
    await tx.delete(groupEntries).where(eq(groupEntries.id, id))
    if (existing.ownsTransaction === 1 && existing.transactionId) {
      await tx.delete(transactions).where(eq(transactions.id, existing.transactionId))
    }
  })
  revalidateApp()
}

// --- reimbursements ---

const reimbursementSchema = z.object({
  date: zDateISO,
  amount: zAmount,
  direction: zGroupReimbursementDirection,
  memberId: zId,
  note: z.string().nullable(),
  categoryId: zNullableId,
  method: zPaymentMethod,
  statementId: zNullableId,
})

type GroupReimbursementInput = z.infer<typeof reimbursementSchema>

function reimbursementKind(direction: 'paid' | 'received'): 'expense' | 'income' {
  return direction === 'paid' ? 'expense' : 'income'
}

async function validateReimbursement(tx: Tx, groupId: string, data: GroupReimbursementInput) {
  await assertGroup(tx, groupId)
  const [member] = await tx
    .select({ id: groupMembers.id, isSelf: groupMembers.isSelf })
    .from(groupMembers)
    .where(and(eq(groupMembers.id, data.memberId), eq(groupMembers.groupId, groupId)))
    .limit(1)
  if (!member) throw new Error('The counterparty must be a member of the group.')
  if (member.isSelf === 1) throw new Error('A reimbursement is between you and another member.')
}

export async function addGroupReimbursement(
  groupId: string,
  input: GroupReimbursementInput,
): Promise<{ id: string }> {
  parse(zId, groupId)
  const data = parse(reimbursementSchema, input)
  const id = nanoid()
  await db.transaction(async (tx) => {
    await validateReimbursement(tx, groupId, data)
    const transactionId = nanoid()
    await tx.insert(transactions).values({
      id: transactionId,
      date: data.date,
      amount: data.amount,
      kind: reimbursementKind(data.direction),
      method: data.method,
      categoryId: data.categoryId,
      note: data.note,
    })
    await tx.insert(groupReimbursements).values({
      id,
      groupId,
      date: data.date,
      amount: data.amount,
      direction: data.direction,
      memberId: data.memberId,
      transactionId,
      ownsTransaction: 1,
      statementId: data.statementId,
      note: data.note,
    })
  })
  revalidateApp()
  return { id }
}

export async function updateGroupReimbursement(id: string, input: GroupReimbursementInput) {
  parse(zId, id)
  const data = parse(reimbursementSchema, input)
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(groupReimbursements)
      .where(eq(groupReimbursements.id, id))
      .limit(1)
    if (!existing) throw new Error('Reimbursement not found')
    await validateReimbursement(tx, existing.groupId, data)

    if (existing.ownsTransaction === 1 && existing.transactionId) {
      await tx
        .update(transactions)
        .set({
          date: data.date,
          amount: data.amount,
          kind: reimbursementKind(data.direction),
          method: data.method,
          categoryId: data.categoryId,
          note: data.note,
        })
        .where(eq(transactions.id, existing.transactionId))
    }

    await tx
      .update(groupReimbursements)
      .set({
        date: data.date,
        amount: data.amount,
        direction: data.direction,
        memberId: data.memberId,
        statementId: data.statementId,
        note: data.note,
      })
      .where(eq(groupReimbursements.id, id))
  })
  revalidateApp()
}

export async function deleteGroupReimbursement(id: string) {
  parse(zId, id)
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(groupReimbursements)
      .where(eq(groupReimbursements.id, id))
      .limit(1)
    if (!existing) return
    await tx.delete(groupReimbursements).where(eq(groupReimbursements.id, id))
    if (existing.ownsTransaction === 1 && existing.transactionId) {
      await tx.delete(transactions).where(eq(transactions.id, existing.transactionId))
    }
  })
  revalidateApp()
}

// --- movement allocation (link an existing bank movement to a group) ---

const allocateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('entry'),
    groupId: zId,
    involvesAll: z.boolean(),
    participantMemberIds: z.array(zId),
  }),
  z.object({
    kind: z.literal('reimbursement'),
    groupId: zId,
    memberId: zId,
  }),
])

async function assertMovementUnlinked(tx: Tx, transactionId: string) {
  const [entry] = await tx
    .select({ id: groupEntries.id })
    .from(groupEntries)
    .where(eq(groupEntries.transactionId, transactionId))
    .limit(1)
  const [reimb] = await tx
    .select({ id: groupReimbursements.id })
    .from(groupReimbursements)
    .where(eq(groupReimbursements.transactionId, transactionId))
    .limit(1)
  if (entry || reimb) throw new Error('This movement is already allocated to a group.')
}

export async function allocateMovementToGroup(
  transactionId: string,
  input: z.infer<typeof allocateSchema>,
): Promise<{ id: string }> {
  parse(zId, transactionId)
  const data = parse(allocateSchema, input)
  const id = nanoid()
  await db.transaction(async (tx) => {
    const [mv] = await tx
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId))
      .limit(1)
    if (!mv) throw new Error('Movement not found')
    await assertMovementUnlinked(tx, transactionId)

    if (data.kind === 'entry') {
      const selfId = await selfMemberId(tx, data.groupId)
      if (!selfId) throw new Error('Group not found')
      const direction = mv.kind === 'income' ? 'income' : 'expense'
      const entryData: GroupEntryInput = {
        date: mv.date,
        amount: mv.amount,
        direction,
        description: mv.note,
        payerId: selfId,
        involvesAll: data.involvesAll,
        participantMemberIds: data.participantMemberIds,
        overrides: [],
        categoryId: mv.categoryId,
        method: mv.method,
      }
      await validateEntry(tx, data.groupId, entryData)
      await tx.insert(groupEntries).values({
        id,
        groupId: data.groupId,
        date: mv.date,
        amount: mv.amount,
        direction,
        description: mv.note,
        payerId: selfId,
        transactionId,
        ownsTransaction: 0,
        involvesAll: data.involvesAll ? 1 : 0,
      })
      await writeEntryChildren(tx, id, entryData)
    } else {
      const direction = mv.kind === 'expense' ? 'paid' : 'received'
      await validateReimbursement(tx, data.groupId, {
        date: mv.date,
        amount: mv.amount,
        direction,
        memberId: data.memberId,
        note: mv.note,
        categoryId: mv.categoryId,
        method: mv.method,
        statementId: null,
      })
      await tx.insert(groupReimbursements).values({
        id,
        groupId: data.groupId,
        date: mv.date,
        amount: mv.amount,
        direction,
        memberId: data.memberId,
        transactionId,
        ownsTransaction: 0,
        statementId: null,
        note: mv.note,
      })
    }
  })
  revalidateApp()
  return { id }
}

/** Removes a group's link to a movement without touching the movement itself. */
export async function unallocateMovement(transactionId: string) {
  parse(zId, transactionId)
  await db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(groupEntries)
      .where(eq(groupEntries.transactionId, transactionId))
      .limit(1)
    if (entry) {
      if (entry.ownsTransaction === 1) throw new Error('This entry owns its movement.')
      await tx.delete(groupEntries).where(eq(groupEntries.id, entry.id))
      revalidateApp()
      return
    }
    const [reimb] = await tx
      .select()
      .from(groupReimbursements)
      .where(eq(groupReimbursements.transactionId, transactionId))
      .limit(1)
    if (reimb) {
      if (reimb.ownsTransaction === 1) throw new Error('This reimbursement owns its movement.')
      await tx.delete(groupReimbursements).where(eq(groupReimbursements.id, reimb.id))
    }
  })
  revalidateApp()
}

// --- statements ---

const statementSchema = z.object({
  scope: zGroupStatementScope,
  memberId: zNullableId,
  periodFrom: zDateISO,
  periodTo: zDateISO,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  note: z.string().nullable(),
})

export async function createGroupStatement(
  groupId: string,
  input: z.infer<typeof statementSchema>,
): Promise<{ id: string }> {
  parse(zId, groupId)
  const data = parse(statementSchema, input)
  if (data.periodFrom > data.periodTo) throw new Error('The period start must be before its end.')

  const id = nanoid()
  await db.transaction(async (tx) => {
    const [group] = await tx
      .select({ delay: groups.settlementDelayDays })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1)
    if (!group) throw new Error('Group not found')

    let memberId: string | null = null
    if (data.scope === 'member') {
      if (!data.memberId) throw new Error('Pick the member this statement is with.')
      const [member] = await tx
        .select({ id: groupMembers.id, isSelf: groupMembers.isSelf })
        .from(groupMembers)
        .where(and(eq(groupMembers.id, data.memberId), eq(groupMembers.groupId, groupId)))
        .limit(1)
      if (!member || member.isSelf === 1) throw new Error('Pick another member for this statement.')
      memberId = member.id
    }

    const existing = await tx
      .select()
      .from(groupStatements)
      .where(eq(groupStatements.groupId, groupId))
    const overlaps = existing.some(
      (s) =>
        (s.scope === data.scope && s.memberId === memberId) &&
        !(s.periodTo < data.periodFrom || s.periodFrom > data.periodTo),
    )
    if (overlaps) throw new Error('This period overlaps an existing statement.')

    const dueDate =
      data.dueDate ?? (group.delay != null ? addDays(data.periodTo, group.delay) : null)

    await tx.insert(groupStatements).values({
      id,
      groupId,
      scope: data.scope,
      memberId,
      periodFrom: data.periodFrom,
      periodTo: data.periodTo,
      dueDate,
      note: data.note,
    })
  })
  revalidateApp()
  return { id }
}

export async function setStatementSettled(id: string, settled: boolean) {
  parse(zId, id)
  await db
    .update(groupStatements)
    .set({ settledAt: settled ? new Date().toISOString() : null })
    .where(eq(groupStatements.id, id))
  revalidateApp()
}

export async function deleteGroupStatement(id: string) {
  parse(zId, id)
  await db.delete(groupStatements).where(eq(groupStatements.id, id))
  revalidateApp()
}
