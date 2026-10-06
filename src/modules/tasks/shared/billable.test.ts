import { describe, expect, it } from 'vitest'
import { billableTasks, listForNewTask } from './billable'

const t = (
  uid: string,
  tags: string[] = [],
  parentUid: string | null = null
): { uid: string; tags: string[]; parentUid: string | null } => ({
  uid,
  tags,
  parentUid
})

describe('billableTasks', () => {
  it('keeps tagged tasks and the subtasks of a tagged task', () => {
    const all = [t('a', ['billable']), t('b', [], 'a'), t('c'), t('d', ['r'], 'c')]
    expect(billableTasks(all).map((x) => x.uid)).toEqual(['a', 'b'])
  })

  it('finds a subtask’s billable parent even when the parent is not in the list asked about', () => {
    const all = [t('a', ['billable']), t('b', [], 'a')]
    expect(billableTasks([all[1]], all).map((x) => x.uid)).toEqual(['b'])
  })
})

describe('listForNewTask', () => {
  const task = (
    list: string,
    tags: string[] = []
  ): { uid: string; list: string; parentUid: null; tags: string[] } => ({
    uid: list + tags.join(),
    list,
    parentUid: null,
    tags
  })
  it('prefers the last list used, then a billable task’s list, then any', () => {
    expect(listForNewTask([task('Admin'), task('Luminos', ['billable'])], 'Mine')).toBe('Mine')
    expect(listForNewTask([task('Admin'), task('Luminos', ['billable'])], '')).toBe('Luminos')
    expect(listForNewTask([task('Admin')], '')).toBe('Admin')
    expect(listForNewTask([], '')).toBe('')
  })
})
