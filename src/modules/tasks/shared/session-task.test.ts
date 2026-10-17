import { describe, expect, it } from 'vitest'
import { sessionOver, sessionTaskChanges } from './session-task'
import type { Task } from './types'

const task = (over: Partial<Task> = {}): Task =>
  ({ uid: 't', status: 'doing', due: null, ...over }) as Task

const at = (date: string, time: string): { date: string; time: string } => ({ date, time })

describe('sessionOver', () => {
  it('is over once its end time has passed that day', () => {
    expect(sessionOver({ date: '2026-10-17', end: '11:00' }, at('2026-10-17', '10:59'))).toBe(false)
    expect(sessionOver({ date: '2026-10-17', end: '11:00' }, at('2026-10-17', '11:00'))).toBe(true)
  })
  it('is over on any later day, not before its day', () => {
    expect(sessionOver({ date: '2026-10-17', end: '23:00' }, at('2026-10-18', '00:01'))).toBe(true)
    expect(sessionOver({ date: '2026-10-18', end: '09:00' }, at('2026-10-17', '23:59'))).toBe(false)
  })
  it('with no end time is over when its day is', () => {
    expect(sessionOver({ date: '2026-10-17', end: null }, at('2026-10-17', '23:59'))).toBe(false)
    expect(sessionOver({ date: '2026-10-17', end: null }, at('2026-10-18', '00:00'))).toBe(true)
  })
  it('with no date is never over', () => {
    expect(sessionOver({ date: '', end: '09:00' }, at('2026-10-18', '12:00'))).toBe(false)
  })
})

describe('sessionTaskChanges', () => {
  const session = { date: '2026-10-10', end: '11:00' }
  it('dates and closes an open task of a past session', () => {
    expect(sessionTaskChanges(task(), session, at('2026-10-17', '09:00'))).toEqual({
      due: '2026-10-10',
      done: true
    })
  })
  it('only dates a task of a session still to come', () => {
    expect(sessionTaskChanges(task(), session, at('2026-10-10', '10:00'))).toEqual({
      due: '2026-10-10'
    })
  })
  it('changes nothing once dated and done, and never reopens', () => {
    expect(
      sessionTaskChanges(
        task({ due: '2026-10-10', status: 'done' }),
        session,
        at('2026-10-17', '09:00')
      )
    ).toEqual({})
  })
  it('does nothing for a session with no date', () => {
    expect(sessionTaskChanges(task(), { date: '', end: null }, at('2026-10-17', '09:00'))).toEqual(
      {}
    )
  })
})
