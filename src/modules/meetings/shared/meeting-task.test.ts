import { describe, expect, it } from 'vitest'
import type { Task } from '../../tasks/shared/types'
import { proposeMeetingTask } from './meeting-task'

const task = (over: Partial<Task>): Task =>
  ({
    uid: 't1',
    workspace: 'research',
    title: 'Supervision',
    list: 'Meetings',
    parentUid: null,
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
  it('Work: a series that is no client has no proposal, and neither does an empty one', () => {
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
