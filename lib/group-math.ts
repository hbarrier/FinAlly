/**
 * Pure calculation core for the Groups (shared-expense) module. Safe on the server
 * and the client, and trivial to unit-test. Mirrors the style of
 * lib/reimbursement-mapping.ts.
 *
 * Money is `real` euros. Every split rounds to whole cents and dumps the residual
 * cent(s) on the payer so the parts sum back to the entry amount exactly.
 */

import { addMonthsToDate } from './dates'
import type {
  GroupMember,
  GroupMemberShare,
  GroupEntry,
  GroupEntryParticipant,
  GroupEntryOverride,
  GroupReimbursement,
} from './db-types'

export type MemberLike = { id: string; isSelf: boolean }

export type ShareLike = {
  memberId: string
  percent: number
  startDate: string
  endDate: string | null
}

export type EntryLike = {
  id: string
  date: string
  amount: number
  direction: 'expense' | 'income'
  payerId: string
  involvesAll: boolean
  /** Only consulted when involvesAll is false. */
  participantMemberIds: string[]
  /** Fixed amount owed by a specific member for this entry. */
  overrides: { memberId: string; amount: number }[]
}

export type ReimbursementLike = {
  date: string
  amount: number
  direction: 'paid' | 'received'
  memberId: string
}

export type MemberBalance = { memberId: string; net: number }

export type SuggestedSettlement = {
  fromMemberId: string
  toMemberId: string
  amount: number
}

export type GroupBalances = {
  selfId: string | null
  /** net > 0 => member is owed money; net < 0 => member owes money. */
  balances: MemberBalance[]
  /** Convenience: the self member's net (0 when there is no self member). */
  youNet: number
  suggestedSettlements: SuggestedSettlement[]
}

export type StatementStatus = {
  tone: 'green' | 'orange' | 'red' | 'neutral'
  label: string
}

export type GroupEntryFull = GroupEntry & {
  participants: GroupEntryParticipant[]
  overrides: GroupEntryOverride[]
}

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

const EPSILON = 0.005

