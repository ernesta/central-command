import { describe, expect, it } from 'vitest'
import { task } from '../shared/test-utils'
import { taskHits } from './search'

describe('taskHits', () => {
  const today = '2026-10-05'
  const tasks = [
    task({ uid: 'a', title: 'Write methods', due: '2026-10-09' }),
    task({ uid: 'b', title: 'Write intro', due: '2026-10-07' }),
    task({ uid: 'c', title: 'Write old', status: 'done', due: '2026-01-01' }),
    task({ uid: 'd', title: 'Other', description: 'something about methods here' }),
    task({ uid: 'e', title: 'Kid', parentUid: 'a' })
  ]
  it('finds every word in the title, tags, list or description, open and soonest first, done last', () => {
    expect(taskHits(tasks, 'write', 6, today).map((h) => h.key)).toEqual(['b', 'a', 'c'])
    expect(taskHits(tasks, 'methods', 6, today).map((h) => h.key)).toEqual(['a', 'd'])
  })
  it('shows the matching text from the description, else the list and date; a subtask names its parent', () => {
    const hits = taskHits(tasks, 'methods', 6, today)
    expect(hits[0].detail).toBe('Reading · Oct 9')
    expect(hits[1].detail).toContain('methods')
    expect(taskHits(tasks, 'kid', 6, today)[0].detail).toBe('Subtask of Write methods')
  })
  it('finds nothing for no words and respects the limit', () => {
    expect(taskHits(tasks, '  ', 6, today)).toEqual([])
    expect(taskHits(tasks, 'write', 2, today)).toHaveLength(2)
  })
})
