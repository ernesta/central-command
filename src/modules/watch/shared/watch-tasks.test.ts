import { describe, expect, it } from 'vitest'
import type { WatchTaskLink } from '@modules/tasks/shared/watch-links'
import { watchTaskView } from './watch-tasks'

const link = (status: WatchTaskLink['status']): WatchTaskLink => ({
  itemId: 1,
  uid: 'u1',
  title: 'Apply for the fellowship',
  status
})

describe('watchTaskView', () => {
  it('offers "Task" and no note for an item with no task', () => {
    expect(watchTaskView(undefined)).toEqual({ button: 'make', note: null })
  })

  it('offers "Open task" and the note while the task is open (to do or doing)', () => {
    for (const status of ['todo', 'doing'] as const) {
      expect(watchTaskView(link(status))).toEqual({
        button: 'open',
        note: { uid: 'u1', title: 'Apply for the fellowship' }
      })
    }
  })

  it('offers "Task" again once the task is done, and keeps the note', () => {
    expect(watchTaskView(link('done'))).toEqual({
      button: 'make',
      note: { uid: 'u1', title: 'Apply for the fellowship' }
    })
  })
})
