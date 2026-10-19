import { describe, expect, it } from 'vitest'
import type { Task } from '../../tasks/shared/types'
import { MANY_LOCALES, TEST_LOCALES, withLocale } from '@shared/with-locale.testing'
import {
  isOwnMeetingTask,
  meetingTaskTitle,
  planMeetingTask,
  proposeMeetingTask
} from './meeting-task'

const task = (over: Partial<Task>): Task =>
  ({
    uid: 't1',
    workspace: 'research',
    title: 'Supervision',
    list: 'Meetings',
    parentUid: null,
    ownKind: null,
    ...over
  }) as Task

describe('proposeMeetingTask', () => {
  it('Research: the series itself, in the Meetings list, nothing to take up yet', () => {
    expect(proposeMeetingTask('research', 'Rastle Lab', null, [])).toEqual({
      title: 'Rastle Lab',
      list: 'Meetings',
      existing: null
    })
  })
  it('Research: Other is just Meetings', () => {
    expect(proposeMeetingTask('research', 'Other', null, [])?.title).toBe('Meetings')
  })
  it('takes up an open task that is already it, even in another list, but never a subtask', () => {
    const mine = task({ uid: 'a', list: 'Admin' })
    expect(proposeMeetingTask('research', 'supervision', null, [mine])?.existing).toBe(mine)
    const sub = task({ uid: 'b', parentUid: 'a', list: '' })
    expect(proposeMeetingTask('research', 'Supervision', null, [sub])?.existing).toBeNull()
  })
  it('prefers the task in the Meetings list', () => {
    const a = task({ uid: 'a', list: 'Admin' })
    const b = task({ uid: 'b', list: 'Meetings' })
    expect(proposeMeetingTask('research', 'Supervision', null, [a, b])?.existing).toBe(b)
  })
  it('never carries a person: the title is the series only', () => {
    expect(proposeMeetingTask('research', 'Supervision', null, [])?.title).not.toMatch(/ with /)
  })
  it('Work: "<Client> meetings" in the client own list, in the client spelling', () => {
    expect(proposeMeetingTask('work', 'impact', ['Impact', 'Teaching & Learning'], [])).toEqual({
      title: 'Impact meetings',
      list: 'Impact',
      existing: null
    })
  })
  it('Work: a series that is no client is its own task in Teaching & Learning, Other is Meetings, and with no such client there is none', () => {
    const both = ['Impact', 'Teaching & Learning']
    expect(proposeMeetingTask('work', 'Document Automation – Vecten', both, [])).toEqual({
      title: 'Document Automation – Vecten',
      list: 'Teaching & Learning',
      existing: null
    })
    expect(proposeMeetingTask('work', 'Other', both, [])?.title).toBe('Meetings')
    expect(proposeMeetingTask('work', 'Other', ['Impact'], [])).toBeNull()
    expect(proposeMeetingTask('work', '  ', ['Impact'], [])).toBeNull()
    expect(proposeMeetingTask('work', 'Impact', null, [])).toBeNull()
  })
  it('Work: only a task in the client list is taken up', () => {
    const wrong = task({ title: 'Impact meetings', list: 'Teaching & Learning' })
    const right = task({ uid: 'r', title: 'Impact meetings', list: 'Impact' })
    expect(proposeMeetingTask('work', 'Impact', ['Impact'], [wrong])?.existing).toBeNull()
    expect(proposeMeetingTask('work', 'Impact', ['Impact'], [wrong, right])?.existing).toBe(right)
  })
})

