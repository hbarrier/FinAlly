import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  todayISO,
  currentMonth,
  monthOf,
  parseLocalDate,
  addMonths,
  firstDayOfMonth,
  lastDayOfMonth,
  monthsBetween,
  completeMonthsWindow,
} from './dates'

afterEach(() => vi.useRealTimers())

describe('todayISO / currentMonth (local basis)', () => {
  it('follows the local wall clock, not UTC (suite runs in America/New_York)', () => {
    // 2026-03-01T02:30Z is 2026-02-28 21:30 EST. A UTC-based impl would report
    // March; the local basis must report February.
    vi.setSystemTime(new Date('2026-03-01T02:30:00Z'))
    expect(todayISO()).toBe('2026-02-28')
    expect(currentMonth()).toBe('2026-02')
  })

  it('accepts an explicit reference date', () => {
    expect(currentMonth(new Date(2026, 6, 15))).toBe('2026-07')
    expect(todayISO(new Date(2026, 6, 4))).toBe('2026-07-04')
  })
})

describe('monthOf', () => {
  it('slices YYYY-MM with no timezone math', () => {
    expect(monthOf('2026-03-15')).toBe('2026-03')
    expect(monthOf('2026-12-31T23:00:00Z')).toBe('2026-12')
  })
})

describe('parseLocalDate', () => {
  it('returns local midnight of the given calendar day', () => {
    const d = parseLocalDate('2026-03-15')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2)
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(0)
  })
})

describe('addMonths', () => {
  it('shifts forward and back across year boundaries', () => {
    expect(addMonths('2026-01', 1)).toBe('2026-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-03', -14)).toBe('2025-01')
  })
})

describe('firstDayOfMonth / lastDayOfMonth', () => {
  it('firstDayOfMonth', () => {
    expect(firstDayOfMonth('2026-04')).toBe('2026-04-01')
  })

  it('lastDayOfMonth respects month length and leap years', () => {
    expect(lastDayOfMonth('2026-04')).toBe('2026-04-30')
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28')
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29')
    expect(lastDayOfMonth('2026-12')).toBe('2026-12-31')
  })
})

describe('monthsBetween', () => {
  it('is inclusive on both ends', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('returns a single month when from === to', () => {
    expect(monthsBetween('2026-05', '2026-05')).toEqual(['2026-05'])
  })

  it('returns empty when from is after to', () => {
    expect(monthsBetween('2026-05', '2026-04')).toEqual([])
  })
})

describe('completeMonthsWindow', () => {
  it('spans the N complete months before the current one', () => {
    expect(completeMonthsWindow(3, new Date(2026, 3, 20))).toEqual({
      start: '2026-01-01',
      endExclusive: '2026-04-01',
    })
  })

  it('crosses a year boundary', () => {
    expect(completeMonthsWindow(2, new Date(2026, 0, 10))).toEqual({
      start: '2025-11-01',
      endExclusive: '2026-01-01',
    })
  })
})
