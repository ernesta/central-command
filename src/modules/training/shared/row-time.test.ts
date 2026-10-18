import { describe, expect, it } from 'vitest'
import { durationWithStudy, rowTimeLine, rowTimeParts } from './row-time'

describe('rowTimeParts', () => {
  const timed = { start: '09:30', end: '15:00' }

  it('gives the range, the duration and the mode, in that order', () => {
    expect(rowTimeParts(timed, 'In person')).toEqual({
      range: '09:30–15:00',
      duration: '5 h 30 min',
      mode: 'In person'
    })
    expect(rowTimeLine(timed, 'In person')).toBe('09:30–15:00 · 5 h 30 min · In person')
  })

  it('reads the same for any row state: only what is missing is left out', () => {
    expect(rowTimeLine(timed, null)).toBe('09:30–15:00 · 5 h 30 min')
    expect(rowTimeLine(timed, '')).toBe('09:30–15:00 · 5 h 30 min')
    expect(rowTimeLine({ start: null, end: null }, 'Online')).toBe('No time yet · Online')
    expect(rowTimeLine({ start: null, end: null }, null)).toBe('No time yet')
  })

  it('treats an end without a start as no times and shows a start that has no end', () => {
    expect(rowTimeLine({ start: null, end: '15:00' }, 'Online')).toBe('No time yet · Online')
    expect(rowTimeLine({ start: '09:30', end: null }, null)).toBe('09:30')
    expect(rowTimeLine({ start: '09:30', end: null }, 'Online')).toBe('09:30 · Online')
  })

  it('shows a backwards range as its start alone, with no duration', () => {
    expect(rowTimeLine({ start: '15:00', end: '09:30' }, null)).toBe('15:00')
  })

  it('shows a total that includes self-study, with or without times', () => {
    expect(rowTimeLine(timed, 'Self-paced', 390)).toBe('09:30–15:00 · 6 h 30 min · Self-paced')
    expect(rowTimeLine({ start: null, end: null }, 'Self-paced', 45)).toBe(
      'No time yet · 45 min · Self-paced'
    )
    expect(rowTimeParts({ start: null, end: null }, null, null).duration).toBeNull()
  })

  it('gives the same parts upcoming or past (it does not know which)', () => {
    expect(rowTimeParts(timed, 'Online')).toEqual(rowTimeParts({ ...timed }, 'Online'))
  })
})

describe('durationWithStudy', () => {
  it('adds the self-study after the duration, and nothing when there is none', () => {
    expect(durationWithStudy(180, 75)).toBe('3 h + 1 h 15 min self-study')
    expect(durationWithStudy(180)).toBe('3 h')
  })
})
