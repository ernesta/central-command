import type { Task } from './types'

/** A task for tests; every field can be overridden. */
export function task(over: Partial<Task> = {}): Task {
  return {
    uid: 'a',
    workspace: 'research',
    title: 'A task',
    description: '',
    status: 'todo',
    priority: 'normal',
    due: null,
    completedAt: null,
    list: 'Reading',
    sublist: '',
    parentUid: null,
    position: 0,
    recurrence: null,
    seriesUid: null,
    earlierMinutes: 0,
    sourceId: null,
    tags: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...over
  }
}
