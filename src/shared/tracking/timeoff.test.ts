import { describe, expect, it } from 'vitest'
import { addTimeOff, nextDayOff, removeTimeOff, timeOffCounts, timeOffRows } from './timeoff'
import { ok, year } from './test-utils'

describe('adding days off', () => {
  it('adds a range, skipping weekends, oldest first', () => {
    const y = ok(addTimeOff(year(), '2026-12-23', '2026-12-29', 'university'))
    expect(y.timeOff.map((e) => e.date)).toEqual([
      '2026-12-23',
      '2026-12-24',
      '2026-12-25',
      '2026-12-28',
      '2026-12-29'
    ])
  })
  it('refuses a date outside the year, backwards ranges and weekend-only ranges', () => {
    expect(addTimeOff(year(), '2026-09-18', '2026-09-22', 'leave')).toEqual({
      ok: false,
      reason: 'outside-year'
    })
    expect(addTimeOff(year(), '2027-09-17', '2027-09-21', 'leave')).toEqual({
      ok: false,
      reason: 'outside-year'
    })
    expect(addTimeOff(year(), '2027-09-20', '2027-09-20', 'leave').ok).toBe(false)
    expect(addTimeOff(year(), '2026-09-23', '2026-09-22', 'leave')).toEqual({
      ok: false,
      reason: 'backwards'
    })
    expect(addTimeOff(year(), '2026-09-26', '2026-09-27', 'leave')).toEqual({
      ok: false,
      reason: 'weekend'
    })
  })
  it('accepts the first and last day of the year', () => {
    expect(addTimeOff(year(), '2026-09-21', '2026-09-21', 'leave').ok).toBe(true)
    expect(addTimeOff(year(), '2027-09-17', '2027-09-17', 'leave').ok).toBe(true)
  })
  it('lists a date once: adding it again changes its type', () => {
    let y = ok(addTimeOff(year(), '2026-12-24', '2026-12-24', 'university'))
    y = ok(addTimeOff(y, '2026-12-24', '2026-12-24', 'leave'))
    expect(y.timeOff).toEqual([{ date: '2026-12-24', type: 'leave' }])
  })
  it('removes a day', () => {
    const y = ok(addTimeOff(year(), '2026-12-24', '2026-12-25', 'public'))
    expect(removeTimeOff(y, '2026-12-24').timeOff.map((e) => e.date)).toEqual(['2026-12-25'])
  })
})

describe('counts: taken, booked, left to book', () => {
  const y = ok(
    addTimeOff(
      ok(
        addTimeOff(
          ok(addTimeOff(year(), '2026-10-01', '2026-10-01', 'public')),
          '2026-10-05',
          '2026-10-07',
          'leave'
        )
      ),
      '2026-12-24',
      '2026-12-24',
      'university'
    )
  )
  it('counts from the rows: before today is taken, today or later is booked', () => {
    expect(timeOffCounts(y, '2026-10-06')).toEqual({
      allowance: 40,
      taken: 2,
      booked: 3,
      left: 35,
      byType: { public: 1, university: 1, leave: 3 }
    })
  })
  it('counts today as booked, not yet taken', () => {
    expect(timeOffCounts(y, '2026-10-01')).toMatchObject({ taken: 0, booked: 5 })
  })
  it('ignores a date outside the year, a weekend date and a repeat in the file', () => {
    const odd = year({
      timeOff: [
        { date: '2027-12-27', type: 'public' },
        { date: '2026-09-26', type: 'public' },
        { date: '2026-10-01', type: 'public' },
        { date: '2026-10-01', type: 'leave' }
      ]
    })
    expect(timeOffCounts(odd, '2026-10-10')).toMatchObject({ taken: 1, booked: 0, left: 39 })
  })
  it('can go below zero when more is listed than the allowance', () => {
    const many = ok(
      addTimeOff(
        year({ plan: { hoursPerWeek: 2250, workDays: [1], allowanceDays: 2 } }),
        '2026-10-05',
        '2026-10-09',
        'leave'
      )
    )
    expect(timeOffCounts(many, '2026-09-22').left).toBe(-3)
  })
})

describe('the days off as a list', () => {
  const y = year({
    timeOff: [
      { date: '2026-12-24', type: 'university' },
      { date: '2026-10-05', type: 'leave' },
      { date: '2026-10-10', type: 'leave' }, // a Saturday: never counts
      { date: '2026-10-05', type: 'public' }, // a repeat of a date
      { date: '2025-12-24', type: 'public' } // outside the year
    ]
  })
  it('lists each counted day once, oldest first, as taken before today and booked from today', () => {
    expect(timeOffRows(y, '2026-10-05')).toEqual([
      { date: '2026-10-05', type: 'leave', taken: false },
      { date: '2026-12-24', type: 'university', taken: false }
    ])
    expect(timeOffRows(y, '2026-10-06')[0].taken).toBe(true)
  })
  it('agrees with the counts', () => {
    const c = timeOffCounts(y, '2026-10-06')
    const rows = timeOffRows(y, '2026-10-06')
    expect(rows.filter((r) => r.taken)).toHaveLength(c.taken)
    expect(rows.filter((r) => !r.taken)).toHaveLength(c.booked)
  })
  it('finds the next day off, today included', () => {
    expect(nextDayOff(y, '2026-10-05')).toBe('2026-10-05')
    expect(nextDayOff(y, '2026-10-06')).toBe('2026-12-24')
    expect(nextDayOff(y, '2026-12-25')).toBeNull()
  })
})
