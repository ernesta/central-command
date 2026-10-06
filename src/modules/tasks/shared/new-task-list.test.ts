import { describe, expect, it } from 'vitest'
import { listForNewTask } from './new-task-list'

const task = (
  list: string,
  parentUid: string | null = null
): { list: string; parentUid: string | null } => ({
  list,
  parentUid
})

describe('listForNewTask', () => {
  it('prefers the last list used, then the first list of a top-level task', () => {
    expect(listForNewTask([task('Admin')], 'Mine')).toBe('Mine')
    expect(listForNewTask([task('', 'p'), task('Admin'), task('Luminos')], '')).toBe('Admin')
    expect(listForNewTask([], '')).toBe('')
  })
})
