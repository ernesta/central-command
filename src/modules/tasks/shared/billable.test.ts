import { describe, expect, it } from 'vitest'
import { billableTasks } from './billable'

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