describe('planMeetingTask', () => {
  const series = task({ uid: 's', title: 'Supervision', list: 'Meetings' })
  const note = { task: 'auto', series: 'Supervision', date: '2026-10-12' }

  it('titles a meeting "<series task> · <date>"', () => {
    expect(meetingTaskTitle('Supervision', '2026-10-12')).toBe('Supervision · Oct 12, 2026')
  })
  it('leaves an older note (no task) alone', () => {
    expect(planMeetingTask('research', { ...note, task: '' }, null, [series])).toEqual({
      kind: 'none'
    })
  })
  it('a marked note with no series waits: no task until one is chosen, then it is made', () => {
    expect(planMeetingTask('research', { ...note, series: '' }, null, [series])).toEqual({
      kind: 'none'
    })
    expect(planMeetingTask('work', { ...note, series: '' }, ['Impact'], [])).toEqual({
      kind: 'none'
    })
    expect(planMeetingTask('research', note, null, [series]).kind).toBe('create')
  })
  it('a marked note with no date waits', () => {
    expect(planMeetingTask('research', { ...note, date: '' }, null, [series])).toEqual({
      kind: 'none'
    })
  })
  it('a marked note makes its subtask under the series task that exists', () => {
    expect(planMeetingTask('research', note, null, [series])).toEqual({
      kind: 'create',
      due: '2026-10-12',
      title: 'Supervision · Oct 12, 2026',
      parent: { uid: 's' }
    })
  })
  it('makes the series task too when there is none (Other is Meetings)', () => {
    expect(planMeetingTask('research', { ...note, series: 'Other' }, null, [])).toEqual({
      kind: 'create',
      due: '2026-10-12',
      title: 'Meetings · Oct 12, 2026',
      parent: { title: 'Meetings', list: 'Meetings' }
    })
  })
  it('Work: a series that is no client makes its own series task in Teaching & Learning', () => {
    expect(
      planMeetingTask(
        'work',
        { ...note, series: 'Document Automation – Vecten' },
        ['Impact', 'Teaching & Learning'],
        []
      )
    ).toEqual({
      kind: 'create',
      due: '2026-10-12',
      title: 'Document Automation – Vecten · Oct 12, 2026',
      parent: { title: 'Document Automation – Vecten', list: 'Teaching & Learning' }
    })
    expect(planMeetingTask('work', { ...note, series: 'Other' }, ['Impact'], [])).toEqual({
      kind: 'none'
    })
    expect(planMeetingTask('work', { ...note, series: 'impact' }, ['Impact'], [])).toEqual({
      kind: 'create',
      due: '2026-10-12',
      title: 'Impact meetings · Oct 12, 2026',
      parent: { title: 'Impact meetings', list: 'Impact' }
    })
  })

  const sub = task({
    uid: 'm',
    title: 'Supervision · Oct 12, 2026',
    list: '',
    parentUid: 's',
    due: '2026-10-12'
  })
  it('a subtask with no due date, or the wrong one, is dated by the note', () => {
    expect(
      planMeetingTask('research', { ...note, task: 'm' }, null, [series, { ...sub, due: null }])
    ).toEqual({ kind: 'sync', uid: 'm', due: '2026-10-12' })
  })
  it('a subtask in step needs nothing', () => {
    expect(planMeetingTask('research', { ...note, task: 'm' }, null, [series, sub])).toEqual({
      kind: 'none'
    })
  })
  it('the subtask follows the date', () => {
    expect(
      planMeetingTask('research', { ...note, task: 'm', date: '2026-10-13' }, null, [series, sub])
    ).toEqual({
      kind: 'sync',
      uid: 'm',
      title: 'Supervision · Oct 13, 2026',
      due: '2026-10-13'
    })
  })
  it('the subtask follows the series: new title, new series task', () => {
    const lab = task({ uid: 'l', title: 'Rastle Lab', list: 'Meetings' })
    expect(
      planMeetingTask('research', { ...note, task: 'm', series: 'Rastle Lab' }, null, [
        series,
        lab,
        sub
      ])
    ).toEqual({
      kind: 'sync',
      uid: 'm',
      title: 'Rastle Lab · Oct 12, 2026',
      parent: { uid: 'l' }
    })
  })
  it('never renames or moves a task the user chose', () => {
    const chosen = task({ uid: 'c', title: 'Prepare for the supervision', parentUid: 's' })
    expect(planMeetingTask('research', { ...note, task: 'c' }, null, [series, chosen])).toEqual({
      kind: 'none'
    })
    const top = task({ uid: 'u', title: 'Supervision · Oct 12, 2026' })
    expect(planMeetingTask('research', { ...note, task: 'u' }, null, [series, top])).toEqual({
      kind: 'none'
    })
  })
  it('a task that is gone is not made again by itself', () => {
    expect(planMeetingTask('research', { ...note, task: 'gone' }, null, [series])).toEqual({
      kind: 'none'
    })
  })
})

