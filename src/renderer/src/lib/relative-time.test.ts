import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './relative-time'

const now = new Date('2026-06-15T12:00:00Z')
const ago = (ms: number): string => new Date(now.getTime() - ms).toISOString()
const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('says just now for the first moments', () => {
    expect(formatRelativeTime(ago(5 * SEC), now)).toBe('just now')
    expect(formatRelativeTime(ago(44 * SEC), now)).toBe('just now')
  })
  it('counts minutes', () => {
    expect(formatRelativeTime(ago(2 * MIN), now)).toBe('2 min ago')
    expect(formatRelativeTime(ago(59 * MIN), now)).toBe('59 min ago')
  })
  it('counts hours', () => {
    expect(formatRelativeTime(ago(3 * HOUR), now)).toBe('3 h ago')
  })
  it('says yesterday, then days', () => {
    expect(formatRelativeTime(ago(30 * HOUR), now)).toBe('yesterday')
    expect(formatRelativeTime(ago(5 * DAY), now)).toBe('5 days ago')
  })
  it('falls back to a date after a month', () => {
    expect(formatRelativeTime(ago(90 * DAY), now)).toMatch(/2026/)
  })
  it('treats slightly-future timestamps as just now and bad input as empty', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 5 * SEC).toISOString(), now)).toBe(
      'just now'
    )
    expect(formatRelativeTime('not a date', now)).toBe('')
  })
})
