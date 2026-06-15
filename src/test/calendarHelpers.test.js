import { describe, it, expect } from 'vitest'
import {
  mondayFirstDay,
  daysInMonth,
  toDateKey,
  parseDateKey,
  groupByDate,
  formatTimeRange,
  formatDateLabel,
  rangeForView,
} from '../utils/calendarHelpers'

describe('mondayFirstDay', () => {
  it('returns 0 for a Monday', () => {
    // 2026-06-08 is a Monday
    expect(mondayFirstDay(new Date(2026, 5, 8))).toBe(0)
  })
  it('returns 6 for a Sunday', () => {
    // 2026-06-14 is a Sunday
    expect(mondayFirstDay(new Date(2026, 5, 14))).toBe(6)
  })
})

describe('daysInMonth', () => {
  it('returns 28 for February 2026', () => {
    expect(daysInMonth(2026, 1)).toBe(28)
  })
  it('returns 29 for February 2024 (leap year)', () => {
    expect(daysInMonth(2024, 1)).toBe(29)
  })
  it('returns 31 for January', () => {
    expect(daysInMonth(2026, 0)).toBe(31)
  })
})

describe('toDateKey / parseDateKey', () => {
  it('builds a YYYY-MM-DD key', () => {
    expect(toDateKey(2026, 5, 11)).toBe('2026-06-11')
  })
  it('round-trips a date key', () => {
    expect(parseDateKey('2026-06-11')).toEqual({ year: 2026, month: 5, day: 11 })
  })
})

describe('groupByDate', () => {
  it('groups events by their date field', () => {
    const events = [
      { id: '1', date: '2026-06-11' },
      { id: '2', date: '2026-06-11' },
      { id: '3', date: '2026-06-12' },
    ]
    const grouped = groupByDate(events)
    expect(grouped['2026-06-11']).toHaveLength(2)
    expect(grouped['2026-06-12']).toHaveLength(1)
  })
  it('returns an empty object for no events', () => {
    expect(groupByDate([])).toEqual({})
  })
})

describe('formatTimeRange', () => {
  it('shows a range when start and end differ', () => {
    expect(formatTimeRange('10:30', '12:00')).toBe('10:30 – 12:00')
  })
  it('shows only the start when there is no end', () => {
    expect(formatTimeRange('10:30', null)).toBe('10:30')
  })
  it('shows only the start when start equals end', () => {
    expect(formatTimeRange('10:30', '10:30')).toBe('10:30')
  })
})

describe('formatDateLabel', () => {
  it('formats a date key in Portuguese with a capitalised weekday', () => {
    expect(formatDateLabel('2026-06-11')).toBe('Quinta-feira, 11 de Junho 2026')
  })
})

describe('rangeForView', () => {
  it('day spans a single date', () => {
    expect(rangeForView('day', 2026, 5, 11)).toEqual({ from: '2026-06-11', to: '2026-06-11' })
  })
  it('week spans Monday to Sunday around the anchor', () => {
    // 2026-06-11 is a Thursday
    expect(rangeForView('week', 2026, 5, 11)).toEqual({ from: '2026-06-08', to: '2026-06-14' })
  })
  it('month spans the whole month', () => {
    expect(rangeForView('month', 2026, 5, 1)).toEqual({ from: '2026-06-01', to: '2026-06-30' })
  })
  it('quarter spans three months', () => {
    expect(rangeForView('quarter', 2026, 5)).toEqual({ from: '2026-06-01', to: '2026-08-31' })
  })
  it('semester spans six months', () => {
    expect(rangeForView('semester', 2026, 5)).toEqual({ from: '2026-06-01', to: '2026-11-30' })
  })
  it('year spans the whole year', () => {
    expect(rangeForView('year', 2026)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })
})