function round2(n: number): number {
  return Math.round((n + (n >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100
}

/** The member's active percentage on `date`, or null when no period covers it. */
export function activeShareOn(
  shares: ShareLike[],
  memberId: string,
  date: string,
): number | null {
  const match = shares
    .filter(
      (s) =>
        s.memberId === memberId &&
        s.startDate <= date &&
        (s.endDate == null || date <= s.endDate),
    )
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
  return match ? match.percent : null
}

function distribute(
  total: number,
  weights: { id: string; w: number }[],
  residualId: string,
): Map<string, number> {
  const out = new Map<string, number>()
  if (weights.length === 0) return out

  const sumW = weights.reduce((s, x) => s + x.w, 0)
  const effective = sumW > EPSILON ? weights : weights.map((x) => ({ id: x.id, w: 1 }))
  const sumEff = effective.reduce((s, x) => s + x.w, 0)

  const cents = Math.round(total * 100)
  let assigned = 0
  for (const x of effective) {
    const share = Math.round((cents * x.w) / sumEff)
    out.set(x.id, share)
    assigned += share
  }

  const residual = cents - assigned
  if (residual !== 0) {
    const rid = out.has(residualId) ? residualId : effective[0].id
    out.set(rid, (out.get(rid) ?? 0) + residual)
  }

  for (const [k, v] of out) out.set(k, v / 100)
  return out
}

/**
 * How much each member owes for a single entry (always positive numbers; the
 * caller applies the expense/income sign). Overrides take a fixed amount; the
 * remainder splits across the other participants by their renormalised standing %.
 */
export function splitEntry(
  entry: EntryLike,
  members: MemberLike[],
  shares: ShareLike[],
): Map<string, number> {
  const memberIds = new Set(members.map((m) => m.id))
  const participantIds = (
    entry.involvesAll ? members.map((m) => m.id) : entry.participantMemberIds
  ).filter((id) => memberIds.has(id))

  const overrideByMember = new Map(
    entry.overrides
      .filter((o) => participantIds.includes(o.memberId))
      .map((o) => [o.memberId, o.amount] as const),
  )

  const result = new Map<string, number>()
  let overrideTotal = 0
  for (const [id, amount] of overrideByMember) {
    result.set(id, amount)
    overrideTotal += amount
  }

  const rest = participantIds.filter((id) => !overrideByMember.has(id))
  const remaining = round2(entry.amount - overrideTotal)
  const weights = rest.map((id) => ({
    id,
    w: activeShareOn(shares, id, entry.date) ?? 0,
  }))
  const split = distribute(remaining, weights, entry.payerId)
  for (const [id, amount] of split) result.set(id, amount)

  return result
}

function entryEffect(
  entry: EntryLike,
  members: MemberLike[],
  shares: ShareLike[],
): Map<string, number> {
  const sign = entry.direction === 'income' ? -1 : 1
  const owed = splitEntry(entry, members, shares)
  const effect = new Map<string, number>()
  const bump = (id: string, v: number) => effect.set(id, (effect.get(id) ?? 0) + v)

  bump(entry.payerId, sign * entry.amount)
  for (const [id, amount] of owed) bump(id, -sign * amount)
  return effect
}

export function suggestSettlements(balances: MemberBalance[]): SuggestedSettlement[] {
  const debtors = balances
    .filter((b) => b.net < -EPSILON)
    .map((b) => ({ id: b.memberId, amt: -b.net }))
    .sort((a, b) => b.amt - a.amt)
  const creditors = balances
    .filter((b) => b.net > EPSILON)
    .map((b) => ({ id: b.memberId, amt: b.net }))
    .sort((a, b) => b.amt - a.amt)

  const out: SuggestedSettlement[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = round2(Math.min(debtors[i].amt, creditors[j].amt))
    if (pay > EPSILON) {
      out.push({ fromMemberId: debtors[i].id, toMemberId: creditors[j].id, amount: pay })
    }
    debtors[i].amt -= pay
    creditors[j].amt -= pay
    if (debtors[i].amt <= EPSILON) i++
    if (creditors[j].amt <= EPSILON) j++
  }
  return out
}

function accumulate(input: {
  members: MemberLike[]
  shares: ShareLike[]
  entries: EntryLike[]
  reimbursements: ReimbursementLike[]
}): Map<string, number> {
  const { members, shares, entries, reimbursements } = input
  const selfId = members.find((m) => m.isSelf)?.id ?? null
  const net = new Map<string, number>(members.map((m) => [m.id, 0]))
  const bump = (id: string, v: number) => net.set(id, (net.get(id) ?? 0) + v)

  for (const entry of entries) {
    for (const [id, v] of entryEffect(entry, members, shares)) bump(id, v)
  }

  for (const r of reimbursements) {
    if (!selfId || r.memberId === selfId) continue
    // `paid`: self -> member settles self's debt: self +amount, member -amount.
    const s = r.direction === 'paid' ? 1 : -1
    bump(selfId, s * r.amount)
    bump(r.memberId, -s * r.amount)
  }

  for (const [k, v] of net) net.set(k, round2(v))
  return net
}

export function computeGroupBalances(input: {
  members: MemberLike[]
  shares: ShareLike[]
  entries: EntryLike[]
  reimbursements: ReimbursementLike[]
}): GroupBalances {
  const selfId = input.members.find((m) => m.isSelf)?.id ?? null
  const net = accumulate(input)
  const balances: MemberBalance[] = input.members.map((m) => ({
    memberId: m.id,
    net: net.get(m.id) ?? 0,
  }))
  return {
    selfId,
    balances,
    youNet: selfId ? (net.get(selfId) ?? 0) : 0,
    suggestedSettlements: suggestSettlements(balances),
  }
}

/** Balances restricted to entries/reimbursements dated within [from, to]. */
export function statementBalances(
  input: {
    members: MemberLike[]
    shares: ShareLike[]
    entries: EntryLike[]
    reimbursements: ReimbursementLike[]
  },
  from: string,
  to: string,
): GroupBalances {
  return computeGroupBalances({
    members: input.members,
    shares: input.shares,
    entries: input.entries.filter((e) => e.date >= from && e.date <= to),
    reimbursements: input.reimbursements.filter((r) => r.date >= from && r.date <= to),
  })
}

export function statementStatus(
  statement: { dueDate: string | null; settledAt: string | null },
  today: string,
): StatementStatus {
  if (statement.settledAt) return { tone: 'green', label: 'Settled' }
  if (!statement.dueDate) return { tone: 'neutral', label: 'No due date' }
  if (today <= statement.dueDate) return { tone: 'green', label: `Due ${statement.dueDate}` }
  if (today <= addMonthsToDate(statement.dueDate, 1)) {
    return { tone: 'orange', label: 'Overdue < 1 month' }
  }
  return { tone: 'red', label: 'Overdue > 1 month' }
}
