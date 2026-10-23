import { describe, expect, it } from 'vitest'
import {
  END_OF_DAY,
  SELF_STUDY_DONE_AFTER_DAYS,
  selfStudyDoneAt,
  selfStudyTaskChanges,
  seriesChanges,
  sessionOver,
  sessionTaskChanges
} from './session-task'
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

describe('selfStudyDoneAt', () => {
  it('is a week after the date, at the end time, or at the end of the day', () => {
    expect(SELF_STUDY_DONE_AFTER_DAYS).toBe(7)
    expect(selfStudyDoneAt({ date: '2026-10-10', end: '11:00' })).toEqual(at('2026-10-17', '11:00'))
    expect(selfStudyDoneAt({ date: '2026-10-10', end: null })).toEqual(at('2026-10-17', END_OF_DAY))
    expect(selfStudyDoneAt({ date: '2026-12-28', end: '09:30' })).toEqual(at('2027-01-04', '09:30'))
    expect(selfStudyDoneAt({ date: '', end: '09:30' })).toBeNull()
  })
})

describe('selfStudyTaskChanges', () => {
  const session = { date: '2026-10-10', end: '11:00' }
  it('is due on the date and open until a week has passed since the end, to the minute', () => {
    expect(selfStudyTaskChanges(task(), session, at('2026-10-17', '10:59'))).toEqual({
      due: '2026-10-10'
    })
    expect(selfStudyTaskChanges(task(), session, at('2026-10-17', '11:00'))).toEqual({
      due: '2026-10-10',
      done: true
    })
    expect(selfStudyTaskChanges(task(), session, at('2026-10-16', '23:59'))).toEqual({
      due: '2026-10-10'
    })
    expect(selfStudyTaskChanges(task(), session, at('2026-10-18', '00:00'))).toEqual({
      due: '2026-10-10',
      done: true
    })
  })
  it('does nothing to a task already dated and done, and nothing without a date', () => {
    expect(
      selfStudyTaskChanges(
        task({ status: 'done', due: '2026-10-10' }),
        session,
        at('2026-11-01', '00:00')
      )
    ).toEqual({})
    expect(
      selfStudyTaskChanges(task(), { date: '', end: null }, at('2026-11-01', '00:00'))
    ).toEqual({})
  })
})

describe('seriesChanges', () => {
  const series = task({ uid: 'p', due: null })
  const kid = (over: Partial<Task>): Task =>
    task({ uid: 'k', parentUid: 'p', ownKind: 'meeting', ...over })
  it('takes the latest date and closes with the last open subtask', () => {
    expect(seriesChanges(series, [kid({ due: '2026-10-10' }), kid({ due: '2026-10-24' })])).toEqual(
      { due: '2026-10-24' }
    )
    expect(
      seriesChanges({ ...series, due: '2026-10-10' }, [kid({ due: '2026-10-10', status: 'done' })])
    ).toEqual({ status: 'done' })
  })
  it('opens a done series again as In progress', () => {
    expect(
      seriesChanges({ ...series, status: 'done', due: '2026-10-10' }, [
        kid({ due: '2026-10-10', status: 'done' }),
        kid({ due: '2026-10-10' })
      ])
    ).toEqual({ status: 'doing' })
  })
  it('leaves a task with no session subtask, and a series with no subtask, alone', () => {
    expect(seriesChanges(series, [task({ uid: 'k', parentUid: 'p', due: '2026-10-10' })])).toEqual(
      {}
    )
    expect(seriesChanges({ ...series, due: '2026-10-10' }, [])).toEqual({})
  })
})
