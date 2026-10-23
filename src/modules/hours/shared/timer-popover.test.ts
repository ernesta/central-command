import { describe, expect, it } from 'vitest'
import type { Task } from '../../tasks/shared/types'
import { taskKey } from '../../tasks/shared/tracked'
import { popoverHead, STOP_NEEDS_TASK } from './timer-popover'

const task = (uid: string, title: string, extra: Partial<Task> = {}): Task =>
  ({ uid, title, list: 'Admin', parentUid: null, status: 'todo', ...extra }) as Task

const open = [
  task('1', 'Daily admin'),
  task('2', 'Training', { list: '', parentUid: '1' }),
  task('3', 'Finished', { list: 'Archive', status: 'done' })
]

describe('popoverHead', () => {
  it('state 1: a task shows its title and list, Stop on, no picker', () => {
    expect(popoverHead({ task: taskKey('1'), label: 'Daily admin' }, open, false)).toEqual({
      title: 'Daily admin',
      series: null,
      line: 'Admin',
      hint: false,
      stopDisabled: false,
      picker: false
    })
  })

  it('a self-study subtask carries its series for the muted prefix', () => {
    const all = [
      task('p', 'Simulating Social Worlds self-study', { list: 'Training' }),
      task('c', 'Day 2 self-study', { parentUid: 'p', ownKind: 'self-study' })
    ]
    const head = popoverHead({ task: taskKey('c'), label: 'Day 2 self-study' }, all, false)
    expect(head.series).toBe('Simulating Social Worlds')
    expect(head.title).toBe('Day 2 self-study')
  })

  it("a subtask shows its parent's list; a done task still shows its list; an unknown one shows none", () => {
    expect(popoverHead({ task: taskKey('2'), label: 'Training' }, open, false).line).toBe('Admin')
    expect(popoverHead({ task: taskKey('3'), label: 'Finished' }, open, false).line).toBe('Archive')
    expect(popoverHead({ task: taskKey('9'), label: 'Gone' }, open, false).line).toBeNull()
  })

  it('state 2: no task asks for one below, Stop still on', () => {
    expect(popoverHead({ label: '' }, open, false)).toEqual({
      title: 'No task yet',
      series: null,
      line: 'Pick one below',
      hint: true,
      stopDisabled: false,
      picker: true
    })
  })

  it('state 5: Stop pressed with no task greys Stop out and says why', () => {
    const head = popoverHead({ label: '' }, open, true)
    expect(head.title).toBe('Which task was this?')
    expect(head.line).toBe(STOP_NEEDS_TASK)
    expect(head.stopDisabled).toBe(true)
    expect(head.picker).toBe(true)
  })

  it('a task is never blocked from stopping by a leftover stop request', () => {
    expect(popoverHead({ task: taskKey('1'), label: 'Daily admin' }, open, true).stopDisabled).toBe(
      false
    )
  })
})
