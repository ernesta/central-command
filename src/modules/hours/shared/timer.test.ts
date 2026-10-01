import { describe, expect, it } from 'vitest'
import { at } from '@shared/tracking/test-utils'
import type { Session } from '@shared/tracking/types'
import { elapsedMinutes } from './timer'

const session: Session = {
  id: 'a',
  date: '2026-09-29',
  start: '14:49:12',
  end: null,
  label: 'Deck'
}

describe('elapsedMinutes', () => {
  it('counts whole minutes since the start', () => {
    expect(elapsedMinutes(session, at('2026-09-29', '15:10:12'))).toBe(21)
    expect(elapsedMinutes(session, at('2026-09-29', '15:10:11'))).toBe(20)
    expect(elapsedMinutes(session, at('2026-09-29', '14:49:30'))).toBe(0)
  })
  it('goes past an hour', () => {
    expect(elapsedMinutes(session, at('2026-09-29', '17:49:12'))).toBe(180)
  })
  it('is never negative', () => {
    expect(elapsedMinutes(session, at('2026-09-29', '14:00:00'))).toBe(0)
  })
  it('has no clock for a session from an earlier day', () => {
    expect(elapsedMinutes(session, at('2026-09-30', '08:00:00'))).toBeNull()
  })
})
