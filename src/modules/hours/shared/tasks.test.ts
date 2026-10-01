import { describe, expect, it } from 'vitest'
import { at, nextId, ok, year } from '@shared/tracking/test-utils'
import { startSession, stopSession } from '@shared/tracking/timer'
import { addTime } from '@shared/tracking/totals'
import { earlierLabels, parseQuarterHours, recentLabels, suggestLabels } from './tasks'

describe('earlierLabels', () => {
  it('lists each task once, the most recently used first, ignoring case and spaces', () => {
    let y = year()
    y = ok(startSession(y, at('2026-09-28', '09:00:00'), 'Deck', nextId()))
    y = ok(stopSession(y, at('2026-09-28', '10:00:00')))
    y = ok(startSession(y, at('2026-09-29', '09:00:00'), 'Review', nextId()))
    y = ok(stopSession(y, at('2026-09-29', '09:30:00')))
    y = ok(startSession(y, at('2026-09-30', '09:00:00'), ' deck ', nextId()))
    y = ok(stopSession(y, at('2026-09-30', '09:30:00')))
    expect(earlierLabels(y)).toEqual(['deck', 'Review'])
  })
  it('includes names that were only typed in', () => {
    const y = ok(addTime(year(), '2026-09-28', 'Reading', 30, nextId()))
    expect(earlierLabels(y)).toEqual(['Reading'])
  })
  it('is empty for a year with nothing in it', () => {
    expect(earlierLabels(year())).toEqual([])
  })
})

describe('recentLabels', () => {
  const build = (): ReturnType<typeof year> => {
    let y = year()
    y = ok(startSession(y, at('2026-09-22', '09:00:00'), 'Old', nextId()))
    y = ok(stopSession(y, at('2026-09-22', '10:00:00')))
    y = ok(startSession(y, at('2026-10-05', '09:00:00'), 'Deck', nextId()))
    y = ok(stopSession(y, at('2026-10-05', '10:00:00')))
    y = ok(startSession(y, at('2026-10-06', '09:00:00'), 'Review', nextId()))
    y = ok(stopSession(y, at('2026-10-06', '09:30:00')))
    y = ok(startSession(y, at('2026-10-07', '09:00:00'), ' deck ', nextId()))
    return ok(stopSession(y, at('2026-10-07', '09:30:00')))
  }
  it('lists each name once, newest first, ignoring case and spaces', () => {
    expect(recentLabels(build(), '2026-10-07')).toEqual(['deck', 'Review'])
  })
  it('leaves out names older than a week', () => {
    expect(recentLabels(build(), '2026-10-07')).not.toContain('Old')
    expect(recentLabels(build(), '2026-09-28')).toEqual(['Old'])
  })
  it('reaches back seven days, today included', () => {
    const y = ok(addTime(year(), '2026-10-05', 'Edge', 30, nextId()))
    expect(recentLabels(y, '2026-10-11')).toEqual(['Edge'])
    expect(recentLabels(y, '2026-10-12')).toEqual([])
  })
  it('stops at the limit', () => {
    expect(recentLabels(build(), '2026-10-07', 1)).toEqual(['deck'])
  })
  it('includes typed-in time and is empty for an empty year', () => {
    const y = ok(addTime(year(), '2026-10-07', 'Reading', 30, nextId()))
    expect(recentLabels(y, '2026-10-07')).toEqual(['Reading'])
    expect(recentLabels(year(), '2026-10-07')).toEqual([])
  })
})

describe('suggestLabels', () => {
  const labels = ['Prepare a presentation', 'Deck', 'Set up the deck', 'Review']
  it('suggests nothing before anything is typed', () => {
    expect(suggestLabels(labels, '')).toEqual([])
    expect(suggestLabels(labels, '  ')).toEqual([])
  })
  it('puts names that start with the text before names that contain it', () => {
    expect(suggestLabels(labels, 'de')).toEqual(['Deck', 'Set up the deck'])
    expect(suggestLabels(labels, 'DECK')).toEqual(['Set up the deck'])
  })
  it('does not suggest the name that is already typed in full', () => {
    expect(suggestLabels(['Deck'], 'deck')).toEqual([])
  })
  it('keeps to the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => `Task ${i}`)
    expect(suggestLabels(many, 'task')).toHaveLength(6)
  })
})

describe('parseQuarterHours', () => {
  it('accepts whole quarter hours in any of the typed forms', () => {
    expect(parseQuarterHours('1:15')).toBe(75)
    expect(parseQuarterHours('2')).toBe(120)
    expect(parseQuarterHours('1.25')).toBe(75)
    expect(parseQuarterHours('0:00')).toBe(0)
  })
  it('refuses minutes that are not a quarter hour, and anything else', () => {
    expect(parseQuarterHours('1:20')).toBeNull()
    expect(parseQuarterHours('1.1')).toBeNull()
    expect(parseQuarterHours('abc')).toBeNull()
    expect(parseQuarterHours('')).toBeNull()
    expect(parseQuarterHours('-1')).toBeNull()
  })
})
