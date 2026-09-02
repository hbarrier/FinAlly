import { describe, it, expect } from 'vitest'
import {
  activeShareOn,
  splitEntry,
  computeGroupBalances,
  suggestSettlements,
  type MemberLike,
  type ShareLike,
  type EntryLike,
} from './group-math'

const ME: MemberLike = { id: 'me', isSelf: true }
const JOHN: MemberLike = { id: 'john', isSelf: false }
const KIM: MemberLike = { id: 'kim', isSelf: false }

// me 60 / john 40 until mid-2025, then me 70 / john 30
const SHARES_2: ShareLike[] = [
  { memberId: 'me', percent: 60, startDate: '2024-01-01', endDate: '2025-06-30' },
  { memberId: 'john', percent: 40, startDate: '2024-01-01', endDate: '2025-06-30' },
  { memberId: 'me', percent: 70, startDate: '2025-07-01', endDate: null },
  { memberId: 'john', percent: 30, startDate: '2025-07-01', endDate: null },
]

function entry(over: Partial<EntryLike>): EntryLike {
  return {
    id: 'e',
    date: '2025-03-01',
    amount: 100,
    direction: 'expense',
    payerId: 'me',
    involvesAll: true,
    participantMemberIds: [],
    overrides: [],
    ...over,
  }
}

describe('activeShareOn', () => {
  it('picks the period covering the date', () => {
    expect(activeShareOn(SHARES_2, 'john', '2025-03-01')).toBe(40)
    expect(activeShareOn(SHARES_2, 'john', '2025-08-01')).toBe(30)
    expect(activeShareOn(SHARES_2, 'john', '2020-01-01')).toBeNull()
  })
})

describe('splitEntry', () => {
  it('splits by standing % on the entry date', () => {
    const s = splitEntry(entry({ amount: 100, date: '2025-03-01' }), [ME, JOHN], SHARES_2)
    expect(s.get('me')).toBeCloseTo(60, 2)
    expect(s.get('john')).toBeCloseTo(40, 2)
  })

  it('uses the later period after the schedule changes', () => {
    const s = splitEntry(entry({ amount: 100, date: '2025-09-01' }), [ME, JOHN], SHARES_2)
    expect(s.get('me')).toBeCloseTo(70, 2)
    expect(s.get('john')).toBeCloseTo(30, 2)
  })

  it('renormalises across participants when only a subset is involved', () => {
    // me 70 / john 30 / kim ? — kim has no share row => weight 0, excluded anyway
    const shares: ShareLike[] = [
      { memberId: 'me', percent: 50, startDate: '2024-01-01', endDate: null },
      { memberId: 'john', percent: 30, startDate: '2024-01-01', endDate: null },
      { memberId: 'kim', percent: 20, startDate: '2024-01-01', endDate: null },
    ]
    const s = splitEntry(
      entry({ amount: 100, involvesAll: false, participantMemberIds: ['me', 'john'] }),
      [ME, JOHN, KIM],
      shares,
    )
    // 50:30 renormalised -> 62.5 / 37.5
    expect(s.get('me')).toBeCloseTo(62.5, 2)
    expect(s.get('john')).toBeCloseTo(37.5, 2)
    expect(s.has('kim')).toBe(false)
  })

  it('honours a per-member override and splits the rest', () => {
    const s = splitEntry(
      entry({ amount: 100, date: '2025-03-01', overrides: [{ memberId: 'john', amount: 10 }] }),
      [ME, JOHN],
      SHARES_2,
    )
    expect(s.get('john')).toBeCloseTo(10, 2)
    expect(s.get('me')).toBeCloseTo(90, 2)
  })

  it('parts always sum to the entry amount (cent residual on the payer)', () => {
    const s = splitEntry(entry({ amount: 10, date: '2025-03-01', payerId: 'john' }), [ME, JOHN], [
      { memberId: 'me', percent: 33.333, startDate: '2024-01-01', endDate: null },
      { memberId: 'john', percent: 66.667, startDate: '2024-01-01', endDate: null },
    ])
    const total = [...s.values()].reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(10, 2)
  })

  it('falls back to an equal split when no participant has a share', () => {
    const s = splitEntry(entry({ amount: 100 }), [ME, JOHN], [])
    expect(s.get('me')).toBeCloseTo(50, 2)
    expect(s.get('john')).toBeCloseTo(50, 2)
  })
})

describe('computeGroupBalances', () => {
  it('nets payer credit against each member share', () => {
    // me pays 100, split 60/40 -> john owes me 40
    const r = computeGroupBalances({
      members: [ME, JOHN],
      shares: SHARES_2,
      entries: [entry({ amount: 100, date: '2025-03-01', payerId: 'me' })],
    })
    expect(r.youNet).toBeCloseTo(40, 2)
    expect(r.balances.find((b) => b.memberId === 'john')?.net).toBeCloseTo(-40, 2)
    expect(r.suggestedSettlements).toEqual([
      { fromMemberId: 'john', toMemberId: 'me', amount: 40 },
    ])
  })

  it('handles a member-paid entry (john pays, me owes my share)', () => {
    const r = computeGroupBalances({
      members: [ME, JOHN],
      shares: SHARES_2,
      entries: [entry({ amount: 100, date: '2025-03-01', payerId: 'john' })],
    })
    // john fronted 100, john's own share 40 -> john is owed 60, me owes 60
    expect(r.youNet).toBeCloseTo(-60, 2)
  })

  it('shared revenue (income direction) flips the signs', () => {
    // me receives 100 shared revenue split 60/40 -> me owes john his 40
    const r = computeGroupBalances({
      members: [ME, JOHN],
      shares: SHARES_2,
      entries: [entry({ amount: 100, date: '2025-03-01', direction: 'income', payerId: 'me' })],
    })
    expect(r.youNet).toBeCloseTo(-40, 2)
  })
})

describe('suggestSettlements', () => {
  it('greedily matches debtors to creditors', () => {
    const out = suggestSettlements([
      { memberId: 'a', net: -70 },
      { memberId: 'b', net: -30 },
      { memberId: 'c', net: 100 },
    ])
    expect(out).toEqual([
      { fromMemberId: 'a', toMemberId: 'c', amount: 70 },
      { fromMemberId: 'b', toMemberId: 'c', amount: 30 },
    ])
  })
})