describe('a meeting task is recognised in every region (the bug of 19 Oct 2026)', () => {
  const dates = ['2026-01-05', '2026-03-31', '2026-10-19', '2026-12-31']
  const series = task({ uid: 's', title: 'Supervision', list: 'Meetings' })

  it.each(TEST_LOCALES)('%s: the title the app writes is its own, marked or not', (locale) => {
    withLocale(locale, () => {
      for (const date of dates) {
        const title = meetingTaskTitle('Supervision', date)
        expect(isOwnMeetingTask(task({ title, parentUid: 's', list: '' }))).toBe(true)
        expect(
          isOwnMeetingTask(task({ title: 'whatever', parentUid: 's', ownKind: 'meeting' }))
        ).toBe(true)
      }
    })
  })

  it.each(MANY_LOCALES)(
    '%s: an unmarked title the app wrote in that region is still its own',
    (locale) => {
      withLocale(locale, () => {
        for (const date of dates) {
          const title = meetingTaskTitle('Supervision', date)
          expect(isOwnMeetingTask(task({ title, parentUid: 's', list: '' }))).toBe(true)
        }
      })
    }
  )

  it('ISO and US titles from before are still its own', () => {
    expect(isOwnMeetingTask(task({ title: 'Supervision · 2026-10-19', parentUid: 's' }))).toBe(true)
    expect(isOwnMeetingTask(task({ title: 'Supervision · Oct 19, 2026', parentUid: 's' }))).toBe(
      true
    )
  })

  it('a task the user chose is not its own: no marker, no date title, or no parent', () => {
    for (const title of [
      'Prepare for the supervision',
      'Supervision · notes',
      'Supervision · 2026'
    ]) {
      expect(isOwnMeetingTask(task({ title, parentUid: 's' }))).toBe(false)
    }
    expect(isOwnMeetingTask(task({ title: 'Supervision · 19 Oct 2026', parentUid: null }))).toBe(
      false
    )
  })

  it('the marker decides: a marked lecture or self-study task is not a meeting task, whatever its title', () => {
    const title = 'Supervision · 19 Oct 2026'
    expect(isOwnMeetingTask(task({ title, parentUid: 's', ownKind: 'training' }))).toBe(false)
    expect(isOwnMeetingTask(task({ title, parentUid: 's', ownKind: 'self-study' }))).toBe(false)
  })

  it.each(TEST_LOCALES)('%s: the subtask follows a changed series and date', (locale) => {
    withLocale(locale, () => {
      const own = task({
        uid: 'm',
        title: meetingTaskTitle('Supervision', '2026-10-19'),
        list: '',
        parentUid: 's',
        due: '2026-10-19',
        ownKind: 'meeting'
      })
      const other = task({ uid: 'o', title: 'Meetings', list: 'Meetings' })
      const plan = planMeetingTask(
        'research',
        { task: 'm', series: 'Other', date: '2026-10-20' },
        null,
        [series, other, own]
      )
      expect(plan).toEqual({
        kind: 'sync',
        uid: 'm',
        title: meetingTaskTitle('Meetings', '2026-10-20'),
        parent: { uid: 'o' },
        due: '2026-10-20'
      })
    })
  })
})
