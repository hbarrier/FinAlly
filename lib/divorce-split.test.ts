import { describe, it, expect } from 'vitest'
import { buildMonths, rentBreakdown, splitMonths, totalBalance, type ExpenseLike, type SplitSettings } from './divorce-split'

const SETTINGS: SplitSettings = { rent: 320, apl: 90, myPercent: 35, startMonth: '2026-10' }
const OCTOBER = { month: '2026-10', rent: 690, apl: null, vincentPaid: 0, audreyPaid: 0 }
const SKI: ExpenseLike = { date: '2026-11-05', amount: 200, myPercent: 35, mePaid: 0, vincentPaid: 0 }

describe('rentBreakdown', () => {
  it('shares rent minus APL and gives the APL back to me', () => {
    expect(rentBreakdown(SETTINGS)).toMatchObject({ shared: 230, vincentShare: 149.5, audreyOwesMe: 239.5 })
  })

  it('uses the month override', () => {
    expect(rentBreakdown(SETTINGS, OCTOBER)).toMatchObject({ rent: 690, shared: 600, vincentShare: 390, audreyOwesMe: 480 })
  })
})

describe('splitMonths', () => {
  it('lists every month from the start, newest first, including later expense months', () => {
    expect(splitMonths('2026-10', '2026-11', [{ ...SKI, date: '2027-01-02' }])).toEqual([
      '2027-01',
      '2026-12',
      '2026-11',
      '2026-10',
    ])
  })
})

describe('buildMonths', () => {
  it('nets my expense shares against the rent credit, per month', () => {
    const months = buildMonths(SETTINGS, [OCTOBER], [SKI], '2026-11')
    expect(months.map((m) => [m.month, m.balance])).toEqual([
      ['2026-11', { iOweAudrey: 70 - 239.5, vincentOwesAudrey: 130 + 149.5 }],
      ['2026-10', { iOweAudrey: -480, vincentOwesAudrey: 390 }],
    ])
    expect(totalBalance(months)).toEqual({ iOweAudrey: -649.5, vincentOwesAudrey: 669.5 })
  })

  it('drops paid shares', () => {
    const months = buildMonths(
      SETTINGS,
      [{ ...OCTOBER, vincentPaid: 1, audreyPaid: 1 }],
      [{ ...SKI, mePaid: 1 }],
      '2026-11',
    )
    expect(totalBalance(months)).toEqual({ iOweAudrey: -239.5, vincentOwesAudrey: 279.5 })
  })

  it('leaves Audrey at zero: she receives APL + Vincent rent share, spends expenses', () => {
    const months = buildMonths(SETTINGS, [], [SKI], '2026-11').filter((m) => m.month === '2026-11')
    const { iOweAudrey, vincentOwesAudrey } = totalBalance(months)
    const audreyCash = 90 + vincentOwesAudrey + iOweAudrey - 200
    expect(audreyCash).toBeCloseTo(0, 2)
  })
})
